export class AudioProcessor {
  constructor() {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.sampleRate = 44100;
    this.freq0 = 400;
    this.freq1 = 800;
    this.bitDuration = 0.1;
    // Reduce chunk size for better memory management
    this.chunkSize = 256; // Process smaller chunks
    this.maxFileSize = 1024 * 1024 * 5; // 5MB limit
  }

  async fileToBinary(file) {
    if (file.size > this.maxFileSize) {
      throw new Error('File too large. Please choose a file under 5MB.');
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    return Array.from(uint8Array)
      .map(byte => byte.toString(2).padStart(8, '0'))
      .join('');
  }

  async binaryToAudio(binary) {
    // Calculate total length and validate
    const totalSamples = Math.ceil(binary.length * this.sampleRate * this.bitDuration);
    if (totalSamples > this.sampleRate * 60) { // Max 60 seconds
      throw new Error('Data too large to encode. Try a smaller file.');
    }

    // Split binary into smaller chunks
    const chunks = [];
    for (let i = 0; i < binary.length; i += this.chunkSize) {
      chunks.push(binary.slice(i, i + this.chunkSize));
    }

    // Process chunks with delay to prevent UI blocking
    const buffers = await this.processChunksWithDelay(chunks);
    
    // Concatenate buffers
    const finalBuffer = this.context.createBuffer(
      1,
      totalSamples,
      this.sampleRate
    );
    const channelData = finalBuffer.getChannelData(0);
    
    let offset = 0;
    buffers.forEach(buffer => {
      channelData.set(buffer.getChannelData(0), offset);
      offset += buffer.length;
    });

    return finalBuffer;
  }

  async processChunksWithDelay(chunks) {
    const buffers = [];
    for (let i = 0; i < chunks.length; i++) {
      // Add small delay between processing chunks
      if (i > 0 && i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      buffers.push(await this.createChunkBuffer(chunks[i]));
    }
    return buffers;
  }

  createChunkBuffer(binaryChunk) {
    const samplesPerBit = Math.ceil(this.sampleRate * this.bitDuration);
    const buffer = this.context.createBuffer(
      1,
      binaryChunk.length * samplesPerBit,
      this.sampleRate
    );
    const channelData = buffer.getChannelData(0);

    binaryChunk.split('').forEach((bit, index) => {
      const freq = bit === '1' ? this.freq1 : this.freq0;
      const start = index * samplesPerBit;
      
      for (let i = 0; i < samplesPerBit; i++) {
        // Apply fade in/out to reduce clicking
        const fade = Math.min(i, samplesPerBit - i, samplesPerBit * 0.1) / (samplesPerBit * 0.1);
        channelData[start + i] = Math.sin(2 * Math.PI * freq * (i / this.sampleRate)) * fade;
      }
    });

    return buffer;
  }

  async playAudio(buffer, analyserNode) {
    return new Promise((resolve, reject) => {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      
      if (analyserNode) {
        source.connect(analyserNode);
        analyserNode.connect(this.context.destination);
      } else {
        source.connect(this.context.destination);
      }
      
      source.onended = resolve;
      source.onerror = reject;
      source.start();
    });
  }

  async captureAndDecodeAudio(stream, onProgress) {
    const input = this.context.createMediaStreamSource(stream);
    const analyser = this.context.createAnalyser();
    input.connect(analyser);

    analyser.fftSize = 2048;
    const buffer = new Float32Array(analyser.fftSize);
    const binary = [];
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const duration = 5000; // 5 seconds recording
      
      const interval = setInterval(() => {
        const progress = ((Date.now() - startTime) / duration) * 100;
        onProgress(Math.min(progress, 100));
        
        analyser.getFloatTimeDomainData(buffer);
        const dominantFreq = this.detectDominantFrequency(buffer);
        
        if (Math.abs(dominantFreq - this.freq0) < 50) binary.push('0');
        else if (Math.abs(dominantFreq - this.freq1) < 50) binary.push('1');
        
        if (progress >= 100) {
          clearInterval(interval);
          stream.getTracks().forEach(track => track.stop());
          resolve(binary.join(''));
        }
      }, 100);
    });
  }

  detectDominantFrequency(buffer) {
    const fft = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      fft[i] = Math.abs(buffer[i]);
    }
    return fft.indexOf(Math.max(...fft)) * this.sampleRate / buffer.length;
  }

  binaryToFile(binary) {
    const byteArray = binary.match(/.{8}/g).map(b => parseInt(b, 2));
    return new Blob([new Uint8Array(byteArray)]);
  }
}
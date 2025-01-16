export class AudioProcessor {
  constructor() {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.sampleRate = 44100;
    this.freq0 = 400;
    this.freq1 = 800;
    this.bitDuration = 0.1;
    // Significantly reduce chunk size for better memory management
    this.chunkSize = 128; // Process in very small chunks
    this.maxFileSize = 1024 * 1024 * 50; // Increase to 50MB limit
    this.processingChunkSize = 1024; // Size of audio processing chunks
  }

  async fileToBinary(file) {
    if (file.size > this.maxFileSize) {
      throw new Error('File too large. Please choose a file under 50MB.');
    }
    
    // Process file in chunks
    const chunks = [];
    const chunkSize = 1024 * 1024; // 1MB chunks
    let offset = 0;
    
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      const arrayBuffer = await chunk.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      chunks.push(Array.from(uint8Array)
        .map(byte => byte.toString(2).padStart(8, '0'))
        .join(''));
      offset += chunkSize;
    }
    
    return chunks.join('');
  }

  async binaryToAudio(binary) {
    // Split into manageable chunks
    const chunkDuration = 5; // 5 seconds per chunk
    const samplesPerChunk = this.sampleRate * chunkDuration;
    const bitsPerChunk = Math.floor(samplesPerChunk / (this.sampleRate * this.bitDuration));
    
    const chunks = [];
    for (let i = 0; i < binary.length; i += bitsPerChunk) {
      chunks.push(binary.slice(i, i + bitsPerChunk));
    }

    // Create buffers for each chunk
    const buffers = await Promise.all(
      chunks.map(chunk => this.createChunkBuffer(chunk))
    );

    // Concatenate all buffers
    const totalSamples = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const finalBuffer = this.context.createBuffer(1, totalSamples, this.sampleRate);
    const channelData = finalBuffer.getChannelData(0);
    
    let offset = 0;
    buffers.forEach(buffer => {
      channelData.set(buffer.getChannelData(0), offset);
      offset += buffer.length;
    });

    return finalBuffer;
  }

  createChunkBuffer(binaryChunk) {
    const samplesPerBit = Math.ceil(this.sampleRate * this.bitDuration);
    const bufferLength = binaryChunk.length * samplesPerBit;
    
    const buffer = this.context.createBuffer(1, bufferLength, this.sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < binaryChunk.length; i++) {
      const bit = binaryChunk[i];
      const freq = bit === '1' ? this.freq1 : this.freq0;
      const start = i * samplesPerBit;
      
      for (let j = 0; j < samplesPerBit; j++) {
        // Improved fade in/out with smoother transition
        const fade = 0.5 - Math.cos(Math.PI * j / samplesPerBit) / 2;
        channelData[start + j] = Math.sin(2 * Math.PI * freq * (j / this.sampleRate)) * fade;
      }
    }

    return buffer;
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
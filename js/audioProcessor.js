export class AudioProcessor {
  constructor() {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.sampleRate = 44100;
    this.freq0 = 400;
    this.freq1 = 800;
    this.bitDuration = 0.1;
    this.chunkSize = 1000; // Process 1000 bits at a time
  }

  async fileToBinary(file) {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    return Array.from(uint8Array)
      .map(byte => byte.toString(2).padStart(8, '0'))
      .join('');
  }

  async binaryToAudio(binary) {
    // Split binary into chunks
    const chunks = [];
    for (let i = 0; i < binary.length; i += this.chunkSize) {
      chunks.push(binary.slice(i, i + this.chunkSize));
    }

    // Process each chunk
    const buffers = await Promise.all(chunks.map(chunk => this.createChunkBuffer(chunk)));
    
    // Concatenate all buffers
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const finalBuffer = this.context.createBuffer(1, totalLength, this.sampleRate);
    const channelData = finalBuffer.getChannelData(0);
    
    let offset = 0;
    buffers.forEach(buffer => {
      channelData.set(buffer.getChannelData(0), offset);
      offset += buffer.length;
    });

    return finalBuffer;
  }

  createChunkBuffer(binaryChunk) {
    const buffer = this.context.createBuffer(
      1,
      binaryChunk.length * this.sampleRate * this.bitDuration,
      this.sampleRate
    );
    const channelData = buffer.getChannelData(0);

    binaryChunk.split('').forEach((bit, index) => {
      const freq = bit === '1' ? this.freq1 : this.freq0;
      const start = index * this.sampleRate * this.bitDuration;
      
      for (let i = 0; i < this.sampleRate * this.bitDuration; i++) {
        channelData[start + i] = Math.sin(2 * Math.PI * freq * (i / this.sampleRate));
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
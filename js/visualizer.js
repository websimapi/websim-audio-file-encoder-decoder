export class Visualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.analyser = null;
    this.isActive = false;
    
    this.setupCanvas();
    
    // Add performance optimizations
    this.animationFrame = null;
    this.lastDrawTime = 0;
    this.minDrawInterval = 1000 / 30; // Cap at 30 FPS
  }

  setupCanvas() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
  }

  start() {
    if (!this.analyser) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = audioContext.createAnalyser();
      this.analyser.fftSize = 1024; // Reduced for better performance
    }
    
    this.isActive = true;
    this.lastDrawTime = performance.now();
    this.draw(this.lastDrawTime);
  }

  stop() {
    this.isActive = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  draw(timestamp) {
    if (!this.isActive) return;
    
    // Limit frame rate for better performance
    const elapsed = timestamp - this.lastDrawTime;
    if (elapsed < this.minDrawInterval) {
      this.animationFrame = requestAnimationFrame((t) => this.draw(t));
      return;
    }
    
    this.lastDrawTime = timestamp;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);

    // Clear with existing background
    this.ctx.fillStyle = '#f8f9fa';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Optimize drawing by reducing points
    const skip = Math.ceil(bufferLength / this.canvas.width);
    
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#2196f3';
    this.ctx.beginPath();

    let x = 0;
    for (let i = 0; i < bufferLength; i += skip) {
      const v = dataArray[i] / 128.0;
      const y = v * this.canvas.height / 2;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }

      x += (this.canvas.width / (bufferLength / skip));
    }

    this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
    this.ctx.stroke();

    this.animationFrame = requestAnimationFrame((t) => this.draw(t));
  }
}
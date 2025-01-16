export class Visualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.analyser = null;
    this.isActive = false;
    
    this.setupCanvas();
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
      this.analyser.fftSize = 2048;
    }
    
    this.isActive = true;
    this.draw();
  }

  stop() {
    this.isActive = false;
  }

  draw() {
    if (!this.isActive) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);

    this.ctx.fillStyle = '#f8f9fa';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#2196f3';
    this.ctx.beginPath();

    const sliceWidth = this.canvas.width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * this.canvas.height / 2;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
    this.ctx.stroke();

    requestAnimationFrame(() => this.draw());
  }
}
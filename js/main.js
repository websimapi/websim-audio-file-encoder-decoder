import { AudioProcessor } from './audioProcessor.js';
import { Visualizer } from './visualizer.js';
import { UIController } from './uiController.js';

class App {
  constructor() {
    this.audioProcessor = new AudioProcessor();
    this.visualizer = new Visualizer('waveform');
    this.ui = new UIController();
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.ui.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    this.ui.encodeButton.addEventListener('click', this.handleEncode.bind(this));
    this.ui.decodeButton.addEventListener('click', this.handleDecode.bind(this));
  }

  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024 * 5) { // 5MB limit
      this.ui.setStatus('File too large. Please choose a file under 5MB.', true);
      this.ui.fileInput.value = '';
      return;
    }

    this.ui.updateFileDetails(file);
    this.ui.encodeButton.disabled = false;
  }

  async handleEncode() {
    try {
      const file = this.ui.fileInput.files[0];
      this.ui.setStatus('Processing file...');
      this.ui.updateProgress(10);
      
      // Wrap in setTimeout to allow UI to update
      setTimeout(async () => {
        try {
          const binary = await this.audioProcessor.fileToBinary(file);
          this.ui.updateProgress(30);
          
          const audioBuffer = await this.audioProcessor.binaryToAudio(binary);
          this.ui.updateProgress(60);
          
          this.visualizer.start();
          await this.audioProcessor.playAudio(audioBuffer, this.visualizer.analyser);
          this.ui.updateProgress(100);
          
          this.ui.setStatus('File encoded and played!');
          this.ui.decodeButton.disabled = false;
        } catch (error) {
          console.error('Encoding error:', error);
          this.ui.setStatus(`Error: ${error.message}`, true);
          this.visualizer.stop();
        }
      }, 100);
    } catch (error) {
      console.error('File processing error:', error);
      this.ui.setStatus(`Error: ${error.message}`, true);
    }
  }

  async handleDecode() {
    try {
      this.ui.setStatus('Recording audio...');
      this.ui.updateProgress(0);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const binary = await this.audioProcessor.captureAndDecodeAudio(stream, progress => {
        this.ui.updateProgress(progress);
      });
      
      const decodedFile = this.audioProcessor.binaryToFile(binary);
      this.ui.triggerDownload(decodedFile, 'decoded_file');
      
      this.ui.setStatus('File decoded successfully!');
    } catch (error) {
      this.ui.setStatus(`Error: ${error.message}`, true);
    }
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
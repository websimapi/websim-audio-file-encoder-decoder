export class UIController {
  constructor() {
    this.fileInput = document.getElementById('fileInput');
    this.encodeButton = document.getElementById('encodePlayButton');
    this.decodeButton = document.getElementById('decodeButton');
    this.statusElement = document.getElementById('status');
    this.progressBar = document.getElementById('progress').querySelector('.progress-fill');
    this.fileDetails = document.getElementById('fileDetails');
  }

  updateFileDetails(file) {
    const size = this.formatFileSize(file.size);
    this.fileDetails.textContent = `${file.name} (${size})`;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  setStatus(message, isError = false) {
    this.statusElement.textContent = message;
    this.statusElement.style.color = isError ? 'var(--error-color)' : 'var(--text-color)';
  }

  updateProgress(percent) {
    this.progressBar.style.width = `${percent}%`;
  }

  triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
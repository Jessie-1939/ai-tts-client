/**
 * AI-TTS Client - 内容脚本
 * 功能：页面注入、语音播放器UI、播放控制
 * 设计标准：商业级顶级交互体验
 */

class TTSPlayer {
  constructor() {
    this.audio = null;
    this.playerElement = null;
    this.isPlaying = false;
    this.isDraggingProgress = false;
    this.isDraggingPlayer = false;
    this.pendingSeekPercent = null;
    this.currentSpeed = 1.0;
    this.currentVolume = 1.0;
    this.currentAudioUrl = null;
    this.activeRequestId = null;
    this.documentListenersBound = false;
    this.playerDragOffset = { x: 0, y: 0 };
    this.handleDocumentMouseMove = (e) => {
      if (this.isDraggingProgress) {
        this.updateProgressFromEvent(e);
      }
      if (this.isDraggingPlayer) {
        this.updatePlayerDrag(e);
      }
    };
    this.handleDocumentMouseUp = () => {
      this.isDraggingProgress = false;
      if (this.isDraggingPlayer) {
        this.stopPlayerDrag();
      }
    };
    this.init();
  }

  init() {
    // 监听来自background的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case '__ping__':
          sendResponse({ ok: true });
          return false;
        case 'show-loading':
          this.beginRequest(request.requestId);
          this.showLoading(request.text);
          break;
        case 'play-speech':
          if (this.shouldIgnoreRequest(request.requestId)) return false;
          this.playSpeech(request.audioData, request.text, request.config, request.requestId);
          break;
        case 'show-error':
          if (this.shouldIgnoreRequest(request.requestId)) return false;
          this.showError(request.message);
          break;
      }
    });

    window.addEventListener('pagehide', () => {
      this.hardReset('pagehide');
    });

    console.log('🎙️ TTS 播放器已初始化');
  }

  beginRequest(requestId) {
    this.activeRequestId = requestId || null;
  }

  shouldIgnoreRequest(requestId) {
    if (!requestId) return false;
    if (!this.activeRequestId) return true;
    return requestId !== this.activeRequestId;
  }

  hardReset(reason = 'unknown') {
    this.removeExistingPlayer();
    this.activeRequestId = null;
  }

  // 显示加载状态
  showLoading(text) {
    this.removeExistingPlayer();
    this.createPlayerContainer();
    
    this.playerElement.innerHTML = `
      <div class="doubao-tts-mini">
        <div class="doubao-tts-header">
          <span class="doubao-tts-title">语音生成中</span>
          <button class="doubao-tts-btn doubao-tts-close-btn" title="关闭">✕</button>
        </div>
        <div class="doubao-tts-loading">
          <div class="doubao-tts-spinner"></div>
          <div class="doubao-tts-loading-text">正在生成语音...</div>
          <div class="doubao-tts-loading-bar"><span></span></div>
          <div class="doubao-tts-text">${this.escapeHtml(text.slice(0, 100))}${text.length > 100 ? '...' : ''}</div>
        </div>
      </div>
    `;

    this.bindCloseButton();
    this.bindHeaderDrag();
    this.showPlayer();
  }

  // 播放语音
  playSpeech(audioBase64, text, config, requestId) {
    this.removeExistingPlayer();
    this.createPlayerContainer();

    // 解码base64音频
    const audioBlob = this.base64ToBlob(audioBase64, 'audio/mpeg');
    const audioUrl = URL.createObjectURL(audioBlob);
    this.currentAudioUrl = audioUrl;

    // 创建音频对象
    this.audio = new Audio(audioUrl);
    this.audio.playbackRate = config.speed || 1.0;
    this.audio.volume = config.volume || 1.0;
    this.currentSpeed = config.speed || 1.0;
    this.currentVolume = config.volume || 1.0;

    // 渲染播放器UI
    this.renderPlayer(text, audioUrl);

    // 绑定音频事件
    this.bindAudioEvents();

    // 自动播放
    setTimeout(() => {
      this.togglePlay();
    }, 300);
  }

  // 渲染播放器界面
  renderPlayer(text, audioUrl) {
    this.playerElement.innerHTML = `
      <div class="doubao-tts-mini">
        <div class="doubao-tts-header">
          <span class="doubao-tts-title">语音朗读</span>
          <button class="doubao-tts-btn doubao-tts-close-btn" title="关闭">✕</button>
        </div>
        <div class="doubao-tts-controls">
          <button class="doubao-tts-btn doubao-tts-skip-btn doubao-tts-backward" title="后退5秒">
            <span class="doubao-tts-skip-icon">⏪</span>
            <span class="doubao-tts-skip-badge">5</span>
          </button>
          <button class="doubao-tts-btn doubao-tts-play-btn" title="播放/暂停">▶️</button>
          <button class="doubao-tts-btn doubao-tts-skip-btn doubao-tts-forward" title="前进5秒">
            <span class="doubao-tts-skip-icon">⏩</span>
            <span class="doubao-tts-skip-badge">5</span>
          </button>
          <button class="doubao-tts-btn doubao-tts-download-btn" title="下载音频">⬇️</button>
        </div>

        <div class="doubao-tts-progress-container">
          <span class="doubao-tts-current">0:00</span>
          <div class="doubao-tts-progress-bar">
            <div class="doubao-tts-progress-fill"></div>
            <div class="doubao-tts-progress-thumb"></div>
          </div>
          <span class="doubao-tts-duration">0:00</span>
        </div>

        <div class="doubao-tts-adjustments">
          <div class="doubao-tts-adjust">
            <span class="doubao-tts-label">速度</span>
            <input class="doubao-tts-slider doubao-tts-speed" type="range" min="0.5" max="2" step="0.1" value="${this.currentSpeed}">
            <span class="doubao-tts-value doubao-tts-speed-value">${this.formatSpeed(this.currentSpeed)}</span>
          </div>
        </div>
      </div>
    `;

    this.bindPlayerEvents();
    this.syncControlValues();
    this.showPlayer();
  }

  // 创建播放器容器
  createPlayerContainer() {
    this.playerElement = document.createElement('div');
    this.playerElement.className = 'doubao-tts-player';
    document.body.appendChild(this.playerElement);
  }

  // 显示播放器（动画）
  showPlayer() {
    requestAnimationFrame(() => {
      this.playerElement.classList.add('show');
    });
  }

  // 隐藏播放器（动画）
  hidePlayer() {
    if (this.playerElement) {
      this.playerElement.classList.remove('show');
      setTimeout(() => {
        this.removeExistingPlayer();
      }, 500);
    }
  }

  // 移除已存在的播放器
  removeExistingPlayer() {
    this.cleanupAudio();
    const existing = document.querySelector('.doubao-tts-player');
    if (existing) {
      existing.remove();
    }
    this.playerElement = null;
    this.isPlaying = false;
    this.isDraggingProgress = false;
    this.isDraggingPlayer = false;
  }

  cleanupAudio() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      try {
        this.audio.load();
      } catch (_) {
        // ignore load errors
      }
      this.audio = null;
    }

    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
  }

  // 绑定播放器事件
  bindPlayerEvents() {
    const player = this.playerElement;

    this.bindHeaderDrag();

    const closeBtn = player.querySelector('.doubao-tts-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closePlayer();
      });
    }

    // 播放/暂停按钮
    const playBtn = player.querySelector('.doubao-tts-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        this.togglePlay();
      });
    }

    // 后退5秒
    const backwardBtn = player.querySelector('.doubao-tts-backward');
    if (backwardBtn) {
      backwardBtn.addEventListener('click', () => {
        this.audio.currentTime = Math.max(0, this.audio.currentTime - 5);
      });
    }

    // 前进5秒
    const forwardBtn = player.querySelector('.doubao-tts-forward');
    if (forwardBtn) {
      forwardBtn.addEventListener('click', () => {
        this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 5);
      });
    }

    // 下载音频
    const downloadBtn = player.querySelector('.doubao-tts-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        if (this.currentAudioUrl) {
          this.downloadAudio(this.currentAudioUrl);
        } else {
          this.showToast('音频尚未准备好，请稍后再试', 'error');
        }
      });
    }

    // 进度条点击
    const progressBar = player.querySelector('.doubao-tts-progress-bar');
    if (progressBar) {
      progressBar.addEventListener('mousedown', (e) => {
        this.isDraggingProgress = true;
        this.updateProgressFromEvent(e);
      });

      this.ensureDocumentDragListeners();
    }

    // 速度调节
    const speedSlider = player.querySelector('.doubao-tts-speed');
    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        const value = Number.parseFloat(e.target.value);
        this.setSpeed(value);
      });
    }

  }

  bindCloseButton() {
    if (!this.playerElement) return;
    const closeBtn = this.playerElement.querySelector('.doubao-tts-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closePlayer();
      });
    }
  }

  bindHeaderDrag() {
    if (!this.playerElement) return;
    const header = this.playerElement.querySelector('.doubao-tts-header');
    if (!header || header.dataset.dragBound === 'true') return;
    header.dataset.dragBound = 'true';
    header.addEventListener('mousedown', (e) => {
      this.startPlayerDrag(e);
    });
  }

  ensureDocumentDragListeners() {
    if (this.documentListenersBound) return;
    document.addEventListener('mousemove', this.handleDocumentMouseMove);
    document.addEventListener('mouseup', this.handleDocumentMouseUp);
    this.documentListenersBound = true;
  }

  // 绑定音频事件
  bindAudioEvents() {
    const player = this.playerElement;
    const progressFill = player.querySelector('.doubao-tts-progress-fill');
    const progressThumb = player.querySelector('.doubao-tts-progress-thumb');
    const currentTimeEl = player.querySelector('.doubao-tts-current');
    const durationEl = player.querySelector('.doubao-tts-duration');

    // 元数据加载完成
    this.audio.addEventListener('loadedmetadata', () => {
      durationEl.textContent = this.formatTime(this.audio.duration);

      if (Number.isFinite(this.audio.duration) && this.audio.duration > 0 && this.pendingSeekPercent !== null) {
        const nextTime = this.pendingSeekPercent * this.audio.duration;
        this.audio.currentTime = nextTime;
        this.applyProgressUI(this.pendingSeekPercent, progressFill, progressThumb, currentTimeEl);
        this.pendingSeekPercent = null;
      }
    });

    // 时间更新
    this.audio.addEventListener('timeupdate', () => {
      if (!this.isDraggingProgress) {
        const progress = this.getAudioProgressPercent();
        this.applyProgressUI(progress, progressFill, progressThumb, currentTimeEl);
        currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
      }
    });

    // 播放结束
    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.updatePlayButton();
      progressFill.style.width = '0%';
      if (progressThumb) {
        progressThumb.style.left = '0%';
      }
      this.pendingSeekPercent = null;
      currentTimeEl.textContent = '0:00';
    });

    // 播放状态变化
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.updatePlayButton();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayButton();
    });
  }

  // 切换播放/暂停
  togglePlay() {
    if (!this.audio) return;

    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play().catch(err => {
        console.error('播放失败:', err);
        this.showToast('播放失败，请重试', 'error');
      });
    }
  }

  // 更新播放按钮状态
  updatePlayButton() {
    if (!this.playerElement) return;
    const btn = this.playerElement.querySelector('.doubao-tts-play-btn');
    if (btn) {
      btn.textContent = this.isPlaying ? '⏸️' : '▶️';
    }
  }

  // 从鼠标事件更新进度
  updateProgressFromEvent(e) {
    if (!this.playerElement || !this.audio) return;
    
    const progressBar = this.playerElement.querySelector('.doubao-tts-progress-bar');
    if (!progressBar) return;
    const rect = progressBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    const progressFill = this.playerElement.querySelector('.doubao-tts-progress-fill');
    progressFill.style.width = `${percent * 100}%`;
    const progressThumb = this.playerElement.querySelector('.doubao-tts-progress-thumb');
    if (progressThumb) {
      progressThumb.style.left = `${percent * 100}%`;
    }

    if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
      this.audio.currentTime = percent * this.audio.duration;
      this.pendingSeekPercent = null;
    } else {
      // 音频时长尚未就绪时，先记录用户期望的位置，等 metadata 到来后再跳转
      this.pendingSeekPercent = percent;
    }
  }

  getAudioProgressPercent() {
    if (!this.audio || !Number.isFinite(this.audio.duration) || this.audio.duration <= 0) {
      return this.pendingSeekPercent !== null ? this.pendingSeekPercent : 0;
    }

    return Math.max(0, Math.min(1, this.audio.currentTime / this.audio.duration));
  }

  applyProgressUI(percent, progressFill, progressThumb, currentTimeEl) {
    const clampedPercent = Math.max(0, Math.min(1, Number.isFinite(percent) ? percent : 0));
    const progressValue = clampedPercent * 100;

    progressFill.style.width = `${progressValue}%`;
    if (progressThumb) {
      progressThumb.style.left = `${progressValue}%`;
    }

    if (currentTimeEl && this.audio && Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
      currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
    }
  }

  // 设置播放速度
  setSpeed(speed) {
    if (Number.isNaN(speed)) return;
    this.currentSpeed = speed;
    if (this.audio) {
      this.audio.playbackRate = speed;
    }
    this.updateSpeedDisplay();
  }

  // 设置音量
  setVolume(volume) {
    if (Number.isNaN(volume)) return;
    this.currentVolume = volume;
    if (this.audio) {
      this.audio.volume = volume;
    }
    this.updateVolumeDisplay();
  }

  syncControlValues() {
    if (!this.playerElement) return;
    const speedSlider = this.playerElement.querySelector('.doubao-tts-speed');
    if (speedSlider) {
      speedSlider.value = this.currentSpeed;
    }
    this.updateSpeedDisplay();
  }

  updateSpeedDisplay() {
    if (!this.playerElement) return;
    const speedValue = this.playerElement.querySelector('.doubao-tts-speed-value');
    if (speedValue) {
      speedValue.textContent = this.formatSpeed(this.currentSpeed);
    }
  }

  updateVolumeDisplay() {
    if (!this.playerElement) return;
    const volumeValue = this.playerElement.querySelector('.doubao-tts-volume-value');
    if (volumeValue) {
      volumeValue.textContent = this.formatVolume(this.currentVolume);
    }
  }

  formatSpeed(speed) {
    if (!Number.isFinite(speed)) return '1.0x';
    return `${speed.toFixed(1)}x`;
  }

  formatVolume(volume) {
    if (!Number.isFinite(volume)) return '100%';
    return `${Math.round(volume * 100)}%`;
  }

  closePlayer() {
    this.activeRequestId = null;
    this.cleanupAudio();
    this.hidePlayer();
  }

  // 下载音频
  downloadAudio(url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-tts-${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.showToast('音频下载已开始', 'success');
  }

  // 显示错误
  showError(message) {
    this.removeExistingPlayer();
    this.createPlayerContainer();
    
    this.playerElement.innerHTML = `
      <div class="doubao-tts-mini">
        <div class="doubao-tts-header">
          <span class="doubao-tts-title">发生错误</span>
          <button class="doubao-tts-btn doubao-tts-close-btn" title="关闭">✕</button>
        </div>
        <div class="doubao-tts-error">
          <div class="doubao-tts-error-icon">❌</div>
          <div class="doubao-tts-error-text">${this.escapeHtml(message)}</div>
        </div>
      </div>
    `;

    this.bindCloseButton();
    this.bindHeaderDrag();
    this.showPlayer();
    
    setTimeout(() => {
      this.hidePlayer();
    }, 4000);
  }

  // 显示Toast提示
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `doubao-tts-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // 工具函数：base64转Blob
  base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    
    return new Blob(byteArrays, { type: mimeType });
  }

  // 工具函数：格式化时间
  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // 工具函数：HTML转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  startPlayerDrag(e) {
    if (!this.playerElement) return;
    if (e.button !== 0) return;
    if (e.target.closest('.doubao-tts-close-btn')) return;

    e.preventDefault();
    const rect = this.playerElement.getBoundingClientRect();
    this.playerDragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    this.isDraggingPlayer = true;
    this.playerElement.classList.add('dragging');
    this.ensureDocumentDragListeners();
  }

  updatePlayerDrag(e) {
    if (!this.playerElement) return;
    const rect = this.playerElement.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const margin = 12;

    const nextLeft = e.clientX - this.playerDragOffset.x;
    const nextTop = e.clientY - this.playerDragOffset.y;
    const maxLeft = window.innerWidth - width - margin;
    const maxTop = window.innerHeight - height - margin;

    const clampedLeft = Math.max(margin, Math.min(maxLeft, nextLeft));
    const clampedTop = Math.max(margin, Math.min(maxTop, nextTop));

    this.applyPlayerPosition(clampedLeft, clampedTop);
  }

  applyPlayerPosition(left, top) {
    if (!this.playerElement) return;
    this.playerElement.style.setProperty('--doubao-tts-left', `${left}px`);
    this.playerElement.style.setProperty('--doubao-tts-top', `${top}px`);
    this.playerElement.style.setProperty('--doubao-tts-bottom', 'auto');
    this.playerElement.style.setProperty('--doubao-tts-transform', 'translate(0, 0)');
  }

  stopPlayerDrag() {
    this.isDraggingPlayer = false;
    if (this.playerElement) {
      this.playerElement.classList.remove('dragging');
    }
  }
}

// 初始化播放器
if (!window.ttsPlayer) {
  window.ttsPlayer = new TTSPlayer();
}

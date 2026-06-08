/**
 * AI-TTS Client - 完整设置页逻辑
 * 与 popup.js 共用同一套配置逻辑，但不自动关闭页面
 */

class SettingsController {
  constructor() {
    this.defaultVoiceType = 'zh_female_tianmeixiaoyuan_uranus_bigtts';
    this.resourceId = 'seed-tts-2.0';

    this.initElements();
    this.bindEvents();
    this.bindStorageEvents();
    this.initTheme();
    this.loadConfig().catch((error) => {
      this.showToast(`配置加载失败：${this.getErrorMessage(error)}`, 'error');
    });
    this.loadStats();
  }

  initElements() {
    this.elements = {
      apiKey: document.getElementById('apiKey'),
      voiceType: document.getElementById('voiceType'),
      configStatus: document.getElementById('configStatus'),
      saveBtn: document.getElementById('saveBtn'),
      testBtn: document.getElementById('testBtn'),
      themeToggle: document.getElementById('themeToggle'),
      togglePassword: document.getElementById('togglePassword'),
      toast: document.getElementById('toast'),
      todayChars: document.getElementById('todayChars'),
      totalChars: document.getElementById('totalChars'),
      apiKeyInputGroup: document.getElementById('apiKeyInputGroup'),
      apiKeySaved: document.getElementById('apiKeySaved'),
      editApiKey: document.getElementById('editApiKey'),
      sidebarStatus: document.getElementById('sidebarStatus')
    };
  }

  bindEvents() {
    this.elements.saveBtn.addEventListener('click', () => this.saveConfig());
    this.elements.testBtn.addEventListener('click', () => this.testConnection());
    this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
    this.elements.togglePassword.addEventListener('click', () => this.togglePasswordVisibility());

    if (this.elements.editApiKey) {
      this.elements.editApiKey.addEventListener('click', () => this.showApiKeyInput());
    }

    this.elements.apiKey.addEventListener('input', () => this.updateConfigStatus());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        this.saveConfig();
      }
    });
  }

  bindStorageEvents() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;

      if (changes.todayChars || changes.totalChars || changes.lastResetDate) {
        this.loadStats();
      }
    });
  }

  async loadConfig() {
    const config = await chrome.storage.local.get(['apiKey', 'voiceType']);

    if (config.apiKey) {
      this.elements.apiKey.value = config.apiKey;
      this.hideApiKeyInput();
      this.updateSidebarStatus('已配置');
    } else {
      this.showApiKeyInput();
      this.updateSidebarStatus('等待配置');
    }

    this.elements.voiceType.value = config.voiceType || this.defaultVoiceType;
    this.updateConfigStatus();
  }

  showApiKeyInput() {
    if (this.elements.apiKeyInputGroup) {
      this.elements.apiKeyInputGroup.style.display = 'block';
    }
    if (this.elements.apiKeySaved) {
      this.elements.apiKeySaved.style.display = 'none';
    }
    this.elements.apiKey.focus();
    this.updateSidebarStatus('待输入');
  }

  hideApiKeyInput() {
    if (this.elements.apiKeyInputGroup) {
      this.elements.apiKeyInputGroup.style.display = 'none';
    }
    if (this.elements.apiKeySaved) {
      this.elements.apiKeySaved.style.display = 'flex';
    }
  }

  async saveConfig() {
    const config = {
      apiKey: this.elements.apiKey.value.trim(),
      voiceType: this.elements.voiceType.value || this.defaultVoiceType
    };

    if (!config.apiKey) {
      this.showToast('请填写 API Key', 'error');
      return;
    }

    try {
      this.setButtonLoading(this.elements.saveBtn, true, '保存中...');
      await chrome.storage.local.set(config);

      try {
        await this.sendMessageWithTimeout({ action: 'save-config', config }, 3000);
      } catch (_) {
        // 后台暂不可用时忽略
      }

      this.hideApiKeyInput();
      this.updateConfigStatus();
      this.updateSidebarStatus('已保存');
      this.showToast('配置保存成功！', 'success');
    } catch (error) {
      this.showToast(`保存失败：${this.getErrorMessage(error)}`, 'error');
    } finally {
      this.setButtonLoading(this.elements.saveBtn, false);
    }
  }

  async testConnection() {
    const config = {
      apiKey: this.elements.apiKey.value.trim(),
      voiceType: this.elements.voiceType.value || this.defaultVoiceType
    };

    if (!config.apiKey) {
      this.showToast('请先填写 API Key', 'error');
      return;
    }

    try {
      this.setButtonLoading(this.elements.testBtn, true, '测试中...');
      await this.testApiDirectly(config);
      this.showToast('✓ API连接成功！', 'success');
      this.updateSidebarStatus('连接正常');
    } catch (error) {
      this.showToast(`连接失败：${this.getErrorMessage(error)}`, 'error');
      this.updateSidebarStatus('连接失败');
    } finally {
      this.setButtonLoading(this.elements.testBtn, false);
    }
  }

  async testApiDirectly(config) {
    const voiceType = config.voiceType || this.defaultVoiceType;
    await this.testApiWithVoiceAndResource(config.apiKey, voiceType, this.resourceId);
  }

  async testApiWithVoiceAndResource(apiKey, voiceType, resourceId) {
    const apiUrl = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
    const requestBody = {
      user: { uid: `settings-test-${Date.now()}` },
      req_params: {
        text: '测试连接',
        speaker: voiceType,
        audio_params: {
          format: 'mp3',
          sample_rate: 24000,
          speech_rate: 0,
          loudness_rate: 0
        }
      }
    };

    const response = await this.fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-Resource-Id': resourceId,
        'X-Api-Request-Id': this.createRequestId()
      },
      body: JSON.stringify(requestBody)
    }, 15000);

    const bodyText = await response.text();

    if (!response.ok) {
      throw this.parseApiError(bodyText, response.status);
    }

    const apiError = this.extractApiErrorFromChunk(bodyText);
    if (apiError) {
      throw this.parseApiError(JSON.stringify(apiError));
    }

    if (!this.hasAudioChunk(bodyText)) {
      throw new Error('接口未返回有效音频数据，请检查账号额度和音色权限');
    }
  }

  extractApiErrorFromChunk(bodyText) {
    const lines = bodyText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const payload = line.startsWith('data:') ? line.slice(5).trim() : line;
      if (!payload.startsWith('{')) continue;

      try {
        const data = JSON.parse(payload);
        if (typeof data.code === 'number' && data.code !== 0 && data.code !== 20000000 && data.code !== 200) {
          return data;
        }
      } catch (_) {
        // ignore
      }
    }
    return null;
  }

  parseApiError(rawText, httpStatus = null) {
    let code = null;
    let message = '';

    try {
      const parsed = JSON.parse(rawText);
      code = parsed.code ?? null;
      message = parsed.message || parsed.msg || '';
    } catch (_) {
      message = rawText || '';
    }

    const mapped = this.mapApiErrorMessage(code, message);
    if (mapped) return new Error(mapped);
    if (httpStatus) {
      return new Error(`HTTP ${httpStatus}：${(message || rawText || '请求失败').slice(0, 180)}`);
    }
    return new Error((message || rawText || '请求失败').slice(0, 180));
  }

  mapApiErrorMessage(code, message) {
    const text = (message || '').toLowerCase();
    if (code === 1001 || text.includes('invalid api key')) return 'API Key 无效，请检查是否填写正确';
    if (code === 1002 || text.includes('resource')) return '资源 ID 不正确或没有权限';
    if (code === 1003 || text.includes('quota') || text.includes('balance')) return '账号额度不足或余额不足';
    if (text.includes('voice') || text.includes('speaker')) return '当前音色不可用，请尝试切换音色';
    if (text.includes('network') || text.includes('fetch')) return '网络请求失败，请检查网络连接';
    if (text.includes('timeout')) return '请求超时，请稍后重试';
    return '';
  }

  async loadStats() {
    try {
      const data = await chrome.storage.local.get(['todayChars', 'totalChars', 'lastResetDate']);
      const today = Number(data.todayChars || 0);
      const total = Number(data.totalChars || 0);

      if (this.elements.todayChars) this.elements.todayChars.textContent = this.formatNumber(today);
      if (this.elements.totalChars) this.elements.totalChars.textContent = this.formatNumber(total);
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  }

  updateConfigStatus() {
    const hasKey = Boolean(this.elements.apiKey.value.trim());
    const statusText = hasKey ? '已就绪' : '待配置';
    if (this.elements.configStatus) this.elements.configStatus.textContent = statusText;
    this.updateSidebarStatus(statusText);
  }

  updateSidebarStatus(text) {
    if (this.elements.sidebarStatus) {
      this.elements.sidebarStatus.textContent = text;
    }
  }

  initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    this.setTheme(savedTheme);
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    this.setTheme(currentTheme === 'light' ? 'dark' : 'light');
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (this.elements.themeToggle) {
      const icon = this.elements.themeToggle.querySelector('.theme-icon');
      if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  togglePasswordVisibility() {
    const input = this.elements.apiKey;
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    if (this.elements.togglePassword) {
      this.elements.togglePassword.textContent = isPassword ? '🙈' : '👁️';
    }
  }

  setButtonLoading(button, isLoading, loadingText = '处理中...') {
    if (!button) return;
    if (isLoading) {
      button.dataset.originalText = button.innerHTML;
      button.innerHTML = `<span class="btn-icon">⏳</span>${loadingText}`;
      button.disabled = true;
      button.classList.add('loading');
    } else {
      if (button.dataset.originalText) button.innerHTML = button.dataset.originalText;
      button.disabled = false;
      button.classList.remove('loading');
    }
  }

  showToast(message, type = 'success') {
    if (!this.elements.toast) return;
    const toast = this.elements.toast;
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  formatNumber(value) {
    return new Intl.NumberFormat('zh-CN').format(value || 0);
  }

  getErrorMessage(error) {
    if (!error) return '未知错误';
    return error.message || String(error);
  }

  async fetchWithTimeout(resource, options = {}, timeout = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(resource, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(id);
    }
  }

  createRequestId() {
    return (self.crypto?.randomUUID?.() || `req-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  }

  hasAudioChunk(bodyText) {
    return /audio|mp3|wav|chunk/i.test(bodyText);
  }

  async sendMessageWithTimeout(message, timeout = 3000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), timeout);
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timer);
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }
}

new SettingsController();

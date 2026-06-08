/**
 * AI-TTS Client - 配置界面逻辑
 * 功能：配置保存/读取、API测试、主题切换、统计显示
 */

class PopupController {
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
      editApiKey: document.getElementById('editApiKey')
    };
  }

  bindEvents() {
    this.elements.saveBtn.addEventListener('click', () => this.saveConfig());
    this.elements.testBtn.addEventListener('click', () => this.testConnection());
    this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
    this.elements.togglePassword.addEventListener('click', () => this.togglePasswordVisibility());
    
    // API Key 修改按钮
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
    const config = await chrome.storage.local.get([
      'apiKey',
      'voiceType'
    ]);

    if (config.apiKey) {
      this.elements.apiKey.value = config.apiKey;
      this.hideApiKeyInput();
    } else {
      this.showApiKeyInput();
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

      // MVP：直接写本地存储，避免依赖后台消息链路导致"无反应"
      await chrome.storage.local.set(config);

      // 尝试通知后台刷新缓存（失败不影响保存结果）
      try {
        await this.sendMessageWithTimeout({ action: 'save-config', config }, 3000);
      } catch (_) {
        // 后台暂不可用时忽略
      }

      // 隐藏输入框，显示已保存状态
      this.hideApiKeyInput();
      
      this.updateConfigStatus();
      this.showToast('配置保存成功！', 'success');

      setTimeout(() => {
        if (window.location.pathname.endsWith('popup.html')) {
          window.close();
        }
      }, 800);
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
    } catch (error) {
      this.showToast(`连接失败：${this.getErrorMessage(error)}`, 'error');
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
      user: {
        uid: `popup-test-${Date.now()}`
      },
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
    if (mapped) {
      return new Error(mapped);
    }

    if (httpStatus) {
      return new Error(`HTTP ${httpStatus}：${(message || rawText || '请求失败').slice(0, 180)}`);
    }

    return new Error((message || rawText || '请求失败').slice(0, 180));
  }

  mapApiErrorMessage(code, message = '') {
    const msg = String(message || '').toLowerCase();

    if (msg.includes('resource id is mismatched with speaker related resource') || msg.includes('mismatched with speaker')) {
      return '当前音色与资源版本不匹配，请切换其他音色再试。';
    }

    if (code === 45000010 || code === 45000000 || msg.includes('speaker permission denied') || msg.includes('access denied')) {
      return '当前音色未授权（或资源未开通），请在控制台开通对应音色权限，或切换其他音色。';
    }

    if (msg.includes('quota exceeded') || msg.includes('lifetime')) {
      return '调用额度不足或试用额度已用完，请到控制台充值/开通套餐。';
    }

    if (msg.includes('concurrency')) {
      return '并发超限，请稍后重试。';
    }

    if (msg.includes('invalid') || msg.includes('unauthorized') || msg.includes('authenticate')) {
      return 'API Key 无效或鉴权失败，请检查 API Key 是否正确。';
    }

    return '';
  }

  hasAudioChunk(bodyText) {
    const lines = bodyText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const payload = line.startsWith('data:') ? line.slice(5).trim() : line;
      if (!payload.startsWith('{')) continue;

      try {
        const data = JSON.parse(payload);
        if (typeof data.data === 'string' && data.data.length > 0) {
          return true;
        }
      } catch (_) {
        // ignore invalid segment
      }
    }

    return false;
  }

  async fetchWithTimeout(url, options, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new Error(`请求超时（>${timeoutMs / 1000}s）`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async sendMessageWithTimeout(message, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      let finished = false;
      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          reject(new Error(`后台响应超时（>${timeoutMs / 1000}s）`));
        }
      }, timeoutMs);

      chrome.runtime.sendMessage(message).then((result) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(result);
        }
      }).catch((error) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          reject(error);
        }
      });
    });
  }

  createRequestId() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `popup-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  setButtonLoading(button, loading, loadingText = '处理中...') {
    if (!button) return;

    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent.trim();
    }

    button.classList.toggle('loading', loading);
    button.disabled = loading;

    if (loading) {
      button.textContent = loadingText;
    } else {
      button.textContent = button.dataset.originalText;
    }
  }

  updateConfigStatus() {
    const hasApiKey = Boolean(this.elements.apiKey.value.trim());

    if (hasApiKey) {
      this.elements.configStatus.textContent = '已就绪';
      this.elements.configStatus.style.color = '';
    } else {
      this.elements.configStatus.textContent = '待配置';
      this.elements.configStatus.style.color = '';
    }
  }

  initTheme() {
    const savedTheme = localStorage.getItem('ai-tts-theme') || 'light';
    this.setTheme(savedTheme);
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
    localStorage.setItem('ai-tts-theme', newTheme);
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = this.elements.themeToggle.querySelector('.theme-icon');
    icon.textContent = theme === 'light' ? '🌙' : '☀️';
  }

  togglePasswordVisibility() {
    const input = this.elements.apiKey;
    const btn = this.elements.togglePassword;

    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
      input.type = 'password';
      btn.textContent = '👁️';
    }
  }

  showToast(message, type = 'info') {
    const toast = this.elements.toast;
    toast.textContent = message;
    toast.className = `toast ${type}`;

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  getErrorMessage(error) {
    if (!error) return '未知错误';
    return error.message || String(error);
  }

  async loadStats() {
    try {
      const stats = await chrome.storage.local.get(['todayChars', 'totalChars', 'lastResetDate']);
      
      const today = new Date().toDateString();
      let todayChars = stats.todayChars || 0;
      let totalChars = stats.totalChars || 0;
      
      // 检查是否需要重置今日统计
      if (stats.lastResetDate !== today) {
        todayChars = 0;
        await chrome.storage.local.set({ 
          todayChars: 0, 
          lastResetDate: today 
        });
      }
      
      // 格式化数字显示
      this.elements.todayChars.textContent = this.formatNumber(todayChars);
      this.elements.totalChars.textContent = this.formatNumber(totalChars);
    } catch (error) {
      console.error('加载统计失败:', error);
      this.elements.todayChars.textContent = '0';
      this.elements.totalChars.textContent = '0';
    }
  }

  formatNumber(num) {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return num.toString();
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

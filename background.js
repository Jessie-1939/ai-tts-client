/**
 * AI-TTS Client - 后台服务脚本
 * 功能：右键菜单管理、API调用、消息转发
 * 设计标准：商业级插件水准
 */

let configCache = null;
const DEFAULT_VOICE_TYPE = 'zh_female_tianmeixiaoyuan_uranus_bigtts';
const RESOURCE_ID = 'seed-tts-2.0';
const DEFAULT_SPEECH_RATE = 0;
const DEFAULT_LOUDNESS_RATE = 0;
const AUDIO_FORMAT = 'mp3';
const LEGACY_MENU_ID = 'doubao-tts-generate';
const CONTEXT_MENU_ROOT_ID = 'doubao-tts-root';
const CONTEXT_MENU_SPEAK_ID = 'doubao-tts-speak-selection';
const CONTEXT_MENU_SEPARATOR_ID = 'doubao-tts-separator';
const CONTEXT_MENU_CONFIG_ID = 'doubao-tts-open-config';
const CONTEXT_MENU_HELP_ID = 'doubao-tts-open-help';
let contextMenuInitPromise = null;

// Service Worker 启动后立即尝试恢复右键菜单，避免仅依赖 install/startup 事件带来的时序问题。
ensureContextMenu().catch((error) => {
  console.error('启动时初始化右键菜单失败：', error?.message || error);
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('🚀 AI-TTS Client 已安装');

  await ensureContextMenu();

  await initDefaultConfig();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureContextMenu();
});

async function ensureContextMenu() {
  if (contextMenuInitPromise) {
    return contextMenuInitPromise;
  }

  contextMenuInitPromise = (async () => {
    try {
      const idsToRemove = [
        LEGACY_MENU_ID,
        CONTEXT_MENU_ROOT_ID,
        CONTEXT_MENU_SPEAK_ID,
        CONTEXT_MENU_SEPARATOR_ID,
        CONTEXT_MENU_CONFIG_ID,
        CONTEXT_MENU_HELP_ID
      ];

      for (const id of idsToRemove) {
        await new Promise((resolve) => {
          chrome.contextMenus.remove(id, () => {
            if (chrome.runtime.lastError) {
              // 忽略未找到菜单项的情况，避免 Unchecked runtime.lastError
            }
            resolve();
          });
        });
      }
    } catch (error) {
      console.warn('清理旧右键菜单失败：', error?.message || error);
    }

    try {
      await new Promise((resolve, reject) => {
        chrome.contextMenus.create({
          id: CONTEXT_MENU_ROOT_ID,
          title: 'AI-TTS',
          contexts: ['all']
        }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          resolve();
        });
      });

      await new Promise((resolve, reject) => {
        chrome.contextMenus.create({
          id: CONTEXT_MENU_SPEAK_ID,
          parentId: CONTEXT_MENU_ROOT_ID,
          title: '朗读选中文本',
          contexts: ['selection']
        }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          resolve();
        });
      });

      await new Promise((resolve) => {
        chrome.contextMenus.create({
          id: CONTEXT_MENU_SEPARATOR_ID,
          parentId: CONTEXT_MENU_ROOT_ID,
          type: 'separator',
          contexts: ['all']
        }, () => resolve());
      });

      await new Promise((resolve) => {
        chrome.contextMenus.create({
          id: CONTEXT_MENU_CONFIG_ID,
          parentId: CONTEXT_MENU_ROOT_ID,
          title: '打开配置面板',
          contexts: ['all']
        }, () => resolve());
      });

      await new Promise((resolve) => {
        chrome.contextMenus.create({
          id: CONTEXT_MENU_HELP_ID,
          parentId: CONTEXT_MENU_ROOT_ID,
          title: '查看使用说明',
          contexts: ['all']
        }, () => resolve());
      });

      console.log('✅ 右键菜单已就绪（父级 + 子菜单）');
    } catch (error) {
      console.error('创建右键菜单失败：', error?.message || error);
      throw error;
    }
  })().finally(() => {
    contextMenuInitPromise = null;
  });

  return contextMenuInitPromise;
}

async function initDefaultConfig() {
  const config = await chrome.storage.local.get([
    'apiKey',
    'voiceType'
  ]);

  if (!config.voiceType) {
    await chrome.storage.local.set({
      voiceType: DEFAULT_VOICE_TYPE
    });
  }

  configCache = await chrome.storage.local.get(['apiKey', 'voiceType']);
}

chrome.storage.onChanged.addListener((changes) => {
  const allowedKeys = new Set(['apiKey', 'voiceType']);
  Object.keys(changes).forEach(key => {
    if (configCache && allowedKeys.has(key)) {
      configCache[key] = changes[key].newValue;
    }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_SPEAK_ID && info.selectionText) {
    await handleTextToSpeech(info.selectionText, tab);
    return;
  }

  if (info.menuItemId === CONTEXT_MENU_CONFIG_ID) {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    return;
  }

  if (info.menuItemId === CONTEXT_MENU_HELP_ID) {
    chrome.tabs.create({ url: chrome.runtime.getURL('README.md') });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'generate-speech':
      handleTextToSpeech(request.text, sender.tab);
      sendResponse({ status: 'processing' });
      return true;
    case 'get-config':
      getConfig()
        .then(config => sendResponse(config))
        .catch(error => sendResponse({ error: error.message || String(error) }));
      return true;
    case 'save-config':
      saveConfig(request.config)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, message: error.message || String(error) }));
      return true;
    case 'test-api':
      testApiConnection(request.config)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, message: error.message || String(error) }));
      return true;
    default:
      sendResponse({ success: false, message: '未知请求动作' });
      return false;
  }
});

async function getConfig() {
  if (!configCache) {
    configCache = await chrome.storage.local.get(['apiKey', 'voiceType']);
  }
  return configCache;
}

async function saveConfig(config) {
  await chrome.storage.local.set(config);
  configCache = { ...configCache, ...config };
}

async function testApiConnection(config) {
  try {
    await callDoubaoTTS('测试语音连接', config);
    return { success: true, message: 'API连接成功！' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function handleTextToSpeech(text, tab) {
  const requestId = createRequestId();
  try {
    const truncatedText = text.slice(0, 5000);

    const targetTab = await ensureValidTab(tab);
    if (!targetTab || typeof targetTab.id !== 'number') {
      throw new Error('未找到可用标签页，请在普通网页中重试');
    }

    await sendMessageToTab(targetTab.id, {
      action: 'show-loading',
      text: truncatedText,
      requestId
    });

    const config = await getConfig();
    const apiKey = config.apiKey;

    if (!apiKey) {
      throw new Error('请先在插件配置中设置 API Key');
    }

    const audioData = await callDoubaoTTS(truncatedText, {
      ...config,
      apiKey
    });

    await updateUsageStats(truncatedText.length);

    await sendMessageToTab(targetTab.id, {
      action: 'play-speech',
      audioData: audioData,
      text: truncatedText,
      config: {
        speed: 1.0,
        volume: 1.0
      },
      requestId
    });
  } catch (error) {
    console.error('语音生成失败:', error);

    try {
      const targetTab = await ensureValidTab(tab);
      if (targetTab && typeof targetTab.id === 'number') {
        await sendMessageToTab(targetTab.id, {
          action: 'show-error',
          message: error.message,
          requestId
        });
      }
    } catch (_) {
      // ignore secondary UI errors
    }
  }
}

async function updateUsageStats(charCount) {
  const safeCount = Number.isFinite(charCount) ? Math.max(0, Math.floor(charCount)) : 0;
  if (safeCount <= 0) return;

  const today = new Date().toDateString();
  const stats = await chrome.storage.local.get(['todayChars', 'totalChars', 'lastResetDate']);

  let todayChars = Number(stats.todayChars) || 0;
  let totalChars = Number(stats.totalChars) || 0;

  if (stats.lastResetDate !== today) {
    todayChars = 0;
  }

  todayChars += safeCount;
  totalChars += safeCount;

  await chrome.storage.local.set({
    todayChars,
    totalChars,
    lastResetDate: today
  });
}

async function ensureValidTab(tab) {
  if (tab && typeof tab.id === 'number') {
    return tab;
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs[0] ? tabs[0] : null;
}

function isRestrictedUrl(url = '') {
  return /^chrome:\/\//i.test(url)
    || /^edge:\/\//i.test(url)
    || /^about:/i.test(url)
    || /^chrome-extension:\/\//i.test(url)
    || /^devtools:\/\//i.test(url)
    || /^view-source:/i.test(url);
}

async function ensureContentInjected(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab || isRestrictedUrl(tab.url || '')) {
    throw new Error('当前页面不支持注入，请在普通网页中使用');
  }

  try {
    await chrome.tabs.sendMessage(tabId, { action: '__ping__' });
    return;
  } catch (_) {
    // continue injection
  }

  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['content.css']
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
}

async function sendMessageToTab(tabId, payload) {
  await ensureContentInjected(tabId);
  await chrome.tabs.sendMessage(tabId, payload);
}

async function callDoubaoTTS(text, config) {
  return await callDoubaoTTSWithResource(text, config, RESOURCE_ID);
}

async function callDoubaoTTSWithResource(text, config, resourceId) {
  const apiUrl = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
  const requestBody = {
    user: {
      uid: 'ai-tts-extension-' + Date.now()
    },
    req_params: {
      text: text,
      speaker: config.voiceType || DEFAULT_VOICE_TYPE,
      audio_params: {
        format: AUDIO_FORMAT,
        sample_rate: 24000,
        speech_rate: DEFAULT_SPEECH_RATE,
        loudness_rate: DEFAULT_LOUDNESS_RATE
      }
    }
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': config.apiKey,
      'X-Api-Resource-Id': resourceId,
      'X-Api-Request-Id': createRequestId()
    },
    body: JSON.stringify(requestBody)
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw parseApiError(bodyText, response.status);
  }

  const chunkError = extractApiErrorFromChunk(bodyText);
  if (chunkError) {
    throw parseApiError(JSON.stringify(chunkError));
  }

  const audioBase64 = extractAudioFromStream(bodyText);

  if (audioBase64) {
    return audioBase64;
  }

  throw new Error(`未获取到音频数据：${bodyText.slice(0, 300)}`);
}


function extractAudioFromStream(bodyText) {
  const audioParts = [];
  const lines = bodyText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  for (const line of lines) {
    const payload = line.startsWith('data:') ? line.slice(5).trim() : line;
    if (!payload.startsWith('{')) continue;

    try {
      const data = JSON.parse(payload);
      if (typeof data.data === 'string' && data.data.length > 0) {
        audioParts.push(data.data);
      }

      if ((data.code === 20000000 || data.code === 200 || data.code === 0) && data.data == null && audioParts.length > 0) {
        break;
      }
    } catch (error) {
      // 忽略不能解析的片段，继续尝试后续行
    }
  }

  return audioParts.join('');
}

function extractApiErrorFromChunk(bodyText) {
  const lines = bodyText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  for (const line of lines) {
    const payload = line.startsWith('data:') ? line.slice(5).trim() : line;
    if (!payload.startsWith('{')) continue;

    try {
      const data = JSON.parse(payload);
      if (typeof data.code === 'number' && data.code !== 0 && data.code !== 20000000 && data.code !== 200) {
        return data;
      }
    } catch (_) {
      // ignore parse failures
    }
  }

  return null;
}

function parseApiError(rawText, httpStatus = null) {
  let code = null;
  let message = '';

  try {
    const parsed = JSON.parse(rawText);
    code = parsed.code ?? null;
    message = parsed.message || parsed.msg || '';
  } catch (_) {
    message = rawText || '';
  }

  const mapped = mapApiErrorMessage(code, message);
  if (mapped) {
    return new Error(mapped);
  }

  if (httpStatus) {
    return new Error(`API请求失败（HTTP ${httpStatus}）：${(message || rawText || '未知错误').slice(0, 180)}`);
  }

  return new Error((message || rawText || '未知错误').slice(0, 180));
}

function mapApiErrorMessage(code, message = '') {
  const msg = String(message || '').toLowerCase();

  if (msg.includes('resource id is mismatched with speaker related resource') || msg.includes('mismatched with speaker')) {
    return '当前音色与资源版本不匹配，请切换其他音色。';
  }

  if (code === 45000010 || code === 45000000 || msg.includes('speaker permission denied') || msg.includes('access denied')) {
    return '当前音色未授权（或资源未开通），请在控制台开通对应音色权限，或切换到可用音色。';
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

function createRequestId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

console.log('✅ AI-TTS 后台服务已启动');

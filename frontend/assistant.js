// ==================== 辅助工具页面 ====================

// ========== 渲染辅助工具页面 ==========
async function renderAssistant() {
  const div = el('div', 'p-4 md:p-8 max-w-4xl mx-auto fade-in');
  
  div.innerHTML = `
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-gray-800 dark:text-white mb-2">🎵 辅助工具</h2>
      <p class="text-gray-500 dark:text-gray-400">提升专注力的小工具</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- 白噪音播放器 -->
      <div class="glass p-6 rounded-2xl">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">🎵 白噪音播放器</h3>
        
        <div class="space-y-4">
          <!-- 音效选择 -->
          <div class="grid grid-cols-3 gap-2">
            <button onclick="playWhiteNoise('rain')" class="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-primary/10 transition-all text-center">
              <div class="text-2xl mb-1">🌧️</div>
              <div class="text-xs text-gray-600 dark:text-gray-400">雨声</div>
            </button>
            <button onclick="playWhiteNoise('forest')" class="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-primary/10 transition-all text-center">
              <div class="text-2xl mb-1">🌲</div>
              <div class="text-xs text-gray-600 dark:text-gray-400">森林</div>
            </button>
            <button onclick="playWhiteNoise('wave')" class="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-primary/10 transition-all text-center">
              <div class="text-2xl mb-1">🌊</div>
              <div class="text-xs text-gray-600 dark:text-gray-400">海浪</div>
            </button>
            <button onclick="playWhiteNoise('cafe')" class="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-primary/10 transition-all text-center">
              <div class="text-2xl mb-1">☕</div>
              <div class="text-xs text-gray-600 dark:text-gray-400">咖啡馆</div>
            </button>
            <button onclick="playWhiteNoise('fire')" class="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-primary/10 transition-all text-center">
              <div class="text-2xl mb-1">🔥</div>
              <div class="text-xs text-gray-600 dark:text-gray-400">篝火</div>
            </button>
            <button onclick="playWhiteNoise('fan')" class="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-primary/10 transition-all text-center">
              <div class="text-2xl mb-1">🌀</div>
              <div class="text-xs text-gray-600 dark:text-gray-400">风扇</div>
            </button>
          </div>
          
          <!-- 音量控制 -->
          <div>
            <label class="text-sm text-gray-600 dark:text-gray-400 mb-2 block">音量</label>
            <input type="range" id="whiteNoiseVolume" min="0" max="100" value="50" 
                   oninput="adjustWhiteNoiseVolume(this.value)"
                   class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700">
          </div>
          
          <!-- 播放控制 -->
          <div class="flex gap-2">
            <button onclick="toggleWhiteNoise()" id="whiteNoiseToggle" 
                    class="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
              ▶️ 播放
            </button>
            <button onclick="stopWhiteNoise()" 
                    class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
              ⏹️ 停止
            </button>
          </div>
        </div>
      </div>

      <!-- 休息提醒 -->
      <div class="glass p-6 rounded-2xl">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">⏰ 休息提醒</h3>
        
        <div class="space-y-4">
          <!-- 20-20-20规则 -->
          <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">👁️ 20-20-20规则</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">每20分钟，看20英尺外的物体20秒，保护视力</p>
            <button onclick="start20Rule()" id="btn20Rule" 
                    class="w-full py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-all">
              开始计时
            </button>
          </div>
          
          <!-- 番茄钟提醒 -->
          <div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">🍅 番茄钟提醒</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">工作25分钟，休息5分钟</p>
            <button onclick="startPomodoroReminder()" id="btnPomodoroReminder" 
                    class="w-full py-2 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-all">
              开始番茄钟
            </button>
          </div>
          
          <!-- 喝水提醒 -->
          <div class="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl">
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">💧 喝水提醒</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">每小时提醒喝水，保持健康</p>
            <button onclick="startWaterReminder()" id="btnWaterReminder" 
                    class="w-full py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition-all">
              开启提醒
            </button>
          </div>
        </div>
      </div>

      <!-- 专注音乐推荐 -->
      <div class="glass p-6 rounded-2xl md:col-span-2">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">🎶 专注音乐推荐</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="https://www.youtube.com/results?search_query=focus+music" target="_blank" 
             class="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all cursor-pointer">
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-1">📺 YouTube</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">专注音乐播放列表</p>
          </a>
          <a href="https://open.spotify.com/search/focus%20music" target="_blank" 
             class="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-all cursor-pointer">
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-1">🎵 Spotify</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">专注 playlist</p>
          </a>
          <a href="https://music.apple.com/search?term=focus" target="_blank" 
             class="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/30 transition-all cursor-pointer">
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-1">🍎 Apple Music</h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">专注音乐</p>
          </a>
        </div>
      </div>
    </div>
  `;

  return div;
}

// ========== 白噪音功能（使用 Web Audio API 合成，无需外部文件）==========
let whiteNoiseAudioCtx = null;
let whiteNoiseSource = null;
let whiteNoiseGain = null;
let whiteNoiseIsPlaying = false;
let whiteNoiseCurrentType = 'rain';
let whiteNoiseBiquadFilter = null;

// 修复: 使用 Web Audio API 合成白噪音，不依赖外部 CDN 音频文件
// Mixkit CDN 已返回 403 Forbidden，因此改为纯合成方案

function getAudioContext() {
  if (!whiteNoiseAudioCtx) {
    whiteNoiseAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // 修复: AudioContext 可能被浏览器自动暂停（autoplay policy）
  if (whiteNoiseAudioCtx.state === 'suspended') {
    whiteNoiseAudioCtx.resume();
  }
  return whiteNoiseAudioCtx;
}

function createNoiseBuffer(ctx, type) {
  const bufferSize = ctx.sampleRate * 4; // 4秒缓冲
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    let sample;
    switch (type) {
      case 'white':
        // 白噪音: 均匀分布随机
        sample = Math.random() * 2 - 1;
        break;
      case 'pink':
        // 粉红噪音: 低频更丰富
        // 使用 Paul Kellet 的算法
        sample = pinkNoiseSample();
        break;
      case 'brown':
        // 布朗噪音: 低频为主
        sample = brownNoiseSample(i, bufferSize);
        break;
      default:
        sample = Math.random() * 2 - 1;
    }
    data[i] = sample;
  }
  return buffer;
}

// 粉红噪音状态
let pinkNoiseState = { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 };
function pinkNoiseSample() {
  const white = Math.random() * 2 - 1;
  pinkNoiseState.b0 = 0.99886 * pinkNoiseState.b0 + white * 0.0555179;
  pinkNoiseState.b1 = 0.99332 * pinkNoiseState.b1 + white * 0.0750759;
  pinkNoiseState.b2 = 0.96900 * pinkNoiseState.b2 + white * 0.1538520;
  pinkNoiseState.b3 = 0.86650 * pinkNoiseState.b3 + white * 0.3104856;
  pinkNoiseState.b4 = 0.55000 * pinkNoiseState.b4 + white * 0.5329522;
  pinkNoiseState.b5 = -0.7616 * pinkNoiseState.b5 - white * 0.0168980;
  const pink = pinkNoiseState.b0 + pinkNoiseState.b1 + pinkNoiseState.b2 + pinkNoiseState.b3 + pinkNoiseState.b4 + pinkNoiseState.b5 + pinkNoiseState.b6 + white * 0.5362;
  pinkNoiseState.b6 = white * 0.115926;
  return pink * 0.11;
}

function brownNoiseSample(i, len) {
  // 布朗噪音: 低频为主，用累积和实现
  return (Math.random() - 0.5) * 0.02;
}

function getNoiseParamsForType(type) {
  // 每种声音类型对应的: { 噪音基底, 低频增益, 高频衰减, 调制频率 }
  const params = {
    rain:     { base: 'pink',  lowpass: 4000,  highpass: 100,  modulate: 0.3 },
    forest:   { base: 'pink',  lowpass: 6000,  highpass: 200,  modulate: 0.5 },
    wave:     { base: 'brown', lowpass: 800,   highpass: 50,   modulate: 0.8 },
    cafe:     { base: 'pink',  lowpass: 5000,  highpass: 300,  modulate: 0.2 },
    fire:     { base: 'brown', lowpass: 1500,  highpass: 80,   modulate: 0.6 },
    fan:      { base: 'white', lowpass: 3000,  highpass: 500,  modulate: 0 },
  };
  return params[type] || params.rain;
}

function playWhiteNoise(type) {
  try {
    const ctx = getAudioContext();
    
    // 停止之前的播放
    stopWhiteNoiseInternal();
    
    whiteNoiseCurrentType = type;
    const params = getNoiseParamsForType(type);
    
    // 创建噪音缓冲
    const buffer = createNoiseBuffer(ctx, params.base);
    whiteNoiseSource = ctx.createBufferSource();
    whiteNoiseSource.buffer = buffer;
    whiteNoiseSource.loop = true;
    
    // 创建滤波器
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = params.lowpass;
    
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = params.highpass;
    
    // 音量控制
    whiteNoiseGain = ctx.createGain();
    const volSlider = document.getElementById('whiteNoiseVolume');
    whiteNoiseGain.gain.value = (volSlider ? parseInt(volSlider.value) : 50) / 100;
    
    // 连接节点: source -> lowpass -> highpass -> gain -> output
    whiteNoiseSource.connect(lowpass);
    lowpass.connect(highpass);
    highpass.connect(whiteNoiseGain);
    whiteNoiseGain.connect(ctx.destination);
    
    // 调制效果（对特定音效添加低频调制，模拟自然变化）
    if (params.modulate > 0 && type === 'wave') {
      // 海浪: 使用 LFO 调制音量模拟波浪起伏
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.1; // 每10秒一个周期
      lfoGain.gain.value = 0.3;
      lfo.connect(lfoGain);
      lfoGain.connect(whiteNoiseGain.gain);
      lfo.start();
      whiteNoiseLFO = lfo;
    }
    
    whiteNoiseSource.start();
    whiteNoiseIsPlaying = true;
    
    document.getElementById('whiteNoiseToggle').innerHTML = '⏸️ 暂停';
    showToast(`正在播放: ${type}`, 'success');
  } catch (err) {
    console.error('白噪音播放失败:', err);
    showToast('音频播放失败: ' + err.message + '。请检查浏览器音频权限。', 'error');
  }
}

let whiteNoiseLFO = null;

function stopWhiteNoiseInternal() {
  try {
    if (whiteNoiseLFO) {
      whiteNoiseLFO.stop();
      whiteNoiseLFO = null;
    }
    if (whiteNoiseSource) {
      whiteNoiseSource.stop();
      whiteNoiseSource.disconnect();
      whiteNoiseSource = null;
    }
    if (whiteNoiseGain) {
      whiteNoiseGain.disconnect();
      whiteNoiseGain = null;
    }
  } catch (e) {
    // 忽略停止时的错误（可能已断开）
  }
  whiteNoiseIsPlaying = false;
}

function toggleWhiteNoise() {
  try {
    if (!whiteNoiseIsPlaying) {
      playWhiteNoise(whiteNoiseCurrentType);
    } else {
      // 暂停: 断开音频源但保留 AudioContext
      if (whiteNoiseAudioCtx && whiteNoiseAudioCtx.state === 'running') {
        whiteNoiseAudioCtx.suspend();
      }
      whiteNoiseIsPlaying = false;
      document.getElementById('whiteNoiseToggle').innerHTML = '▶️ 播放';
    }
  } catch (err) {
    console.error('切换播放状态失败:', err);
    showToast('操作失败: ' + err.message, 'error');
  }
}

function stopWhiteNoise() {
  stopWhiteNoiseInternal();
  if (whiteNoiseAudioCtx) {
    whiteNoiseAudioCtx.close();
    whiteNoiseAudioCtx = null;
  }
  document.getElementById('whiteNoiseToggle').innerHTML = '▶️ 播放';
}

function adjustWhiteNoiseVolume(value) {
  if (whiteNoiseGain) {
    whiteNoiseGain.gain.value = value / 100;
  }
}

// ========== 休息提醒功能 ==========
let reminderIntervals = {};

function start20Rule() {
  if (reminderIntervals['20rule']) {
    clearInterval(reminderIntervals['20rule']);
    delete reminderIntervals['20rule'];
    document.getElementById('btn20Rule').innerHTML = '开始计时';
    showToast('20-20-20提醒已关闭', 'info');
    return;
  }
  
  let minutes = 20;
  document.getElementById('btn20Rule').innerHTML = `⏱️ ${minutes}:00`;
  
  reminderIntervals['20rule'] = setInterval(() => {
    minutes--;
    if (minutes <= 0) {
      // 提醒
      if (Notification.permission === 'granted') {
        new Notification('👁️ 20-20-20提醒', {
          body: '该休息一下眼睛了！看20英尺外的物体20秒',
          icon: '/icon-192.png'
        });
      } else {
        showToast('👁️ 该休息一下眼睛了！看20英尺外的物体20秒', 'info');
      }
      minutes = 20;
      document.getElementById('btn20Rule').innerHTML = `⏱️ ${minutes}:00`;
    } else {
      document.getElementById('btn20Rule').innerHTML = `⏱️ ${minutes}:00`;
    }
  }, 60000); // 每分钟检查一次
  
  showToast('20-20-20提醒已开启', 'success');
}

function startPomodoroReminder() {
  if (reminderIntervals['pomodoro']) {
    clearInterval(reminderIntervals['pomodoro']);
    delete reminderIntervals['pomodoro'];
    document.getElementById('btnPomodoroReminder').innerHTML = '开始番茄钟';
    showToast('番茄钟提醒已关闭', 'info');
    return;
  }
  
  let seconds = 25 * 60; // 25分钟
  updatePomodoroButton(seconds);
  
  reminderIntervals['pomodoro'] = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      // 提醒休息
      if (Notification.permission === 'granted') {
        new Notification('🍅 番茄钟', {
          body: '工作时间结束！休息5分钟吧',
          icon: '/icon-192.png'
        });
      } else {
        showToast('🍅 工作时间结束！休息5分钟吧', 'info');
      }
      seconds = 25 * 60; // 重置
    }
    updatePomodoroButton(seconds);
  }, 1000);
  
  showToast('番茄钟提醒已开启', 'success');
}

function updatePomodoroButton(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  document.getElementById('btnPomodoroReminder').innerHTML = 
    `⏱️ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function startWaterReminder() {
  if (reminderIntervals['water']) {
    clearInterval(reminderIntervals['water']);
    delete reminderIntervals['water'];
    document.getElementById('btnWaterReminder').innerHTML = '开启提醒';
    showToast('喝水提醒已关闭', 'info');
    return;
  }
  
  reminderIntervals['water'] = setInterval(() => {
    if (Notification.permission === 'granted') {
      new Notification('💧 喝水提醒', {
        body: '该喝水了！保持身体水分充足',
        icon: '/icon-192.png'
      });
    } else {
      showToast('💧 该喝水了！', 'info');
    }
  }, 3600000); // 每小时
  
  // 请求通知权限
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
  
  showToast('喝水提醒已开启（每小时）', 'success');
}

// 暴露函数到全局
window.renderAssistant = renderAssistant;
// 修复: 暴露清理函数，在离开页面时由 app.js 的 initPageInteractions 调用
window.cleanupReminders = function() {
  Object.keys(reminderIntervals).forEach(function(key) {
    clearInterval(reminderIntervals[key]);
    delete reminderIntervals[key];
  });
};

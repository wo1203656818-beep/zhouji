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
          
          <!-- 隐藏音频元素 -->
          <audio id="wn-audio-rain" loop preload="auto" src="audio/rain.mp3" style="display:none"></audio>
          <audio id="wn-audio-forest" loop preload="auto" src="audio/forest.mp3" style="display:none"></audio>
          <audio id="wn-audio-wave" loop preload="auto" src="audio/wave.mp3" style="display:none"></audio>
          <audio id="wn-audio-cafe" loop preload="auto" src="audio/cafe.mp3" style="display:none"></audio>
          <audio id="wn-audio-fire" loop preload="auto" src="audio/fire.mp3" style="display:none"></audio>
          <audio id="wn-audio-fan" loop preload="auto" src="audio/fan.mp3" style="display:none"></audio>
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

      <!-- 专注音乐推荐（网易云音乐搜索） -->
      <div class="glass p-6 rounded-2xl md:col-span-2">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">🎶 专注音乐（网易云音乐）</h3>
        
        <!-- 搜索栏 -->
        <div class="flex gap-2 mb-4">
          <input type="text" id="music-search-input" placeholder="搜索歌曲（如：轻音乐、安静、专注）..." 
                 class="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:border-primary outline-none transition-all"
                 onkeypress="if(event.key==='Enter') searchMusic()">
          <button onclick="searchMusic()" class="px-6 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all touch-btn">
            <i class="fas fa-search mr-1"></i>搜索
          </button>
        </div>

        <!-- 播放器 -->
        <div id="music-player" class="mb-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600" style="display:none">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-r from-red-400 to-blue-500 flex items-center justify-center text-white">
              <i class="fas fa-music"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p id="music-player-title" class="text-sm font-medium text-gray-800 dark:text-white truncate">未选择音乐</p>
              <p id="music-player-status" class="text-xs text-gray-500 dark:text-gray-400">搜索并选择歌曲播放</p>
            </div>
            <button onclick="closeMusicPlayer()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div id="music-player-container" style="display:none">
            <iframe id="music-iframe" class="w-full h-20 rounded-lg" frameborder="0" allow="autoplay" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
          </div>
        </div>

        <!-- 搜索结果 -->
        <div id="music-search-results" class="space-y-2 max-h-96 overflow-y-auto"></div>
        
        <!-- 推荐提示 -->
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-3">
          <i class="fas fa-info-circle mr-1"></i>搜索网易云音乐歌曲，点击即可播放。建议搜索"轻音乐""白噪音""专注"等关键词
        </p>
      </div>
    </div>
  `;

  return div;
}

// ========== 白噪音功能（使用本地高质量音频文件）==========
let whiteNoiseCurrentType = 'rain';
let whiteNoiseIsPlaying = false;

function playWhiteNoise(type) {
  ['rain','forest','wave','cafe','fire','fan'].forEach(t => {
    var a = document.getElementById('wn-audio-' + t);
    if (a) { a.pause(); a.currentTime = 0; }
  });
  whiteNoiseCurrentType = type;
  var audio = document.getElementById('wn-audio-' + type);
  if (!audio) return;
  audio.play().then(() => {
    whiteNoiseIsPlaying = true;
    updateWhiteNoiseUI(true);
  }).catch(err => {
    console.error('播放失败:', err);
    showToast('播放失败，请点击页面后重试', 'error');
  });
}

function toggleWhiteNoise() {
  var audio = document.getElementById('wn-audio-' + whiteNoiseCurrentType);
  if (!audio) return;
  if (whiteNoiseIsPlaying) { audio.pause(); whiteNoiseIsPlaying = false; }
  else { audio.play().then(() => { whiteNoiseIsPlaying = true; }).catch(err => console.error(err)); }
  updateWhiteNoiseUI(whiteNoiseIsPlaying);
}

function stopWhiteNoise() {
  ['rain','forest','wave','cafe','fire','fan'].forEach(t => {
    var a = document.getElementById('wn-audio-' + t);
    if (a) { a.pause(); a.currentTime = 0; }
  });
  whiteNoiseIsPlaying = false;
  updateWhiteNoiseUI(false);
}

function adjustWhiteNoiseVolume(value) {
  var vol = parseInt(value) / 100;
  ['rain','forest','wave','cafe','fire','fan'].forEach(t => {
    var a = document.getElementById('wn-audio-' + t);
    if (a) a.volume = vol;
  });
}

function updateWhiteNoiseUI(playing) {
  var btn = document.getElementById('whiteNoiseToggle');
  if (!btn) return;
  btn.innerHTML = playing ? '⏸️ 暂停' : '▶️ 播放';
  btn.className = 'flex-1 py-2 rounded-xl text-sm font-medium transition-all ' + (playing ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' : 'bg-primary text-white');
}

window.addEventListener('beforeunload', stopWhiteNoise);
document.addEventListener('visibilitychange', function() { if (document.hidden) stopWhiteNoise(); });

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
window.playWhiteNoise = playWhiteNoise;
window.toggleWhiteNoise = toggleWhiteNoise;
window.stopWhiteNoise = stopWhiteNoise;
window.adjustWhiteNoiseVolume = adjustWhiteNoiseVolume;
window.start20Rule = start20Rule;
window.startPomodoroReminder = startPomodoroReminder;
window.startWaterReminder = startWaterReminder;

// ========== 网易云音乐搜索播放器 ==========
// 搜索音乐
window.searchMusic = async function() {
  const keyword = document.getElementById('music-search-input')?.value?.trim();
  if (!keyword) {
    showToast('请输入搜索关键词', 'warning');
    return;
  }
  
  showToast('正在搜索...', 'info');
  
  try {
    const resp = await api.get(`/api/music/search?keyword=${encodeURIComponent(keyword)}`);
    
    if (!resp.songs || resp.songs.length === 0) {
      document.getElementById('music-search-results').innerHTML = `
        <div class="text-center py-8 text-gray-400">
          <i class="fas fa-music text-4xl mb-2"></i>
          <p>未找到相关歌曲，请尝试其他关键词</p>
        </div>
      `;
      showToast('未找到相关歌曲', 'info');
      return;
    }
    
    // 渲染搜索结果
    document.getElementById('music-search-results').innerHTML = resp.songs.map(song => `
      <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 hover:border-primary/50 cursor-pointer transition-all"
           onclick="playSong('${song.id}', '${song.name.replace(/'/g, "\\'")}', '${song.artists.replace(/'/g, "\\'")}', '${song.embedUrl.replace(/'/g, "\\'")}')">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <i class="fas fa-play"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-800 dark:text-white truncate">${song.name}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${song.artists} · ${song.album}</p>
          </div>
          <div class="text-xs text-gray-400">${Math.floor(song.duration/1000/60)}:${String(Math.floor(song.duration/1000%60)).padStart(2,'0')}</div>
        </div>
      </div>
    `).join('');
    
    showToast(`找到 ${resp.songs.length} 首歌曲`, 'success');
  } catch (err) {
    console.error('搜索音乐失败:', err);
    document.getElementById('music-search-results').innerHTML = `
      <div class="text-center py-8 text-gray-400">
        <i class="fas fa-exclamation-circle text-4xl mb-2"></i>
        <p>搜索失败: ${err.message}</p>
      </div>
    `;
    showToast('搜索失败', 'error');
  }
};

// 播放歌曲
window.playSong = function(id, name, artists, embedUrl) {
  const player = document.getElementById('music-player');
  const container = document.getElementById('music-player-container');
  const iframe = document.getElementById('music-iframe');
  
  player.style.display = 'block';
  container.style.display = 'block';
  iframe.src = embedUrl;
  
  document.getElementById('music-player-title').textContent = `${name} - ${artists}`;
  document.getElementById('music-player-status').textContent = '正在播放...';
  
  // 滚动到播放器
  player.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

// 关闭播放器
window.closeMusicPlayer = function() {
  const player = document.getElementById('music-player');
  const container = document.getElementById('music-player-container');
  const iframe = document.getElementById('music-iframe');
  
  iframe.src = '';
  container.style.display = 'none';
  player.style.display = 'none';
};

// 修复: 暴露清理函数，在离开页面时由 app.js 的 initPageInteractions 调用
window.cleanupReminders = function() {
  Object.keys(reminderIntervals).forEach(function(key) {
    clearInterval(reminderIntervals[key]);
    delete reminderIntervals[key];
  });
};

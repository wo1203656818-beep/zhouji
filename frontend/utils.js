/**
 * 周迹 - 纯工具函数模块
 * 所有无副作用的纯函数集中管理，便于单元测试
 */

// ==================== 辅助函数 ====================

export function getCategoryIcon(cat) {
  const map = { work: 'briefcase', study: 'book', health: 'heartbeat', life: 'home', social: 'users', general: 'circle' };
  return map[cat] || 'circle';
}

export function getStatusStyle(status) {
  const map = {
    pending: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    in_progress: 'bg-primary/10 text-primary dark:bg-primary/20',
    completed: 'bg-secondary/10 text-secondary dark:bg-secondary/20',
    archived: 'bg-gray-100 text-gray-400 dark:bg-gray-700'
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

export function getStatusLabel(status) {
  const map = { pending: '待启动', in_progress: '进行中', completed: '已完成', archived: '已归档' };
  return map[status] || status;
}

export function getEmotionEmoji(type) {
  const map = {
    vague: '🌫️', fear: '😰', boring: '😴', distracted: '📱',
    tired: '😫', anxious: '😣', confident: '💪', calm: '😌'
  };
  return map[type] || '😐';
}

export function getEmotionLabel(type) {
  const map = {
    vague: '任务太模糊', fear: '害怕失败', boring: '太无聊',
    distracted: '被其他事吸引', tired: '身体疲惫', anxious: '焦虑不安',
    confident: '充满信心', calm: '平静'
  };
  return map[type] || type;
}

export function getEmotionCBT(type) {
  const map = {
    vague: '你不需要想清楚全部，只需要想清楚下一步。',
    fear: '开始10分钟的价值，是打破"我不行"的预言。',
    boring: '给它一个2分钟的尝试，无聊感常在启动后消失。',
    distracted: '诱惑是信号，不是命令。先完成2分钟契约。',
    tired: '低能量时做低难度步骤，也是胜利。',
    anxious: '焦虑是未开始的信号，不是停止的理由。',
    confident: '保持这个能量，选择一个任务启动吧！',
    calm: '平静是行动的最佳土壤，选一个任务开始。'
  };
  return map[type] || '开始行动，哪怕只有2分钟。';
}

export function getPriorityLabel(priority) {
  const map = {
    1: '🔴 紧急重要', 2: '🟠 紧急不重要', 3: '🟡 重要不紧急',
    4: '🟢 不紧急不重要', 5: '⚪ 可延期'
  };
  return map[priority] || '未设置';
}

export function getPriorityStyle(priority) {
  const map = {
    1: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    2: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    3: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    4: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    5: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
  };
  return map[priority] || 'bg-gray-100 text-gray-700';
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function formatWeeklyReportText(report) {
  if (!report) return '';
  const stats = report.achievements || {};
  return `📊 周迹 · 本周周报
📅 ${report.period || 'N/A'}

🏆 成就: ${stats.unlockedCount || 0} 个解锁
⭐ 积分: ${stats.totalPoints || 0} 分
📈 完成率: ${stats.completionRate || 0}%

—— 周迹 · CBT拖延症干预系统`;
}

export function addShareButtonToAchievement(achievement) {
  if (!achievement) return '';
  const json = JSON.stringify(achievement).replace(/"/g, '&quot;').replace(/'/g, "\\'");
  return `<button onclick="showSharePanel('achievement', ${json})" class="px-3 py-1.5 rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-all touch-btn">
    <i class="fas fa-share-alt mr-1"></i>分享
  </button>`;
}

export function generateStrategies(patterns) {
  if (!patterns) return '<p>• 继续记录你的情绪和拖延日志，数据越多，建议越精准。</p>';
  const suggestions = [];
  const p = patterns;

  if (p.reasonDistribution?.length > 0) {
    const topReason = p.reasonDistribution[0].reason_type;
    if (topReason === 'vague') suggestions.push('• 你的主要拖延原因是"任务太模糊"——每次创建任务时，强制添加至少2个原子步骤。');
    if (topReason === 'fear') suggestions.push('• 你经常因"害怕失败"而拖延——试试"降级完成"策略：允许自己产出60分版本。');
    if (topReason === 'distracted') suggestions.push('• 你容易被其他事情吸引——启动任务前开启手机勿扰模式。');
    if (topReason === 'tired') suggestions.push('• 你常在疲惫时拖延——把最难任务安排在精力最好的时段（通常是上午）。');
  }

  if (p.weekdayDistribution?.length > 0) {
    const maxDay = p.weekdayDistribution.reduce((a, b) => a.count > b.count ? a : b);
    suggestions.push(`• 你在${maxDay.weekday}最容易拖延——提前在前一天晚上准备好"下一个动作"。`);
  }

  const taskRate = p.taskCompletionRate;
  const completionRate = taskRate?.total > 0 ? (taskRate.completed / taskRate.total) : 0;
  if (completionRate < 0.3) suggestions.push('• 你的任务完成率较低——不要创建超过3个待办任务，减少选择负担。');

  const microStats = p.microStartSuccess;
  if (microStats?.total > 0 && (microStats.continued_count / microStats.total) < 0.2) {
    suggestions.push('• 你很少在2分钟后继续——这很正常！2分钟本身就是胜利，不要给自己压力。');
  }

  const pomoStats = p.pomodoroStats;
  if (pomoStats?.total > 0 && (pomoStats.completed / pomoStats.total) < 0.5) {
    suggestions.push('• 番茄钟完成率较低——试试从15分钟开始，逐步增加专注时长。');
  }

  if (!suggestions.length) suggestions.push('• 继续记录你的情绪和拖延日志，数据越多，建议越精准。');
  return suggestions.map(s => `<p>${s}</p>`).join('');
}

export function debounce(fn, ms = 300) {
  let t;
  return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}

// ==================== 静态数据 ====================

export const SYSTEM_TEMPLATES = {
  cbt: {
    name: 'CBT 思维记录',
    icon: 'fa-brain',
    color: 'primary',
    fields: [
      { key: 'cbt_thought', label: '自动思维', placeholder: '当时脑子里在想什么？', icon: 'fa-lightbulb' },
      { key: 'cbt_emotion', label: '情绪感受', placeholder: '感受到什么情绪？多强？1-10', icon: 'fa-heart' },
      { key: 'cbt_behavior', label: '行为反应', placeholder: '你做了什么？或不做什么？', icon: 'fa-running' },
      { key: 'cbt_reframe', label: '思维重构', placeholder: '更平衡的想法是什么？', icon: 'fa-sync' }
    ]
  },
  gratitude: {
    name: '感恩日记',
    icon: 'fa-star',
    color: 'green',
    fields: [
      { key: 'gratitude_1', label: '今天最感恩的一件事', placeholder: '描述今天让你感到感恩的事情...', icon: 'fa-star' },
      { key: 'gratitude_2', label: '感恩的人', placeholder: '今天谁让你感到温暖？', icon: 'fa-user-friends' },
      { key: 'gratitude_3', label: '对自己的感恩', placeholder: '今天有什么值得肯定自己的？', icon: 'fa-hand-holding-heart' },
      { key: 'gratitude_reflection', label: '感恩感悟', placeholder: '这些感恩让你意识到了什么？', icon: 'fa-feather' }
    ]
  },
  reflection: {
    name: '每日反思',
    icon: 'fa-compass',
    color: 'blue',
    fields: [
      { key: 'reflection_good', label: '今天做得好的', placeholder: '今天有什么事做得不错？', icon: 'fa-check-circle' },
      { key: 'reflection_bad', label: '可以改进的', placeholder: '哪些地方可以做得更好？', icon: 'fa-exclamation-circle' },
      { key: 'reflection_learn', label: '今天学到的', placeholder: '今天有什么新发现或领悟？', icon: 'fa-graduation-cap' },
      { key: 'reflection_tomorrow', label: '明天的计划', placeholder: '明天想怎样改进？', icon: 'fa-calendar-check' }
    ]
  },
  procrastination: {
    name: '拖延分析',
    icon: 'fa-clock',
    color: 'orange',
    fields: [
      { key: 'proc_task', label: '拖延的任务', placeholder: '你在拖延什么任务？', icon: 'fa-clock' },
      { key: 'proc_reason', label: '拖延原因', placeholder: '为什么不想做？害怕什么？', icon: 'fa-search' },
      { key: 'proc_feeling', label: '拖延时的感受', placeholder: '拖延时你有什么感觉？', icon: 'fa-frown' },
      { key: 'proc_smallest', label: '最小第一步', placeholder: '你能做的最小一步是什么？', icon: 'fa-shoe-prints' },
      { key: 'proc_commitment', label: '行动承诺', placeholder: '我承诺在___分钟内完成这第一步', icon: 'fa-handshake' }
    ]
  },
  anxiety: {
    name: '焦虑缓解',
    icon: 'fa-shield-alt',
    color: 'purple',
    fields: [
      { key: 'anxiety_trigger', label: '焦虑触发点', placeholder: '什么让你感到焦虑？', icon: 'fa-bolt' },
      { key: 'anxiety_worst', label: '最坏的情况', placeholder: '你担心最坏会怎样？', icon: 'fa-cloud-showers-heavy' },
      { key: 'anxiety_probability', label: '实际可能性', placeholder: '这种情况真正发生的概率有多大？', icon: 'fa-percentage' },
      { key: 'anxiety_cope', label: '应对策略', placeholder: '如果真的发生了，你能怎样应对？', icon: 'fa-shield-alt' },
      { key: 'anxiety_action', label: '当下行动', placeholder: '现在你能做的一件有用的事是什么？', icon: 'fa-play' }
    ]
  }
};

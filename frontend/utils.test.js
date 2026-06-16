/**
 * 周迹 - 单元测试 (Vitest)
 *
 * 覆盖所有纯函数：正常/边界/异常情况
 * 运行: npx vitest run
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCategoryIcon,
  getStatusStyle,
  getStatusLabel,
  getEmotionEmoji,
  getEmotionLabel,
  getEmotionCBT,
  getPriorityLabel,
  getPriorityStyle,
  formatDate,
  formatWeeklyReportText,
  addShareButtonToAchievement,
  generateStrategies,
  debounce,
  SYSTEM_TEMPLATES
} from './utils.js';

// ============================================================
// 1. getCategoryIcon — 任务分类图标映射
// ============================================================
describe('getCategoryIcon', () => {
  // 正常情况：每个已知分类返回正确图标
  it.each([
    ['work', 'briefcase'],
    ['study', 'book'],
    ['health', 'heartbeat'],
    ['life', 'home'],
    ['social', 'users'],
    ['general', 'circle'],
  ])('returns "%s" for category "%s"', (cat, expected) => {
    expect(getCategoryIcon(cat)).toBe(expected);
  });

  // 边界：未知分类返回默认
  it('returns "circle" for unknown category', () => {
    expect(getCategoryIcon('unknown')).toBe('circle');
  });

  // 边界：空字符串
  it('returns "circle" for empty string', () => {
    expect(getCategoryIcon('')).toBe('circle');
  });

  // 边界：null / undefined
  it('returns "circle" for null', () => {
    expect(getCategoryIcon(null)).toBe('circle');
  });
  it('returns "circle" for undefined', () => {
    expect(getCategoryIcon(undefined)).toBe('circle');
  });

  // 边界：大小写敏感
  it('is case sensitive — "Work" returns default', () => {
    expect(getCategoryIcon('Work')).toBe('circle');
  });
});

// ============================================================
// 2. getStatusStyle — 任务状态样式映射
// ============================================================
describe('getStatusStyle', () => {
  it.each([
    ['pending', 'bg-gray-100 text-gray-600'],
    ['in_progress', 'bg-primary/10 text-primary'],
    ['completed', 'bg-secondary/10 text-secondary'],
    ['archived', 'bg-gray-100 text-gray-400'],
  ])('returns correct style for "%s"', (status, expectedPartial) => {
    expect(getStatusStyle(status)).toContain(expectedPartial);
  });

  it('returns default for unknown status', () => {
    expect(getStatusStyle('unknown')).toBe('bg-gray-100 text-gray-600');
  });

  // 边界
  it('returns default for empty string', () => {
    expect(getStatusStyle('')).toBe('bg-gray-100 text-gray-600');
  });
  it('returns default for null', () => {
    expect(getStatusStyle(null)).toBe('bg-gray-100 text-gray-600');
  });
});

// ============================================================
// 3. getStatusLabel — 任务状态中文标签
// ============================================================
describe('getStatusLabel', () => {
  it.each([
    ['pending', '待启动'],
    ['in_progress', '进行中'],
    ['completed', '已完成'],
    ['archived', '已归档'],
  ])('returns "%s" for status "%s"', (status, label) => {
    expect(getStatusLabel(status)).toBe(label);
  });

  it('returns input for unknown status (passthrough)', () => {
    expect(getStatusLabel('unknown_status')).toBe('unknown_status');
  });

  // 边界
  it('returns empty for empty string', () => {
    expect(getStatusLabel('')).toBe('');
  });
  it('returns null for null', () => {
    expect(getStatusLabel(null)).toBe(null);
  });
});

// ============================================================
// 4. getEmotionEmoji — 情绪表情映射
// ============================================================
describe('getEmotionEmoji', () => {
  it.each([
    ['vague', '🌫️'],
    ['fear', '😰'],
    ['boring', '😴'],
    ['distracted', '📱'],
    ['tired', '😫'],
    ['anxious', '😣'],
    ['confident', '💪'],
    ['calm', '😌'],
  ])('returns "%s" for emotion "%s"', (type, emoji) => {
    expect(getEmotionEmoji(type)).toBe(emoji);
  });

  it('returns default "😐" for unknown type', () => {
    expect(getEmotionEmoji('unknown')).toBe('😐');
  });

  // 边界
  it('returns default for null', () => {
    expect(getEmotionEmoji(null)).toBe('😐');
  });
  it('returns default for empty string', () => {
    expect(getEmotionEmoji('')).toBe('😐');
  });
});

// ============================================================
// 5. getEmotionLabel — 情绪中文标签
// ============================================================
describe('getEmotionLabel', () => {
  it.each([
    ['vague', '任务太模糊'],
    ['fear', '害怕失败'],
    ['boring', '太无聊'],
    ['distracted', '被其他事吸引'],
    ['tired', '身体疲惫'],
    ['anxious', '焦虑不安'],
    ['confident', '充满信心'],
    ['calm', '平静'],
  ])('returns "%s" for emotion "%s"', (type, label) => {
    expect(getEmotionLabel(type)).toBe(label);
  });

  it('returns input for unknown type', () => {
    expect(getEmotionLabel('something_else')).toBe('something_else');
  });
});

// ============================================================
// 6. getEmotionCBT — 情绪 CBT 干预
// ============================================================
describe('getEmotionCBT', () => {
  it.each([
    ['vague', '你不需要想清楚全部'],
    ['fear', '开始10分钟的价值'],
    ['boring', '给它一个2分钟的尝试'],
    ['distracted', '诱惑是信号'],
    ['tired', '低能量时做低难度步骤'],
    ['anxious', '焦虑是未开始的信号'],
    ['confident', '保持这个能量'],
    ['calm', '平静是行动的最佳土壤'],
  ])('returns CBT text for "%s"', (type, expectedPartial) => {
    expect(getEmotionCBT(type)).toContain(expectedPartial);
  });

  it('returns default CBT for unknown type', () => {
    expect(getEmotionCBT('unknown')).toBe('开始行动，哪怕只有2分钟。');
  });

  // 所有已知类型都有正确CBT
  it('all known emotion types have CBT text', () => {
    const knownTypes = ['vague', 'fear', 'boring', 'distracted', 'tired', 'anxious', 'confident', 'calm'];
    knownTypes.forEach(type => {
      const result = getEmotionCBT(type);
      expect(result.length).toBeGreaterThan(5);
    });
  });
});

// ============================================================
// 7. getPriorityLabel — 优先级中文标签
// ============================================================
describe('getPriorityLabel', () => {
  it.each([
    [1, '🔴 紧急重要'],
    [2, '🟠 紧急不重要'],
    [3, '🟡 重要不紧急'],
    [4, '🟢 不紧急不重要'],
    [5, '⚪ 可延期'],
  ])('returns "%s" for priority %d', (prio, label) => {
    expect(getPriorityLabel(prio)).toBe(label);
  });

  it('returns "未设置" for unknown priority', () => {
    expect(getPriorityLabel(99)).toBe('未设置');
  });

  // 边界
  it('returns "未设置" for 0', () => {
    expect(getPriorityLabel(0)).toBe('未设置');
  });
  it('returns "未设置" for negative numbers', () => {
    expect(getPriorityLabel(-1)).toBe('未设置');
  });
  it('returns "未设置" for null', () => {
    expect(getPriorityLabel(null)).toBe('未设置');
  });
  it('returns "未设置" for string input', () => {
    expect(getPriorityLabel('urgent')).toBe('未设置');
  });
});

// ============================================================
// 8. getPriorityStyle — 优先级样式
// ============================================================
describe('getPriorityStyle', () => {
  it.each([
    [1, 'bg-red-100'],
    [2, 'bg-orange-100'],
    [3, 'bg-yellow-100'],
    [4, 'bg-green-100'],
    [5, 'bg-gray-100'],
  ])('returns style containing "%s" for priority %d', (prio, expectedPartial) => {
    expect(getPriorityStyle(prio)).toContain(expectedPartial);
  });

  it('returns default for unknown priority', () => {
    expect(getPriorityStyle(99)).toBe('bg-gray-100 text-gray-700');
  });
  it('returns default for null', () => {
    expect(getPriorityStyle(null)).toBe('bg-gray-100 text-gray-700');
  });
});

// ============================================================
// 9. formatDate — 日期格式化
// ============================================================
describe('formatDate', () => {
  it('formats valid date string', () => {
    const result = formatDate('2024-03-15');
    expect(result).toBe('3月15日');
  });

  it('formats ISO datetime string', () => {
    const result = formatDate('2024-12-25T10:30:00Z');
    expect(result).toBe('12月25日');
  });

  it('returns empty string for null', () => {
    expect(formatDate(null)).toBe('');
  });
  it('returns empty string for undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });
  it('returns empty string for empty string', () => {
    expect(formatDate('')).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('');
  });

  it('handles timestamp number', () => {
    const ts = new Date('2024-06-01').getTime();
    const result = formatDate(ts);
    expect(result).toBe('6月1日');
  });
});

// ============================================================
// 10. formatWeeklyReportText — 周报文字格式化
// ============================================================
describe('formatWeeklyReportText', () => {
  const sampleReport = {
    period: '06/10-06/16',
    achievements: { unlockedCount: 3, totalPoints: 150, completionRate: 60 }
  };

  it('returns formatted report with all stats', () => {
    const text = formatWeeklyReportText(sampleReport);
    expect(text).toContain('06/10-06/16');
    expect(text).toContain('3 个解锁');
    expect(text).toContain('150 分');
    expect(text).toContain('60%');
    expect(text).toContain('周迹');
  });

  // 边界：空成就对象
  it('handles missing achievements', () => {
    const text = formatWeeklyReportText({ period: 'test' });
    expect(text).toContain('0 个解锁');
    expect(text).toContain('0 分');
  });

  // 边界：未定义统计字段
  it('handles undefined stats', () => {
    const text = formatWeeklyReportText({ period: 'test', achievements: {} });
    expect(text).toContain('0 个解锁');
    expect(text).toContain('0 分');
  });

  // 边界：null input
  it('returns empty for null report', () => {
    expect(formatWeeklyReportText(null)).toBe('');
  });
  it('returns empty for undefined', () => {
    expect(formatWeeklyReportText(undefined)).toBe('');
  });
});

// ============================================================
// 11. addShareButtonToAchievement — 分享按钮 HTML
// ============================================================
describe('addShareButtonToAchievement', () => {
  const achievement = { id: 1, name: 'test_ach', description: '测试成就', points: 10 };
  const emptyAchievement = {};

  it('generates button HTML with share text', () => {
    const html = addShareButtonToAchievement(achievement);
    expect(html).toContain('showSharePanel');
    expect(html).toContain('分享');
    expect(html).toContain('fa-share-alt');
  });

  it('includes achievement data as JSON', () => {
    const html = addShareButtonToAchievement(achievement);
    expect(html).toContain('test_ach');
    expect(html).toContain('10');
  });

  // 边界
  it('returns empty for null', () => {
    expect(addShareButtonToAchievement(null)).toBe('');
  });
  it('returns empty for undefined', () => {
    expect(addShareButtonToAchievement(undefined)).toBe('');
  });
  it('handles empty achievement object', () => {
    const html = addShareButtonToAchievement(emptyAchievement);
    expect(html).toContain('showSharePanel');
    expect(html).toContain('分享');
  });
});

// ============================================================
// 12. generateStrategies — 策略建议生成
// ============================================================
describe('generateStrategies', () => {
  const basePatterns = {
    reasonDistribution: [],
    weekdayDistribution: [{ weekday: '周一', count: 5 }],
    taskCompletionRate: { completed: 5, total: 10 },
    microStartSuccess: { total: 10, continued_count: 8 },
    pomodoroStats: { total: 10, completed: 8 }
  };

  it('returns default suggestion when incomplete data', () => {
    // 没有 taskCompletionRate 时 completionRate=0 触发完成率建议
    const result = generateStrategies({ reasonDistribution: [] });
    expect(result).toContain('完成率较低');
    expect(result).toContain('</p>');
  });

  it('suggests strategy for vague reason', () => {
    const patterns = { ...basePatterns, reasonDistribution: [{ reason_type: 'vague', count: 5 }] };
    const result = generateStrategies(patterns);
    expect(result).toContain('任务太模糊');
    expect(result).toContain('添加至少2个原子步骤');
  });

  it('suggests strategy for fear reason', () => {
    const patterns = { ...basePatterns, reasonDistribution: [{ reason_type: 'fear', count: 3 }] };
    const result = generateStrategies(patterns);
    expect(result).toContain('害怕失败');
    expect(result).toContain('60分版本');
  });

  it('suggests weekday strategy', () => {
    const patterns = { ...basePatterns, weekdayDistribution: [{ weekday: '周五', count: 10 }] };
    const result = generateStrategies(patterns);
    expect(result).toContain('周五');
    expect(result).toContain('最容易拖延');
  });

  it('suggests low completion rate strategy', () => {
    const patterns = { ...basePatterns, taskCompletionRate: { completed: 1, total: 10 } };
    const result = generateStrategies(patterns);
    expect(result).toContain('完成率较低');
    expect(result).toContain('不要创建超过3个');
  });

  it('suggests micro start strategy', () => {
    const patterns = { ...basePatterns, microStartSuccess: { total: 10, continued_count: 1 } };
    const result = generateStrategies(patterns);
    expect(result).toContain('2分钟本身就是胜利');
  });

  it('suggests pomodoro strategy', () => {
    const patterns = { ...basePatterns, pomodoroStats: { total: 10, completed: 2 } };
    const result = generateStrategies(patterns);
    expect(result).toContain('番茄钟完成率较低');
    expect(result).toContain('从15分钟开始');
  });

  // 边界
  it('returns HTML with <p> tags', () => {
    const result = generateStrategies(basePatterns);
    expect(result).toContain('<p>');
    expect(result).toContain('</p>');
  });
  it('returns default for null', () => {
    const result = generateStrategies(null);
    expect(result).toContain('继续记录');
  });
});

// ============================================================
// 13. debounce — 防抖函数
// ============================================================
describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls function after delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('debounces multiple calls — only last one fires', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced('a');
    debounced('b');
    debounced('c');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('uses default 300ms delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn);
    debounced();
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets timer on rapid calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);
    debounced();
    vi.advanceTimersByTime(100);
    debounced();              // 重置定时器
    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled(); // 还没到200ms
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes this context correctly', () => {
    const fn = vi.fn(function() { return this; });
    const debounced = debounce(fn, 50);
    const ctx = { name: 'test' };
    // Arrow function 不绑定 this，需要用普通函数调用方式测试
    ctx.debounced = debounced;
    ctx.debounced();
    vi.advanceTimersByTime(50);
    expect(fn.mock.results[0].value).toBe(ctx);
  });
});

// ============================================================
// 14. SYSTEM_TEMPLATES — 静态数据完整性
// ============================================================
describe('SYSTEM_TEMPLATES (static data)', () => {
  it('has exactly 5 predefined templates', () => {
    const keys = Object.keys(SYSTEM_TEMPLATES);
    expect(keys).toHaveLength(5);
    expect(keys).toEqual(['cbt', 'gratitude', 'reflection', 'procrastination', 'anxiety']);
  });

  it('each template has required structure', () => {
    Object.values(SYSTEM_TEMPLATES).forEach(t => {
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('icon');
      expect(t).toHaveProperty('color');
      expect(t).toHaveProperty('fields');
      expect(Array.isArray(t.fields)).toBe(true);
      expect(t.fields.length).toBeGreaterThan(0);
    });
  });

  it('each template field has required keys', () => {
    Object.values(SYSTEM_TEMPLATES).forEach(t => {
      t.fields.forEach(f => {
        expect(f).toHaveProperty('key');
        expect(f).toHaveProperty('label');
        expect(f).toHaveProperty('placeholder');
        expect(f).toHaveProperty('icon');
      });
    });
  });

  it('CBT template has 4 fields', () => {
    expect(SYSTEM_TEMPLATES.cbt.fields).toHaveLength(4);
  });
  it('procrastination template has 5 fields', () => {
    expect(SYSTEM_TEMPLATES.procrastination.fields).toHaveLength(5);
  });
});

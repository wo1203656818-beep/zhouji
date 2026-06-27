// ====== 周迹 Core: 路由增强（每日一言 + 键盘快捷键） ======
(function() {
  // 每日一言
  var quotes = [
    '命是弱者的借口，运是强者的谦辞。',
    '你朋友说2028才知道要干什么？那就用2026的结果打他的脸。',
    '不是看到了希望才去坚持，而是坚持了才看到希望。',
    '种一棵树最好的时间是十年前，其次是现在。',
    '自由意志不是为所欲为，而是可以选择不认命。',
    '送外卖不丢人，30岁还不敢做梦才丢人。',
    '普通人用时间换钱，聪明人用内容换时间。',
    '每天早起1小时，一年就多出365小时——相当于多活15天。',
    '60天后的你会感谢今天开始行动的自己。',
    '运气是行动的影子，你跑得越快它跟得越紧。',
  ];
  window._dailyQuote = '"' + quotes[Math.floor(Math.random() * quotes.length)] + '"';

  // 键盘快捷键
  document.addEventListener('keydown', function(e) {
    var tag = (e.target || {}).tagName || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch(e.key) {
      case 'd': case 'D': window.navigate('dashboard'); break;
      case 'w': case 'W': window.navigate('weekly'); break;
      case 't': case 'T': window.navigate('tasks'); break;
      case '1': window.navigate('micro-start'); break;
      case '2': window.navigate('diary'); break;
      case '3': window.navigate('fate-killer'); break;
      case '4': window.navigate('assistant'); break;
      case '5': window.navigate('stats'); break;
      case 'n': case 'N': if (window._quickAdd) window._quickAdd(); break;
    }
  });
})();

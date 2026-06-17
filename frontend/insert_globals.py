with open('weekly.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 找到 "第七部分" 所在行
insert_idx = None
for i, line in enumerate(lines):
    if '第七部分' in line and '全局函数暴露' in line:
        insert_idx = i
        break

if insert_idx:
    insert_lines = [
        '\n',
        '// ═════════════════════════════════════════════════════════════\n',
        '// 第七部分：全局对象暴露（供E2E测试和调试使用）\n',
        '// ═════════════════════════════════════════════════════════════\n',
        '\n',
        'window.WeeklyState   = WeeklyState;\n',
        'window.WeeklyHandlers = WeeklyHandlers;\n',
        'window.WeeklyRenderer = WeeklyRenderer;\n',
        'window.WeeklyAPI      = WeeklyAPI;\n',
        'window.WeeklyUtils    = WeeklyUtils;\n',
        '\n',
        '// ═════════════════════════════════════════════════════════════\n',
        '// 第八部分：全局函数暴露（兼容旧代码HTML onclick调用）\n',
        '// ═════════════════════════════════════════════════════════════\n',
        '\n'
    ]
    for j, line in enumerate(insert_lines):
        lines.insert(insert_idx + j, line)
    
    with open('weekly.js', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f'Inserted at line {insert_idx}')
else:
    print('未找到 第七部分 标记')

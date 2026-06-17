// Debug: weekly view content check
import { chromium } from 'playwright';

const U = 'https://9d6908cf.zhouji-frontend.pages.dev';

(async () => {
  const b = await chromium.launch({headless:true, args:['--no-sandbox']});
  const ctx = await b.newContext({viewport:{width:1280,height:900}});
  const p = await ctx.newPage();

  await p.route('**/api/**', async route => {
    const url = route.request().url();
    if (url.includes('/api/auth/')) {
      return route.fulfill({ status:200, contentType:'application/json',
        body: JSON.stringify({ success:true, token:'test', userId:7, username:'t' })
      });
    }
    if (url.includes('/api/weekly-plans') && route.request().method() === 'GET') {
      return route.fulfill({ status:200, contentType:'application/json',
        body: JSON.stringify({ success:true, plans: [
          { id:1, title:'晨间运动', category:'morning', day_of_week:1, start_time:'06:30', end_time:'07:30', priority:4, color:'#10B981', week_start:'2026-06-15', status:'pending', is_builtin:1, sync_token:'' },
          { id:2, title:'创业拍摄', category:'custom', day_of_week:1, start_time:'09:00', end_time:'12:00', priority:5, color:'#6366F1', week_start:'2026-06-15', status:'pending', is_builtin:0, sync_token:'' }
        ]})
      });
    }
    return route.fulfill({ status:200, contentType:'application/json',
      body: JSON.stringify({ success:true })
    });
  });

  await p.goto(U, {waitUntil:'networkidle',timeout:30000});
  await p.waitForTimeout(1000);
  await p.evaluate(() => {
    localStorage.setItem('token','test');
    localStorage.setItem('userId','7');
    localStorage.setItem('username','t');
  });

  await p.goto(U + '/#/weekly', {waitUntil:'networkidle',timeout:30000});
  await p.waitForTimeout(5000);

  const app = await p.textContent('#app');
  console.log('HAS KEY TEXTS:');
  console.log(' 晨间运动:', app.includes('晨间运动'));
  console.log(' 创业拍摄:', app.includes('创业拍摄'));
  console.log(' 本周计划:', app.includes('本周计划'));

  const mainEl = await p.$('main');
  if (mainEl) {
    const mt = await mainEl.textContent();
    console.log('\nMAIN TEXT (first 2000 chars):');
    console.log(mt.substring(0, 2000));
  } else {
    console.log('\nAPP TEXT (first 2000 chars):');
    console.log(app.substring(0, 2000));
  }

  await b.close();
})().catch(e => console.error('ERR:', e.message));

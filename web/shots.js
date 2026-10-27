// Phone-sized screenshots of the app for the README, taken with a headless Edge/Chrome over the
// DevTools protocol (no extra packages). Usage: node shots.js <page url> <out dir>
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const [, , URL_, OUT] = process.argv;
const BROWSER = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const PROFILE = path.join(__dirname, '..', 'tmp-browser-profile');
const PORT = 9333;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// a believable two weeks of practice: the あ–た rows learned, some cards due today, a few mix-ups
const SEED = `(() => {
  const now = Date.now(), DAYMS = 864e5, rnd = (a, b) => a + Math.random() * (b - a);
  const s = blank();
  s.created = now - 14 * DAYMS;
  s.intro = ROWS.slice(0, 4).flat().filter(Boolean);
  for (const u of s.intro) for (const ch of UNITS[UIDX[u]].chars) for (const sk of skillsOf(ch)) {
    if (sk === 'read') continue;
    const st = Math.floor(rnd(3, 8)), n = Math.floor(rnd(6, 30));
    s.cards[ch + '|' + sk] = {st, due: now + rnd(-0.3, 3) * DAYMS, lap: Math.floor(rnd(0, 3)), n, ok: Math.floor(n * rnd(0.7, 0.95)), slow: Math.floor(rnd(0, 3)), days: Math.floor(rnd(1, 5)), last: '', rt: Math.round(rnd(1100, 3800))};
  }
  for (let d = 0; d < 14; d++) { const q = Math.round(rnd(90, 260)); s.log[dayKey(now - d * DAYMS)] = {q, ok: Math.round(q * rnd(0.78, 0.93)), ms: Math.round(rnd(45, 130)) * 6e4, nu: d % 3 ? 2 : 3}; }
  s.conf = {'シ>ツ': 5, 'ソ>ン': 4, 'さ>ち': 3, 'き>さ': 2, 'ス>ヌ': 1};
  localStorage.setItem('kana2', JSON.stringify(s));
})()`;

// each shot: script to run on the loaded page, then a capture
const SHOTS = [
  ['01-home', `document.querySelector('#tabs button[data-p=p-home]').click()`],
  ['02-lyric-question', `startDrill('main'); D.cur = {id:'か|lyric', ch:'か', sk:'lyric', u:'か', isNew:false, peek:false, done:false}; renderQ()`],
  ['03-listen-question', `D.cur = {id:'シ|hear', ch:'シ', sk:'hear', u:'し', isNew:false, peek:false, done:false}; renderQ(); speechSynthesis.cancel()`],
  ['04-sheet', `endDrill(true); openSheet('か')`],
  ['05-sheet-lyrics', `[...document.querySelectorAll('#sheet .card')].find(c => c.textContent.includes('歌词里的')).scrollIntoView()`],
  ['06-table', `closeSheet(); document.querySelector('#tabs button[data-p=p-table]').click()`],
  ['07-stats', `document.querySelector('#tabs button[data-p=p-stats]').click()`],
  ['08-import-lyrics', `document.querySelector('#tabs button[data-p=p-guide]').click(); myLyricForm();
    document.querySelector('#myT').value = 'ふるさと'; document.querySelector('#myA').value = '高野辰之';
    document.querySelector('#myX').value = '兎(うさぎ)追いし　かの山\\n小鮒(こぶな)釣りし　かの川\\n夢は今も　めぐりて\\n忘れがたき　故郷'`],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const br = spawn(BROWSER, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--no-first-run', '--mute-audio', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
  let page;
  for (let i = 0; i < 40 && !page; i++) {
    await sleep(250);
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch (e) {}
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const wait = {}, events = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait[d.id]) { wait[d.id](d); delete wait[d.id]; } else events.push(d.method); };
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; wait[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const run = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception.description); };
  const load = async () => { events.length = 0; await cmd('Page.navigate', { url: URL_ }); for (let i = 0; i < 80 && !events.includes('Page.loadEventFired'); i++) await sleep(100); await sleep(800); };

  await cmd('Page.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await load();
  await run(SEED);
  await load();
  for (const [name, expr] of SHOTS) {
    await run(expr);
    await sleep(700);
    const { result } = await cmd('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(result.data, 'base64'));
    console.log('saved', name);
  }
  // leave no practice data behind in the throwaway profile
  await run(`localStorage.clear()`);
  ws.close(); br.kill();
})().catch(e => { console.error(e); process.exit(1); });

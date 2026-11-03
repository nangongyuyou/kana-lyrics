// Build a single-file listening page from the voice samples so every VOICEVOX voice can be compared quickly.
// Usage: node voice-page.js <out.html>
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', '声音试听');
const OUT = process.argv[2] || path.join(DIR, '声音试听.html');

const voices = JSON.parse(fs.readFileSync(path.join(DIR, 'voices.json'), 'utf8'))
  .filter(v => fs.existsSync(path.join(DIR, `${v.id}-0.mp3`)) && fs.existsSync(path.join(DIR, `${v.id}-1.mp3`)))
  .map((v, i) => ({ ...v, no: i + 1,
    a: fs.readFileSync(path.join(DIR, `${v.id}-0.mp3`)).toString('base64'),
    b: fs.readFileSync(path.join(DIR, `${v.id}-1.mp3`)).toString('base64') }));

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>声音试听</title><style>
:root{--bg:#F6EFE4;--card:#FFFBF4;--ink:#2B2420;--sub:#7A6C60;--line:#E6DACB;--accent:#E8674A;--teal:#2F8F83;--teal-soft:#D6EEEA;--gold:#D9A21B}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Resource Han Rounded CN","Noto Sans CJK SC",sans-serif;font-size:19px}
.wrap{max-width:720px;margin:0 auto;padding:0 16px 40px}
header{position:sticky;top:0;background:var(--bg);padding:12px 0;border-bottom:1px solid var(--line);z-index:2}
h1{font-size:24px;margin:0 0 4px}.sub{color:var(--sub);font-size:15px}
.now{background:var(--card);border:2px solid var(--teal);border-radius:18px;padding:14px;margin-top:10px;display:flex;align-items:center;gap:10px}
.now .info{flex:1;min-width:0}.now .info b{font-size:24px}.now .info span{display:block;color:var(--sub);font-size:16px}
.big{border:0;border-radius:16px;background:var(--accent);color:#fff;font-size:28px;width:64px;height:64px;flex:none;cursor:pointer}
.row{display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--card);border:1px solid var(--line);border-radius:14px;margin:8px 0}
.row.on{border:2px solid var(--teal);background:var(--teal-soft)}
.row .n{width:2.6em;color:var(--sub);font-size:15px}.row .t{flex:1;min-width:0}.row .t small{color:var(--sub)}
.p{border:1px solid var(--line);background:var(--bg);border-radius:10px;padding:6px 10px;font-size:16px;cursor:pointer}
.star{border:0;background:none;font-size:24px;cursor:pointer;color:var(--gold)}
.tools{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.chip{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:6px 14px;font-size:16px;cursor:pointer}.chip.on{background:var(--teal);color:#fff;border-color:var(--teal)}
</style></head><body><div class="wrap">
<header><h1>声音试听</h1><div class="sub">共 ${voices.length} 个声音。句 1：あいうえお かきくけこ　句 2：一句普通的日常会话。用 ◀ ▶ 快速切换并自动播放（电脑可按 ← →），喜欢的点 ☆。</div>
<div class="now"><button class="big" id="prev">◀</button><div class="info"><b id="nowName"></b><span id="nowStyle"></span></div><button class="p" id="nowA">▶ 句1</button><button class="p" id="nowB">▶ 句2</button><button class="big" id="next">▶</button></div>
<div class="tools"><button class="chip" id="favOnly">只看收藏</button><button class="chip on" id="auto">切换时自动播放句 2</button></div></header>
<div id="list"></div>
<p class="sub">选好后把编号（No.）告诉 Claude。声音来自 VOICEVOX，个人学习使用；各角色有自己的使用规约，正式发布作品时需注明“VOICEVOX:角色名”。</p></div>
<script>
const V = ${JSON.stringify(voices.map(v => ({ no: v.no, id: v.id, name: v.name, style: v.style, a: v.a, b: v.b })))};
let cur = 0, favOnly = false, auto = true;
let fav = new Set(); try { fav = new Set(JSON.parse(localStorage.getItem('voiceFav') || '[]')); } catch (e) {}
const player = new Audio();
const play = (i, which) => { cur = i; player.src = 'data:audio/mpeg;base64,' + V[i][which]; player.play().catch(() => {}); render(); };
const visible = () => V.map((v, i) => i).filter(i => !favOnly || fav.has(V[i].no));
function render() {
  const v = V[cur];
  document.getElementById('nowName').textContent = 'No.' + v.no + '  ' + v.name;
  document.getElementById('nowStyle').textContent = v.style + (fav.has(v.no) ? '  ★ 已收藏' : '');
  document.getElementById('list').innerHTML = visible().map(i => { const x = V[i]; return '<div class="row' + (i === cur ? ' on' : '') + '" data-i="' + i + '"><span class="n">No.' + x.no + '</span><span class="t">' + x.name + ' <small>' + x.style + '</small></span><button class="p" data-play="a">▶ 1</button><button class="p" data-play="b">▶ 2</button><button class="star" data-star="1">' + (fav.has(x.no) ? '★' : '☆') + '</button></div>'; }).join('');
}
function step(d) { const vis = visible(); if (!vis.length) return; let k = vis.indexOf(cur); k = k < 0 ? 0 : (k + d + vis.length) % vis.length; cur = vis[k]; if (auto) play(cur, 'b'); else render(); document.querySelector('.row.on') && document.querySelector('.row.on').scrollIntoView({block: 'nearest'}); }
document.getElementById('prev').onclick = () => step(-1);
document.getElementById('next').onclick = () => step(1);
document.getElementById('nowA').onclick = () => play(cur, 'a');
document.getElementById('nowB').onclick = () => play(cur, 'b');
document.getElementById('favOnly').onclick = e => { favOnly = !favOnly; e.target.classList.toggle('on', favOnly); render(); };
document.getElementById('auto').onclick = e => { auto = !auto; e.target.classList.toggle('on', auto); };
document.getElementById('list').onclick = e => {
  const row = e.target.closest('[data-i]'); if (!row) return; const i = +row.dataset.i;
  if (e.target.dataset.play) return play(i, e.target.dataset.play);
  if (e.target.dataset.star) { const no = V[i].no; fav.has(no) ? fav.delete(no) : fav.add(no); try { localStorage.setItem('voiceFav', JSON.stringify([...fav])); } catch (err) {} return render(); }
  cur = i; render();
};
document.addEventListener('keydown', e => { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); });
render();
</script></body></html>`;
fs.writeFileSync(OUT, html);
console.log('voices', voices.length, 'KB', Math.round(html.length / 1024));

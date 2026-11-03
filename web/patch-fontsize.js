// App-wide font size: every "font-size:Npx" is turned into "calc(Npx * var(--fz))" at build time (build.js).
// Huge display glyphs are written with a space after the colon here so the build leaves them alone,
// and instead grow only a little (min(var(--fz), cap)) so they never overflow a phone screen.
const fs = require('fs');
const f = __dirname + '/template.html';
let t = fs.readFileSync(f, 'utf8');
const rep = [
  [':root{', ':root{--fz:1;'],
  ['.cell .k{font-size:34px;', '.cell .k{font-size: calc(34px * min(var(--fz), 1.12));'],
  ['.cell .k2{font-size:34px;', '.cell .k2{font-size: calc(34px * min(var(--fz), 1.12));'],
  ['.cell.y .k,.cell.y .k2,.cell.x .k,.cell.x .k2{font-size:30px}', '.cell.y .k,.cell.y .k2,.cell.x .k,.cell.x .k2{font-size: calc(30px * min(var(--fz), 1.12))}'],
  ['.hero .big{font-size:120px;', '.hero .big{font-size: calc(120px * min(var(--fz), 1.15));'],
  ['.pic .dt{fill:var(--accent);font-size:22px;', '.pic .dt{fill:var(--accent);font-size: 22px;'],
  ['justify-content:center;font-size:230px;', 'justify-content:center;font-size: 230px;'],
  ['.padbg.y .ghost{font-size:150px}', '.padbg.y .ghost{font-size: 150px}'],
  ['.qk{font-size:140px;', '.qk{font-size: calc(140px * min(var(--fz), 1.15));'],
  ['@media (max-width:380px){.cell .k,.cell .k2{font-size:29px}.hero .big{font-size:100px}.cell{min-height:70px}.qk{font-size:120px}}',
   '@media (max-width:380px){.cell .k,.cell .k2{font-size: calc(29px * min(var(--fz), 1.12))}.hero .big{font-size: calc(100px * min(var(--fz), 1.15))}.cell{min-height:70px}.qk{font-size: calc(120px * min(var(--fz), 1.15))}}'],
  ['<header><div class="wrap"><h1>五十音 · 歌词记忆</h1>', '<header><div class="wrap"><button class="chip" id="fzBtn" style="float:right;margin-top:4px">Aa 字号</button><h1>五十音 · 歌词记忆</h1>'],
];
for (const [a, b] of rep) {
  if (!t.includes(a)) { if (t.includes(b)) continue; throw new Error('not found: ' + a.slice(0, 50)); }
  t = t.replace(a, b);
}
fs.writeFileSync(f, t);
console.log('patched', rep.length);

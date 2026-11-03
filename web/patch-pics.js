// One-off edits to the PICS table in template.html (avoids shell quoting trouble with Chinese quotes).
const fs = require('fs');
const f = __dirname + '/template.html';
let t = fs.readFileSync(f, 'utf8');

function setEntry(ch, overlay, caption, under) {
  const i = t.indexOf(`'${ch}':[`);
  const j = t.indexOf(`],\n`, i);
  const parts = [overlay, caption, under].filter(x => x !== undefined).map(x => JSON.stringify(x).replace(/^"|"$/g, "'").replace(/\\"/g, '"'));
  t = t.slice(0, i) + `'${ch}':[${parts.join(',')}` + t.slice(j);
}
function getEntry(ch) {
  const i = t.indexOf(`'${ch}':[`);
  const j = t.indexOf(`],\n`, i);
  return new Function('return [' + t.slice(i + `'${ch}':[`.length, j) + ']')();
}

// わ: fill the belly
{ const e = getEntry('わ'); setEntry('わ', e[0], e[1], '<circle class="dg" cx="66" cy="66" r="22"/>'); }
// ち: add a small camera so "say cheese" reads at a glance
{ const e = getEntry('ち'); setEntry('ち', e[0] + '<rect class="dg" x="86" y="2" width="28" height="20" rx="4"/><circle class="d2" cx="100" cy="12" r="6"/><rect class="df" x="90" y="-2" width="8" height="4"/>', e[1]); }
// す: balloon string under the loop
{ const e = getEntry('す'); setEntry('す', '', e[1], e[2]); }

// one big headline per card saying what the picture is
const LABEL = {
'あ':'⛰ 山顶大喊','い':'🌱 两根小草','う':'👂 竖起的耳朵','え':'💃 跳舞的人','お':'🏃 跑步甩汗','か':'💪 用力迸出火花',
'き':'🔑 钥匙','く':'🐦 张嘴的小鸟','け':'🗡 一把剑','こ':'🐟 两条小鱼','さ':'🌸 樱花','し':'🎣 鱼钩',
'す':'🎈 线上的气球','せ':'🌍 世界','そ':'⚡ 闪电','た':'🥚 滚出一颗蛋','ち':'📸 拍照喊 cheese','つ':'🌊 浪花',
'て':'✋ 伸出的手','と':'🔨 钉钉子','な':'🎀 绳子打结','に':'2️⃣ 数字“二”','ぬ':'🍜 一碗面','ね':'🐱 卷尾巴的猫',
'の':'🚫 禁止标志','は':'🌼 竖线上开花','ひ':'😄 咧嘴笑','ふ':'🗻 富士山','へ':'⛳ 小山插旗','ほ':'⭐ 塔顶的星星',
'ま':'🪄 魔法棒','み':'🎵 音符“21”','む':'🐮 牛哞哞叫','め':'👁 大眼睛','も':'🍑 钩上挂桃子','や':'🏹 射出的箭',
'ゆ':'🐟 游动的鱼','よ':'🚩 插在地上的旗','ら':'🐰 蹲着的兔子','り':'🍎 夹着苹果','る':'🐌 蜗牛','れ':'🚶 大步走路',
'ろ':'🛣 路上的弯道','わ':'😋 吃饱的肚子','を':'👣 往远处走','ん':'🙂 点头说嗯',
};
if (!t.includes('const PICLABEL')) t = t.replace('// ---------------- helpers ----------------', 'const PICLABEL = ' + JSON.stringify(LABEL) + ';\n// ---------------- helpers ----------------');
fs.writeFileSync(f, t);
console.log('ok', getEntry('わ').length, getEntry('ち')[0].length);

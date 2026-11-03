// One short sample per VOICEVOX voice (every speaker × style) plus a listening page to compare them.
// Output: E:\ruanjian\五十音学习工具\声音试听\  (mp3 files + 声音试听.html)
const fs = require('fs');
const path = require('path');
const API = 'http://127.0.0.1:50021';
const OUT = path.join(__dirname, '..', '声音试听');
// our own sentences: the vowel row, and a normal spoken sentence
const TEXTS = ['あ、い、う、え、お。か、き、く、け、こ。', 'こんにちは。今日もいっしょに、五十音を練習しましょう。'];

function pcmFromWav(buf) {
  let off = 12;
  while (off < buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4);
    if (id === 'data') return new Int16Array(buf.buffer.slice(buf.byteOffset + off + 8, buf.byteOffset + off + 8 + size));
    off += 8 + size;
  }
  throw new Error('no data');
}

(async () => {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  fs.mkdirSync(OUT, { recursive: true });
  for (let i = 0; i < 60; i++) { try { await fetch(API + '/version'); break; } catch (e) { await new Promise(r => setTimeout(r, 3000)); } }
  const speakers = await (await fetch(API + '/speakers')).json();
  const voices = speakers.flatMap(s => s.styles.map(st => ({ id: st.id, name: s.name, style: st.name, type: st.type || 'talk' }))).filter(v => /talk/.test(v.type)); // 'talk' or 'streaming_talk' depending on engine version
  let n = 0;
  for (const v of voices) {
    for (let t = 0; t < TEXTS.length; t++) {
      const file = path.join(OUT, `${v.id}-${t}.mp3`);
      if (fs.existsSync(file)) continue;
      try {
        const q = await (await fetch(`${API}/audio_query?speaker=${v.id}&text=${encodeURIComponent(TEXTS[t])}`, { method: 'POST' })).json();
        q.outputSamplingRate = 24000; q.outputStereo = false; q.speedScale = 0.95;
        const wav = Buffer.from(await (await fetch(`${API}/synthesis?speaker=${v.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) })).arrayBuffer());
        const pcm = pcmFromWav(wav), enc = new Mp3Encoder(1, 24000, 48), parts = [];
        for (let i = 0; i < pcm.length; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) parts.push(Buffer.from(b)); }
        const f = enc.flush(); if (f.length) parts.push(Buffer.from(f));
        fs.writeFileSync(file, Buffer.concat(parts));
      } catch (e) { console.error(v.id, e.message); }
    }
    if (++n % 10 === 0) console.log(n + '/' + voices.length);
  }
  fs.writeFileSync(path.join(OUT, 'voices.json'), JSON.stringify(voices));
  console.log('done', voices.length, 'voices');
})();

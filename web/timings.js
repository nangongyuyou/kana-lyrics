// Mora timings for every lyric line, matching how tts.js synthesizes lines, for karaoke highlighting.
// Writes timings.json: {lineText: [end time in ms of each mora]}. Needs the VOICEVOX engine running.
// Usage: node timings.js [speakerId] [data.json] [timings.json]
const fs = require('fs');
const path = require('path');
const API = 'http://127.0.0.1:50021';
const SPEAKER = +(process.argv[2] || 14);
const SPEED = 0.95, PRE = 0.05; // same values tts.js uses for lines
const OUT = path.resolve(__dirname, process.argv[4] || 'timings.json');

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, process.argv[3] || 'data.json'), 'utf8'));
// written line → text the engine reads (hand-given readings as kana, like tts.js)
const lines = new Map(Object.values(data.ex).flat().map(ex => [ex.t.map(x => x.s).join(''), ex.t.map(x => x.f ? x.r : x.s).join('')]));

(async () => {
  const out = {};
  for (const [text, say] of lines) {
    const q = await (await fetch(`${API}/audio_query?speaker=${SPEAKER}&text=${encodeURIComponent(say)}`, { method: 'POST' })).json();
    let t = PRE;
    const ends = [];
    for (const ap of q.accent_phrases) {
      for (const m of ap.moras) { t += (m.consonant_length || 0) + m.vowel_length; ends.push(Math.round(t / SPEED * 1000)); }
      if (ap.pause_mora) t += (ap.pause_mora.consonant_length || 0) + ap.pause_mora.vowel_length;
    }
    out[text] = ends;
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('lines', lines.size, 'KB', Math.round(JSON.stringify(out).length / 1024));
})().catch(e => { console.error(e); process.exit(1); });

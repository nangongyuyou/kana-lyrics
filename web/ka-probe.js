// Find where Kanji alive hosts the example audio, and whether there is a zip.
const fs = require('fs');
(async () => {
  const csv = fs.readFileSync(__dirname + '/ka_data.csv', 'utf8').split('\n');
  for (const k of ['述', '雨', '山']) { const row = csv.find(l => l.startsWith(k + ',')); console.log(row && row.split(',').slice(0, 5).join(' | ')); }
  const name = 'jutsu-no(beru)_06_a';
  const tries = [
    `https://media.kanjialive.com/examples_audio/audio-mp3/${name}.mp3`,
    `https://media.kanjialive.com/examples_audio/mp3/${name}.mp3`,
    `https://media.kanjialive.com/examples_audio/audio-mp3.zip`,
    `https://media.kanjialive.com/examples_audio/examples_mp3.zip`,
    `https://media.kanjialive.com/examples_audio/audio_mp3.zip`,
  ];
  for (const u of tries) {
    try { const r = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(20000) }); console.log(r.status, r.headers.get('content-type'), r.headers.get('content-length'), u); }
    catch (e) { console.log('ERR', e.message, u); }
  }
  // the README may link the archives directly
  const rd = await (await fetch('https://raw.githubusercontent.com/kanjialive/kanji-data-media/master/examples-audio/README.md')).text();
  console.log('links:', [...rd.matchAll(/\((http[^)]+)\)/g)].map(m => m[1]).join(' '));
})();

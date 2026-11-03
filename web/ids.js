// Look up NetEase song ids for the songs used in data.json (matched by title, then artist).
// Writes ids into data.json as songs[i][2].
const fs = require('fs');
const H = { Referer: 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' };
const PLAYLIST = 2428412303;

(async () => {
  const pl = await (await fetch(`https://music.163.com/api/v6/playlist/detail?id=${PLAYLIST}&n=2000`, { headers: H })).json();
  const ids = pl.playlist.trackIds.map(t => t.id);
  const tracks = [];
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200);
    const c = JSON.stringify(part.map(id => ({ id })));
    const r = await (await fetch(`https://music.163.com/api/v3/song/detail?c=${encodeURIComponent(c)}`, { headers: H })).json();
    tracks.push(...r.songs.map(s => ({ id: s.id, name: s.name, ar: (s.ar || []).map(a => a.name).join('/') })));
  }
  const data = JSON.parse(fs.readFileSync(__dirname + '/data.json', 'utf8'));
  const norm = s => s.replace(/\s+/g, '').toLowerCase();
  let hit = 0;
  for (const s of data.songs) {
    const cands = tracks.filter(t => norm(t.name) === norm(s[0]));
    const best = cands.find(t => norm(t.ar) === norm(s[1])) || cands.find(t => s[1] && norm(t.ar).includes(norm(s[1]).split('/')[0])) || cands[0];
    if (best) { s[2] = best.id; hit++; }
  }
  fs.writeFileSync(__dirname + '/data.json', JSON.stringify(data));
  console.log('tracks', tracks.length, 'matched', hit, '/', data.songs.length);
})();

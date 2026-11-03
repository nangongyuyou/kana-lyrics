// Read the Kanji alive README and list the audio folder, to learn how audio files are named.
(async () => {
  const r = await fetch('https://raw.githubusercontent.com/kanjialive/kanji-data-media/master/README.md', { signal: AbortSignal.timeout(30000) });
  const t = await r.text();
  const lines = t.split('\n').filter(l => /audio|mp3|file name|filename|naming|_a|_b|kname/i.test(l));
  console.log(lines.slice(0, 30).join('\n'));
  const api = await fetch('https://api.github.com/repos/kanjialive/kanji-data-media/contents/', { headers: { 'User-Agent': 'KanaLyricsStudy' }, signal: AbortSignal.timeout(30000) });
  const j = await api.json();
  console.log('top level:', Array.isArray(j) ? j.map(x => x.name + (x.type === 'dir' ? '/' : '')).join(' ') : JSON.stringify(j).slice(0, 200));
})();

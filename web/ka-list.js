// List Kanji alive example-audio folders and sample file names.
const H = { 'User-Agent': 'KanaLyricsStudy' };
(async () => {
  const a = await (await fetch('https://api.github.com/repos/kanjialive/kanji-data-media/contents/examples-audio', { headers: H })).json();
  console.log('examples-audio:', a.map(x => x.name + (x.type === 'dir' ? '/' : ` (${Math.round(x.size / 1024 / 1024)}MB)`)).join(' '));
  const mp3dir = a.find(x => /mp3/i.test(x.name));
  if (mp3dir && mp3dir.type === 'dir') {
    const b = await (await fetch(mp3dir.url, { headers: H })).json();
    console.log(mp3dir.name, 'entries (first page):', b.length, b.slice(0, 12).map(x => x.name).join(' '));
  }
})();

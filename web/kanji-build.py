# Build the kanji data for version 3: which kanji each 新标日 word uses and how it is read there,
# readings / meaning / radical from Kanji alive, stroke paths from KanjiVG, and which Japanese forms differ
# from simplified Chinese. Also converts the Kanji alive example recordings to Opus.
# Usage: python kanji-build.py <ka_data.csv> <KanjiAlive audio dir> <kanjivg.xml.gz> <resources dir> <ffmpeg>
import sys, os, re, csv, json, gzip, subprocess
from concurrent.futures import ThreadPoolExecutor
sys.stdout.reconfigure(encoding="utf-8")
KA_CSV, KA_AUDIO, KVG, RES, FF = sys.argv[1:6]
toH = lambda s: "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)
isK = lambda c: "一" <= c <= "鿿" or c in "々〆ヶ"

# Japanese form → simplified Chinese, only where they are different characters (curated)
CN = dict(p for p in (pair.split(":") for pair in """亜:亚 悪:恶 圧:压 囲:围 為:为 違:违 緯:纬 偉:伟 飲:饮 員:员 隠:隐 韻:韵 運:运 雲:云 営:营 栄:荣 衛:卫 駅:驿 謁:谒 円:圆 園:园 煙:烟 塩:盐 縁:缘 応:应 欧:欧 殴:殴 桜:樱 億:亿 価:价 過:过 課:课 貨:货 絵:绘 開:开 階:阶 塊:块 壊:坏 懐:怀 貝:贝 拡:扩 覚:觉 較:较 閣:阁 確:确 獲:获 楽:乐 額:额 渇:渴 轄:辖 巻:卷 陥:陷 乾:干 勧:劝 寛:宽 漢:汉 慣:惯 関:关 歓:欢 監:监 環:环 観:观 韓:韩 館:馆 頑:顽 顔:颜 願:愿 帰:归 気:气 記:记 飢:饥 規:规 亀:龟 偽:伪 儀:仪 議:议 戯:戏 犠:牺 級:级 糾:纠 給:给 挙:举 拠:据 漁:渔 競:竞 協:协 鏡:镜 響:响 驚:惊 暁:晓 業:业 極:极 謹:谨 銀:银 駆:驱 訓:训 軍:军 係:系 恵:惠 経:经 掲:揭 渓:溪 軽:轻 継:继 鶏:鸡 撃:击 決:决 潔:洁 権:权 険:险 堅:坚 検:检 絹:绢 験:验 顕:显 厳:严 現:现 減:减 個:个 庫:库 誇:夸 呉:吴 語:语 誤:误 護:护 広:广 効:效 鉱:矿 構:构 綱:纲 講:讲 購:购 剛:刚 鋼:钢 黒:黑 穀:谷 済:济 歳:岁 砕:碎 細:细 際:际 剤:剂 殺:杀 雑:杂 惨:惨 傘:伞 賛:赞 残:残 誌:志 詞:词 試:试 詩:诗 飼:饲 資:资 師:师 糸:丝 視:视 歯:齿 児:儿 時:时 実:实 車:车 釈:释 収:收 従:从 衆:众 獣:兽 縦:纵 粛:肃 術:术 純:纯 順:顺 処:处 書:书 諸:诸 勝:胜 焼:烧 証:证 傷:伤 奨:奖 詳:详 乗:乘 縄:绳 浄:净 場:场 畳:叠 譲:让 嬢:娘 職:职 飾:饰 審:审 親:亲 診:诊 図:图 酔:醉 枢:枢 製:制 誠:诚 請:请 績:绩 責:责 説:说 節:节 銭:钱 鮮:鲜 選:选 遷:迁 線:线 薦:荐 繊:纤 戦:战 漸:渐 総:总 層:层 騒:骚 臓:脏 蔵:藏 贈:赠 則:则 側:侧 測:测 続:续 孫:孙 損:损 対:对 帯:带 隊:队 態:态 題:题 滝:泷 択:择 沢:泽 濁:浊 単:单 嘆:叹 誕:诞 団:团 弾:弹 談:谈 遅:迟 恥:耻 築:筑 鋳:铸 貯:贮 張:张 腸:肠 頂:顶 鳥:鸟 聴:听 調:调 懲:惩 鎮:镇 陳:陈 賃:赁 墜:坠 鉄:铁 転:转 伝:传 電:电 塗:涂 闘:斗 東:东 統:统 討:讨 頭:头 湯:汤 党:党 動:动 導:导 銅:铜 読:读 軟:软 難:难 弐:贰 認:认 寧:宁 熱:热 悩:恼 脳:脑 農:农 濃:浓 覇:霸 拝:拜 敗:败 買:买 売:卖 輩:辈 発:发 髪:发 罰:罚 抜:拔 飯:饭 販:贩 範:范 盤:盘 費:费 飛:飞 備:备 筆:笔 標:标 評:评 貧:贫 賓:宾 頻:频 婦:妇 負:负 賦:赋 歩:步 仏:佛 憤:愤 奮:奋 併:并 閉:闭 変:变 辺:边 編:编 舗:铺 補:补 報:报 豊:丰 飽:饱 鳳:凤 貿:贸 撲:扑 満:满 務:务 夢:梦 霧:雾 鳴:鸣 銘:铭 綿:绵 網:网 黙:默 門:门 問:问 紋:纹 訳:译 薬:药 躍:跃 輸:输 優:优 郵:邮 誘:诱 揺:摇 葉:叶 陽:阳 様:样 謡:谣 養:养 擁:拥 頼:赖 覧:览 欄:栏 濫:滥 離:离 陸:陆 竜:龙 両:两 猟:猎 糧:粮 緑:绿 隣:邻 涙:泪 塁:垒 類:类 鈴:铃 齢:龄 暦:历 歴:历 連:连 練:练 錬:炼 労:劳 録:录 話:话 長:长 見:见 間:间 貸:贷 借:借 机:机 椅:椅 帳:帐 紙:纸 終:终 約:约 紅:红 組:组 結:结 絶:绝 統:统 紹:绍 介:介 経:经 漁:渔 鉛:铅 銃:铳 針:针 鍵:键 錯:错 鍋:锅 鐘:钟 鎖:锁 階:阶 陰:阴 険:险 隆:隆 陣:阵 際:际 険:险 雑:杂 難:难 頃:顷 項:项 順:顺 預:预 領:领 頭:头 題:题 類:类 顧:顾 風:风 飯:饭 養:养 餅:饼 馬:马 駐:驻 験:验 騒:骚 髄:髓 魚:鱼 鮭:鲑 鯨:鲸 麺:面 黄:黄 齢:龄""".split()) if p[0] != p[1])

# ---- Kanji alive: readings, meaning, radical, example words (+ their recordings) ----
ka = {r["kanji"]: r for r in csv.DictReader(open(KA_CSV, encoding="utf-8"))}
files = set(os.listdir(KA_AUDIO))
def ka_readings(r):
    on = [toH(x) for x in re.split("[、,]", r["onyomi_ja"]) if x.strip() and x.strip() != "-"]
    kun = [x for x in re.split("[、,]", r["kunyomi_ja"]) if x.strip() and x.strip() != "-"]
    return on, kun
VOICED = str.maketrans("かきくけこさしすせそたちつてとはひふへほ", "がぎぐげござじずぜぞだぢづでどばびぶべぼ")
HALF = str.maketrans("はひふへほ", "ぱぴぷぺぽ")
def variants(r):
    """a reading as it can appear inside a word: rendaku (か→が, は→ば/ぱ) and a final つ/く/ち/き/ち becoming っ"""
    out = {r}
    if r: out |= {r[0].translate(VOICED) + r[1:], r[0].translate(HALF) + r[1:]}
    for x in list(out):
        if len(x) >= 2 and x[-1] in "つくちき": out.add(x[:-1] + "っ")
    return out

# ---- 新标日 words: split each kanji block's reading over its kanji ----
vocab = json.load(open(os.path.join(RES, "vocab.json"), encoding="utf-8"))
known = {}
for k, r in ka.items():
    on, kun = ka_readings(r); known[k] = set(on) | set(kun)
blocks = []  # (word id, kanji block, reading)
for w in vocab:
    for t in w["t"]:
        if t.get("r") and any(isK(c) for c in t["s"]): blocks.append((w["id"], t["s"], t["r"]))
def split(block, reading):
    """all ways to read block char by char with known readings; kana inside the block must match literally"""
    res = []
    def go(i, j, acc):
        if i == len(block):
            if j == len(reading): res.append(list(acc))
            return
        c = block[i]
        if not isK(c):
            if reading.startswith(toH(c), j): go(i + 1, j + 1, acc)
            return
        if c == "々" and acc: cands = variants(acc[-1][1])
        else: cands = set().union(*[variants(x) for x in known.get(c, ())]) if known.get(c) else set()
        for r in cands:
            if r and reading.startswith(r, j): acc.append((c, r)); go(i + 1, j + len(r), acc); acc.pop()
    go(0, 0, [])
    return res
# bootstrapping: single-kanji blocks give readings directly; then blocks with one unknown kanji teach it
for _ in range(4):
    for wid, b, r in blocks:
        ks = [c for c in b if isK(c) and c != "々"]
        if len(ks) == 1 and len(b) == 1: known.setdefault(b, set()).add(r)
        unknown = [c for c in ks if not known.get(c)]
        if len(unknown) == 1:
            # the unknown kanji takes whatever the known ones leave over (1–4 kana)
            i = b.index(unknown[0]); pre, post = b[:i], b[i + 1:]
            for k1 in range(len(r) + 1):
                if pre and not split(pre, r[:k1]): continue
                if not pre and k1: continue
                for k2 in range(k1 + 1, min(len(r), k1 + 4) + 1):
                    if (post and split(post, r[k2:])) or (not post and k2 == len(r)):
                        known.setdefault(unknown[0], set()).add(r[k1:k2]); break
align, uses = {}, {}
for wid, b, r in blocks:
    s = split(b, r)
    if len(s) >= 1:
        best = min(s, key=lambda a: sum(1 for c, x in a if x not in known.get(c, ())))  # prefer dictionary readings
        align.setdefault(wid, []).extend([c, x] for c, x in best if c != "々")
        for c, x in best:
            if c == "々": continue
            base = x  # group the rendaku / っ forms under the dictionary reading they come from
            for d in known.get(c, ()):
                if x in variants(d): base = d; break
            uses.setdefault(c, {}).setdefault(base, []).append(wid)
# drop implausible readings (a mis-split word gives 生 = しんぞうにけがは): one kanji is read with at most
# 5 kana, and a long reading not in the dictionary must be seen in at least two words
dict_r = {c: set(sum(ka_readings(r), [])) for c, r in ka.items()}
for c in list(uses):
    for rd in list(uses[c]):
        if len(rd) > 5 or (rd not in dict_r.get(c, ()) and len(rd) > 3 and len(set(uses[c][rd])) < 2): del uses[c][rd]
    for rd in uses[c]: uses[c][rd] = sorted(set(uses[c][rd]))
    if not uses[c]: del uses[c]
for wid in list(align):
    align[wid] = [[c, x] for c, x in align[wid] if any(x in variants(d) for d in uses.get(c, {}))]
    if not align[wid]: del align[wid]
order = []
for w in vocab:
    for c, x in align.get(w["id"], []):
        if c not in order: order.append(c)

# ---- stroke paths from KanjiVG ----
want = set(order) | set(ka)
xml = gzip.open(KVG, "rt", encoding="utf-8").read()
strokes = {}
for m in re.finditer(r'<kanji id="kvg:kanji_([0-9a-f]{5})">(.*?)</kanji>', xml, re.S):
    c = chr(int(m.group(1), 16))
    if c in want: strokes[c] = re.findall(r'<path[^>]*?\sd="([^"]+)"', m.group(2))

# ---- Kanji alive example recordings → Opus, numbered (APK asset names must be ASCII) ----
os.makedirs(os.path.join(RES, "ka"), exist_ok=True)
jobs, chars = [], {}
for c in sorted(set(order) | set(ka), key=lambda c: order.index(c) if c in order else 99999):
    r = ka.get(c); on, kun = ka_readings(r) if r else ([], [])
    ex = []
    if r:
        try: exs = json.loads(r["examples"])
        except Exception: exs = []
        for n, e in enumerate(exs):
            m = re.match(r"\*?([^（]+)（([^）]+)）", e[0])
            if not m: continue
            f = next((f for f in files if f.startswith(r["kname"] + "_") and f.endswith("_" + chr(97 + n) + ".mp3")), None)
            idx = None
            if f: idx = len(jobs); jobs.append((os.path.join(KA_AUDIO, f), os.path.join(RES, "ka", f"{idx}.ogg")))
            ex.append([m.group(1), m.group(2), e[1], idx])
    chars[c] = {k: v for k, v in {"m": r["kmeaning"] if r else "", "on": on, "kun": kun, "n": int(r["kstroke"]) if r and r["kstroke"].isdigit() else len(strokes.get(c, [])),
        "rad": r["radical"] if r else "", "radm": r["rad_meaning"] if r else "", "cn": CN.get(c, ""), "ex": ex,
        "use": uses.get(c, {})}.items() if v not in ("", [], {})}
def conv(j):
    src, dst = j
    if os.path.exists(dst): return 0
    return subprocess.run([FF, "-v", "error", "-i", src, "-map", "0:a:0", "-map_metadata", "-1", "-ac", "1", "-c:a", "libopus", "-b:a", "24k", "-application", "voip", "-y", dst]).returncode
with ThreadPoolExecutor(8) as x: fails = sum(1 for rc in x.map(conv, jobs) if rc)
json.dump({"chars": chars, "order": order, "align": align}, open(os.path.join(RES, "kanji.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump(strokes, open(os.path.join(RES, "kstrokes.json"), "w", encoding="utf-8"), separators=(",", ":"))
aligned = sum(1 for wid, b, r in blocks if wid in align)
size = sum(os.path.getsize(os.path.join(RES, "ka", f)) for f in os.listdir(os.path.join(RES, "ka")))
print(f"kanji {len(chars)} (in words {len(order)}) | blocks {len(blocks)}, words aligned {len(align)} / {len({b[0] for b in blocks})} | strokes {len(strokes)} | "
      f"forms differing from simplified {sum(1 for c in chars.values() if 'cn' in c)} | Kanji alive clips {len(jobs)} failed {fails} {size / 1e6:.1f} MB")
for c in order[:6]: print(c, chars[c].get("use"), chars[c].get("cn", ""))

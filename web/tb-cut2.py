# Cut the textbook's example words, dictation items, accent demo and numbers into separate clips.
# Labels follow the textbook's fixed reading order ("_" = announcement / number / end tone, skipped).
# Writes <out>/tbook.json: {clips: {key: base64}, words: [[word, lesson]], sets: [[id, name, [words]]], accent, suji}
# Usage: python tb-cut2.py <ffmpeg> <track folder> <segments.json> <out folder>
import sys, os, json, base64, subprocess, tempfile
sys.stdout.reconfigure(encoding="utf-8")
FF, DIR, SEGS, OUT = sys.argv[1:5]
segs = json.load(open(SEGS, encoding="utf-8"))
_ = "_"
def kana_drill(words, n=10, head=2):          # x-2 tracks: "2-2", "1", 10 kana, "2", words
    return [_] * head + [_] * n + [_] + words
def dictation(words, intro=1):                 # "2-5", then (number, word) × n
    out = [_] * intro
    for w in words: out += [_, w]
    return out
EXAMPLES = {   # track: (lesson, labels)
    "005_1-2": ("1", kana_drill("うえ あう あおい".split())),
    "007_2-2": ("2", kana_drill("かお いく こえ きかい".split())),
    "009_2-4": ("2", kana_drill("けが かぎ がいこく ごご".split())),
    "014_3-2": ("3", kana_drill("かさ しお うそ すこし せかい".split())),
    "015_3-3": ("3", [_] * 19 + "ごじ かぜ かぞく しずか".split()),
    "017_4-2": ("4", kana_drill("うた くつ たいせつ ちかてつ おととい".split())),
    "019_4-4": ("4", [_] * 13 + "うで どこ だい かど".split() + [_]),
    "023_5-2": ("5", kana_drill("なつ におい いぬ ねこ のど".split())),
    "025_6-2": ("6", kana_drill("はな ひと ふね ほそい へた".split())),
    "027_6-4": ("6", kana_drill("ひび かべ ぼく たばこ かぶき".split())),
    "030_6-7": ("6", [_] + sum([[_, w] for w in "ほかほか ぷかぷか ふかふか びくびく べたべた ぱたぱた ぽきぽき".split()], []) + [_]),
    "034_7-2": ("7", kana_drill("みず あめ なまえ むすこ のみもの".split())),
    "036_7-4": ("7", [_] * 2 + [_] * 6 + [_] + "やま ゆき よみかた ふゆ".split()),
    "038_8-2": ("8", kana_drill("ひる どれ いくら ひだり しろい".split())),
    "056_11-6": ("11", [_] + "ちょっと じゅっぷん しゅっちょう".split() + [_]),
    "070_14-2": ("14", kana_drill(["エアコン"])),
    "072_15-2": ("15", kana_drill("アジア サイズ エンジン".split())),
    "074_16-2": ("16", kana_drill("タイ インド センチ ダンス デザイン".split())),
    "075_17-1": ("17", [_] * 3 + "カード キー ケーキ コート".split()),
    "076_17-2": ("17", [_, _] + "ギター タクシー センター スキー".split() + [_] + "コート カーテン コンサート セーター".split() + [_]),
    "080_18-2": ("18", kana_drill("テニス ネクタイ エンジニア ノート".split(), n=5)),
    "082_19-2": ("19", kana_drill("パン バス ナイフ ビデオ テープ ピンポン".split())),
    "083_20-1": ("20", [_] * 3 + "コップ ポケット サッカー カセット".split()),
    "084_20-2": ("20", [_, _] + "ベッド コップ サッカー ホッチキス".split() + [_] + "カセット スイッチ ピクニック".split() + [_]),
    "088_21-2": ("21", kana_drill("メモ マッチ ミキサー ホームステイ".split(), n=5)),
    "090_22-2": ("22", kana_drill("タオル ライター アメリカ ロボット レストラン".split(), n=5)),
    "092_23-2": ("23", kana_drill("タワー タイヤ ワープロ ヨーロッパ".split(), n=5)),
    "094_24-1": ("24", [_] * 3 + "シャツ ジュース アクション".split()),
    "095_24-2": ("24", [_, _] + "シャツ シャワー シャープペンシル".split() + [_] + "ジュース ニュース スケジュール コンピューター ジョギング".split() + [_]),
}
SETS = [  # dictation: track, id, name, words
    ("011_2-5", "2-5", "第 2 课 听写①", "うえ こえ けが かぎ あおい がいこく"),
    ("012_2-6", "2-6", "第 2 课 听写②", "ごご かぎ えき かお きかい いいえ がいこく"),
    ("020_4-5", "4-5", "第 3～4 课 听写①", "うそ うで くつ じこ かぜ しずか ちかてつ"),
    ("021_4-6", "4-6", "第 3～4 课 听写②", "かさ どこ せかい かぞく すこし たいせつ おととい"),
    ("031_6-8", "6-8", "第 5～6 课 听写①", "はな いぬ ふね なに ぼく のど たばこ こいびと かぶき ぽかぽか"),
    ("032_6-9", "6-9", "第 5～6 课 听写②", "なに ひと へた ふね たばこ ほそい あぶない"),
    ("041_8-5", "8-5", "第 7～8 课 听写①", "やま よる どれ あめ ゆき むすこ いくら わたし みかん ともだち"),
    ("042_8-6", "8-6", "第 7～8 课 听写②", "みず ふゆ ひる さむい しろい なまえ ひだり りんご のみもの よみます"),
    ("046_9-3", "9-3", "第 9 课 长音听写", "おじいさん おばあさん おとうさん おかあさん おにいさん おねえさん いもうと おとうと"),
    ("047_9-4", "9-4", "第 9 课 长音听写②", "ちいさい おいしい えいが とおい きのう ゆうめい"),
    ("050_10-3", "10-3", "第 10 课 促音听写", "けっこん がっこう あさって まってください りんごがみっつあります"),
    ("053_11-3", "11-3", "第 11 课 拗音听写①", "じしょ おちゃ ひゃく かいしゃ しゅくだい"),
    ("057_11-7", "11-7", "第 11 课 拗音听写②", "とけい おはよう ざっし あさって おちゃ きょう かいしゃ ぎゅうにゅう"),
    ("077_17-3", "17-3", "片假名 听写①", "ドア ダンス サイズ センチ コート ウイスキー エンジン"),
    ("078_17-4", "17-4", "片假名 听写②", "タイ インド デザイン ギター タクシー センター セーター"),
    ("085_20-3", "20-3", "片假名 听写③", "テニス ピアノ バナナ テープ エンジニア ベッド スイッチ ホッチキス"),
    ("086_20-4", "20-4", "片假名 听写④", "ナイフ ネクタイ ノート スポーツ ビデオ ピンポン サッカー ポケット"),
    ("096_24-3", "24-3", "片假名 拗音听写①", "ゴム ミルク ラジカセ マレーシア シャツ コンピューター ジョギング"),
    ("097_24-4", "24-4", "片假名 拗音听写②", "ジュース タイヤ タワー メモ メニュー ロビー シャープペンシル"),
    ("100_25-3", "25-3", "外来语特殊音 听写", "ファックス フィリピン ボディ ミーティング チェック フォーク"),
    ("103_tesuto6", "T6", "片假名 总测验", "テレビ トイレ ビル コーヒー ピアノ ポスト シャワー スーパー ボールペン プレゼント テープレコーダー ロボット シャツ カメラ パーティー"),
]
ACCENT = ("010_akusento", [_, _, "acc1", _, "acc2", _, "acc3", _, "acc4", _])
SUJI = ("003_suji", [_] + "いち に さん よん し ご ろく なな しち はち きゅう く じゅう じゅういち じゅうに じゅうさん にじゅう さんじゅうご よんじゅうろく".split() + [_])

clips, problems = {}, []
def cut(track, labels, prefix, intro_skip=1):
    s = segs[track]
    if len(s) != len(labels): problems.append(f"{track}: {len(s)} segments, {len(labels)} labels"); return []
    got = []
    tmp = os.path.join(tempfile.gettempdir(), "tbcut.mp3")
    for (a, b), key in zip(s, labels):
        if key == _: continue
        subprocess.run([FF, "-v", "error", "-ss", f"{max(0, a - 0.06):.2f}", "-to", f"{b + 0.15:.2f}", "-i", os.path.join(DIR, track + ".mp3"),
                        "-af", "loudnorm=I=-18:TP=-2:LRA=7", "-ac", "1", "-ar", "24000", "-b:a", "48k", "-map_metadata", "-1", "-y", tmp], check=True)
        k = prefix + key
        if k not in clips: clips[k] = base64.b64encode(open(tmp, "rb").read()).decode()
        got.append(key)
    return got

words = []
for track, (lesson, labels) in EXAMPLES.items():
    for w in cut(track, labels, "tb:"):
        if w not in [x[0] for x in words]: words.append([w, lesson])
sets = []
for track, sid, name, ws in SETS:
    ws = ws.split(); intro = len(segs[track]) - 2 * len(ws)
    if intro < 1: problems.append(f"{track}: too few segments"); continue
    got = cut(track, dictation(ws, intro), "tb:")
    if got: sets.append([sid, name, got])
acc = cut(*ACCENT, "tb:")
suji = cut(*SUJI, "tb:")
json.dump({"clips": clips, "words": words, "sets": sets, "accent": acc, "suji": suji}, open(os.path.join(OUT, "tbook.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("clips", len(clips), "| example words", len(words), "| dictation sets", len(sets), "items", sum(len(s[2]) for s in sets), "| KB", round(sum(len(v) for v in clips.values()) * 3 / 4 / 1024))
print("problems:", problems or "none")

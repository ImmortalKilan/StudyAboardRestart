# BGM 方案 & Suno Prompts

本文档配套 `js/bgm.js`。架构已就绪——只要把音频文件按下方命名放进 `assets/bgm/`，游戏会自动加载。文件缺失时静默跳过，不会报错。

## 文件清单（10 首主 BGM）

文件目录：`assets/bgm/`，格式：`.ogg`（推荐，体积小、Web 兼容好）。也可用 `.mp3`，但要在 `js/bgm.js` 的 `TRACKS` 里改后缀。

| 文件名 | 触发时机 | 覆盖剧情线 |
|---|---|---|
| `title.ogg` | 开始屏、抽天赋、分配属性（`state.phase === 'talent'` / `'alloc'`） | — |
| `daily.ogg` | 推进中，无剧情线（`state.phase === 'game'` 且 `state.storyline === ''`） | — |
| `summary.ogg` | 结算屏（`state.phase === 'ended'`） | — |
| `special_bright.ogg` | 偶像/超级巨星/主播/网红/MCN/乐队 剧情线 | `idol`, `superstar`, `streamer`, `influencer`, `mcn`, `band` |
| `special_hustle.ogg` | 健身/厨师/运动员/学术/CEO 剧情线 | `fitness`, `chef`, `athlete`, `academic`, `ceo` |
| `special_neon.ogg` | 电竞/扑克/作弊 剧情线 | `esports`, `worlds`, `minor_league`, `poker`, `triton`, `local_shark`, `cheater` |
| `special_party.ogg` | 派对/堕落 剧情线 | `party`, `wasted` |
| `hidden_spy.ogg` | 间谍/深渊/Meta/时间循环 隐藏线 | `spy`, `abyss`, `meta`, `timeloop` |
| `hidden_xianxia.ogg` | 修仙/神偷 隐藏线 | `xianxia`, `thief` |
| `hidden_hogwarts.ogg` | 霍格沃茨 隐藏线 | `hogwarts` |

> 映射表在 `js/bgm.js` 的 `STORYLINE_TRACK` 常量里，可以随时改。

## 切换逻辑（自动，已实装）

引擎在 `render()` 末尾调用 `BGM.sync(state)`，由它自己决定当前应该播哪首：

- **600ms crossfade** 切歌，避免硬切
- 出现选择按钮（`state.pendingChoice` 非空）时 **duck**：音量降至 0.35 倍 + 低通 900Hz，让玩家专注阅读；选择完毕自动恢复
- 剧情线开场动画（`playStorylineIntro`）触发：**400ms 淡出当前 BGM**，播 sting（隐藏线用红色 sting，特殊线用金色 sting），动画结束后 500ms 淡入新剧情线的 BGM
- 静音按钮同时控制 SFX 和 BGM，沿用 `sasr_muted` localStorage 键
- 文件 fetch 失败时静默无声，不影响游戏运行

## Sting（短刺点，Web Audio 合成，已实装）

无需音频文件，全部由 `js/audio.js` 合成，已经能听到：

| 函数 | 时机 |
|---|---|
| `SFX.stingHiddenIntro()` | 隐藏剧情线开场（已埋点） |
| `SFX.stingSpecialIntro()` | 特殊剧情线开场（已埋点） |
| `SFX.stingDeath()` | 死亡判定（可在 `state.phase = 'ended'` 处替换 `sfxGameEnd()`，未替换） |
| `SFX.stingLegendary()` | 传奇结局命中 `LEGENDARY_ENDINGS`（未埋点，需要时加） |
| `SFX.stingSuccess()` | 出道/晋级成功（未埋点，可在各 `attempt*` 成功分支加） |
| `SFX.stingFail()` | 出道/晋级失败（同上） |

## Suno Prompts

每首 BGM 一条 prompt。建议用 **Custom Mode**，把 prompt 粘到 Style 字段，标题随意，Lyrics 留空（纯器乐）。生成多个版本里挑一个，**导出 mp3 → 转 ogg → 重命名到 `assets/bgm/`**。

**通用调参建议：**
- 时长：90–120 秒（loop 用，太短重复感强，太长加载慢）
- 风格关键词加 `looping, no fade out, instrumental, no vocals`
- 调性统一在 C 大调/A 小调家族里，切换时音乐不打架

> ⚠️ Suno 的商用条款：免费版生成的音乐不能商用，付费 Pro/Premier 才允许。如果游戏要发布到 Steam/App Store 收费分发，请用 Pro 订阅后重新生成。开源/非营利用免费版即可。

---

### 1. `title.ogg` — 开始屏

```
Nostalgic chiptune lo-fi, 8-bit Game Boy soundtrack, gentle arpeggiated lead in C major, soft square wave melody, mellow pulse bass, slow tempo 80 BPM, dreamy, slightly melancholic but hopeful, evoking late-night quiet study, instrumental, looping, no vocals, no fade out.
```

### 2. `daily.ogg` — 日常推进

```
Cozy lo-fi pixel RPG town theme, mellow chiptune with soft jazz chords, walking bassline, gentle major key progression, tempo 95 BPM, slice-of-life vibe, like a Studio Ghibli scene at a coffee shop, warm but not too cheerful, instrumental, looping seamlessly, no vocals.
```

### 3. `summary.ogg` — 结算屏

```
Reflective bittersweet chiptune ballad, slow piano with soft 8-bit pad, A minor to C major modulation, tempo 70 BPM, nostalgic life-review feeling like the end credits of a coming-of-age film, gentle but emotional, looping, instrumental, no vocals, no fade out.
```

### 4. `special_bright.ogg` — 偶像/网红族群

```
Upbeat J-pop chiptune idol stage anthem, bright synth lead, sparkling arpeggios, four-on-the-floor kick, energetic but cute, tempo 130 BPM, C major key, like a Sega Saturn idol game OST or BanG Dream chiptune cover, looping, instrumental, no vocals.
```

### 5. `special_hustle.ogg` — 拼搏族群（健身/厨师/学术/CEO）

```
Energetic synthwave training montage, driving 80s electronic drums, pulsing analog bass, soaring lead synth in C major, motivational and determined, tempo 125 BPM, like Rocky meets Stranger Things, building intensity, looping, instrumental, no vocals.
```

### 6. `special_neon.ogg` — 电竞/扑克族群

```
Cyberpunk competitive synthwave, dark neon pulse, fast arpeggiated bass, glitchy hi-hats, tempo 140 BPM, A minor, tense focused vibe like an esports tournament finals or a late-night poker table in Tokyo, sleek and dangerous, looping, instrumental, no vocals.
```

### 7. `special_party.ogg` — 派对/堕落

```
Hedonistic deep house club loop, throbbing four-on-the-floor kick, filtered synth stabs, hazy reverb, sub bass, tempo 124 BPM, F minor, slightly woozy and disorienting like a 4am after-party, looping, instrumental, no vocals.
```

### 8. `hidden_spy.ogg` — 间谍/深渊/Meta/时间循环

```
Dark spy thriller ambient loop, low pulsing sub bass, sparse muted trumpet stabs, eerie reverse cymbals, distant glitch percussion, tempo 100 BPM, F# minor, paranoid and cinematic like a John le Carré adaptation or Mr. Robot, tense and uneasy, looping, instrumental, no vocals.
```

### 9. `hidden_xianxia.ogg` — 修仙/神偷

```
Ancient Chinese cultivation cinematic, solo guzheng melody, bamboo flute (dizi) countermelody, soft taiko drum heartbeat, ethereal pad, pentatonic minor scale, tempo 90 BPM, mystical and otherworldly like a wuxia film score, evoking misty mountains and immortal cultivation, looping, instrumental, no vocals.
```

### 10. `hidden_hogwarts.ogg` — 霍格沃茨

```
Whimsical fantasy orchestral, celesta lead melody, light pizzicato strings, soft french horn, harp glissando flourishes, A minor, tempo 95 BPM, magical and curious like John Williams Harry Potter or Hedwig's Theme cousin, evoking candlelit libraries and floating staircases, looping, instrumental, no vocals.
```

## 生成流程

1. 注册 [suno.com](https://suno.com)（订阅 Pro 才能商用）
2. 点击 **Create** → 切到 **Custom** tab
3. **Lyrics** 留空 → 勾选 **Instrumental**
4. **Style** 字段粘上面对应的 prompt
5. **Title** 字段填编号，如 `title` / `daily`
6. 生成 → 试听两个版本 → 挑一个 → **Download (MP3)**
7. 用 [Audacity](https://www.audacityteam.org/)（免费）或 `ffmpeg` 转 ogg：
   ```bash
   ffmpeg -i title.mp3 -c:a libvorbis -q:a 4 title.ogg
   ```
8. 丢进 `assets/bgm/`
9. （可选）打开 `sw.js`，把对应行的 `// ` 注释去掉，加入离线缓存
10. **每次新增文件都要按 CLAUDE.md 规则升版本号**（`sw.js` + `index.html` + `version.json` 同步改）

## 调试

- 浏览器 DevTools → Console，应该看不到 BGM 报错（fetch 失败被吞掉）
- 静音按钮点一下，BGM 应立即静音（无淡出）
- 触发任一剧情线，应该听到 sting + 看到 BGM 切换（如果文件已就位）
- 出现选择按钮时，BGM 音量降低 + 听感变闷（duck）

## 风险与未来扩展

- **Suno 免费版商用限制**——如果游戏开源/非营利无所谓；商用必须 Pro
- **替代方案**——用 [Udio](https://udio.com)、[MusicGen](https://huggingface.co/spaces/facebook/MusicGen)、[Stable Audio](https://stableaudio.com)；或者 OpenGameArt CC0 现成素材
- **如果想 SFX/BGM 分别静音**——在 `js/bgm.js` 加独立的 `sasr_bgm_muted` 键，HTML 增加第二个按钮
- **如果想动态情绪**（HAP 高低影响 daily.ogg 滤镜）——可以在 `BGM.sync()` 中根据 `state.HAP` 调 lowpass cutoff，已有基础设施支持

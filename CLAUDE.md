# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

Pure static site — no build step, no bundler, no test suite. Pages use ES modules + `fetch` for the JSON data files, so they must be served over HTTP (opening `index.html` via `file://` will break).

```powershell
npx http-server -p 8000 -c-1 .
# or: python -m http.server 8000
```

Then open <http://127.0.0.1:8000>. After editing data JSON or JS, just hard-reload — `-c-1` disables caching. There is no lint, no typecheck, no test command; verification is done by playing through the affected event/storyline in the browser.

The only runtime dependency loaded from CDN is `html2canvas` (used by the summary screen's "生成人生档案" poster export). Everything else is hand-rolled.

## High-level architecture

The game is a **data-driven monthly life simulator**. Code in `js/` is the engine; gameplay content lives almost entirely in `data/*.json`. Adding new content rarely requires touching JS — you author events with conditions and branches, register them in `ages.json` or as random events, and the engine schedules them.

### Engine entry point and state

`js/game.js` is the monolith — main state machine, UI rendering, all storyline-specific logic. There's a single module-scoped mutable object `state` (around `game.js:895`) holding everything: stats, age, month, talents, current storyline, fired event ids, pending events/choices, summary tracking. Most functions read and mutate it directly. There's no framework — render is a manual `render()` function that diffs nothing and rewrites the relevant DOM.

Phase progression: `talent` → `alloc` → `playing` → `ended`. Screens (`start-screen`, `creation-screen`, `game-screen`, `summary-screen`) are toggled via the `.active` class.

### The monthly tick

`advanceMonth()` is the heartbeat. Each tick:

1. Drain `state.pendingEvent` (queued by branches from the previous event).
2. Check `yearlyPlan` for a fixed event scheduled this month.
3. Otherwise roll on `randomEvents` via `drawRandomEvent()` (weighted, filtered by `include`/`exclude`/`storyline`/`stage`).
4. Otherwise emit a seasonal flavor line.
5. Run storyline stage-clock updates (`updateIdolStage`, `updatePartyStage`, `updateFitnessStage`, etc.) and the storyline's `progressChecks` / `deathChecks` from `STORYLINE_CFG`.
6. Tick month/age, sync profession by age band, check death/retirement.

`yearlyPlan` is built lazily by `planYear(age)`: at year boundaries it picks 1–3 eligible events from `agesMap[age].event`, slots fixed-month events first, then randomly distributes flexible ones across months 2–12 (month 1 is reserved for main-line / fixed events).

### Two event pools — and why

- `data/events.json` → indexed by **age** via `data/ages.json`. These are the main story beats per year (admissions, exams, graduation milestones). Used by `planYear`.
- `data/random_events.json` (+ `xianxia_events.json` merged in) → drawn each month independently of age, weighted, conditional on storyline/stage. These produce flavor and branch into special storylines.

Both are stored in the same `eventsMap` keyed by `id`, so `branch` and `choices.next` ids work across pools transparently. When a non-`noRandom` event fires, it is added to `firedEvents` so it can never repeat (`repeatable: true` opts out).

### Condition DSL — `js/dsl.js`

Tiny expression evaluator used by `include` / `exclude` / `branch` / `choices.requireExpr` / `choices.showExpr`. Supports:

- Atoms: `KEY OP VALUE` where OP is one of `= == != > >= < <=`. String comparison is allowed (`school!=无`).
- Boolean: `&` (AND), `|` (OR), parentheses.
- Special atoms: `EVT?[id]` (has this event fired?), `TLT?[id]` (was this talent picked?).
- Aliases (`ALIASES` table): `IQ`→`INT`, `STR`→`PER`, `HEA`→`HLT`, `AGE`/`MTH`/`SEX`/`SCHOOL`/`PROF`/`MAJOR`/`HS`/`OVERSEAS`/`STORYLINE`/`REL`, plus xianxia keys (`cul`/`dao`/`karma`/`tribulation`).
- Synthetic vars: `AGE_AFTER_STORY`, `MTH_AFTER_STORY` — months/years since the current storyline started.

`pickBranch(state, branches)` walks `["cond?id", ...]` in order and returns the first match (empty cond = fallback). It also detects weighted form `"cond?id:weight"` and switches to weighted random pick over all matching branches. Use this when you want probabilistic outcomes rather than priority order.

### Branches vs choices

Two distinct mechanisms for non-linear flow:

- **`branch`** — engine-driven, no UI. After applying an event's effects, `pickBranch` resolves to a follow-up id which is queued in `state.pendingEvent` for the next tick.
- **`choices`** — player-driven. Sets `state.pendingChoice`, pauses auto-play, renders buttons in the event log. `resolveChoice(i)` runs `choice.next` (or inline `choice.effect`/`set`) when clicked. Choices have a global cooldown (`lastChoiceMonth`, ~8 months) outside storylines to keep pacing flavor-heavy. `choice.requireExpr` greys out a button; `choice.showExpr` hides it; `pickN` randomly subsamples a long list.

`choices` and `branch` are mutually exclusive on the same event — if `choices` is present and any are visible, `branch` is skipped.

### Storyline system

A "storyline" is a string flag on `state.storyline` (`spy`, `idol`, `xianxia`, `chef`, `athlete`, `fitness`, `poker`, `triton`, `esports`, `worlds`, `ceo`, `party`, `meta`, `abyss`, ...). It changes which random events are eligible: events with a `storyline` field only fire while `state.storyline` matches; events without it only fire while no storyline is active.

`STORYLINE_CFG` (top of `game.js`) declares per-storyline behavior:
- `gracePeriod` — months before death checks apply
- `eventRate` — biases random draw frequency inside the storyline
- `deathChecks` / `progressChecks` — array of `{ cond: state => bool, event: id|fn }` evaluated each tick
- `flavor` — fallback flavor line generator

`HIDDEN_STORYLINES` (spy/abyss/meta/xianxia) get a red cinematic intro and special log coloring; `SPECIAL_STORYLINES` (career paths) get a gold intro and unlock a hidden stat (`POP`/`POK`/`MMR`/`FIT`/`CKL`/`ATH`) shown in the side panel via `STORYLINE_UNLOCK_STAT`.

### Stage clocks (idol/party/esports/poker/fitness/chef/athlete)

Career storylines run a small state machine independent of the event system. Each has `init*Stage`, `update*Stage`, `compute*Prob`, `attempt*` functions following the same shape:

1. Enter a "training/prep/rookie/startup" stage for ~12 months — action button disabled.
2. Transition to a "window" stage where the player can manually trigger an attempt via the in-game banner (`#debut-box`, `#party-box`, `#fitness-box`, `#chef-box`, `#athlete-box`, `#poker-box`, `#esports-box`).
3. Probability is computed from stats, decays past a grace period to push the player to act, capped at floor/ceiling.
4. At a force length the engine auto-attempts.

Adding a new career storyline means: declaring an entry in `STORYLINE_CFG`, adding it to `SPECIAL_STORYLINES` and `STORYLINE_UNLOCK_STAT`, wiring an `init*Stage` call inside `applyEvent` (around `game.js:1241`) for `ev.set.storyline === '<name>'`, adding the banner div in `index.html`, and rendering it in `render()`.

### Cinematics — `js/cinematic.js`

`playStorylineIntro` / `playStorylineExit` are async overlay animations (FLIP-style transforms). When triggered, the engine sets `state.pendingCinematic = true`, stops auto-play, and saves the previous auto mode in `state._cineSavedAuto` so it can be resumed in the `onDone` callback. Any new code that pauses for an animation must follow this same save-and-restore pattern or auto-play will hang.

### Avatar — `js/avatar.js`

Pixel renderer drawing into a `<canvas>` via a 128×192 grid of color cells. Layered: background (varies by `storyline`/`profession`) → body (sex, skin by `HLT`, outfit by `MNY`) → hair (sex, color by `APP`, mess by `PER`) → face (eyes/glasses by `INT`, mouth by `HAP`, blush by `HLT`) → accessories (school badge, profession prop, belt). Idle animation runs via `requestAnimationFrame`. Three exports: `renderAvatar(state, canvas)` for the main game canvas, `createStandaloneAvatar(state)` for the start-screen wandering souls and summary screen, and the appearance variant fields on state (`faceVariant`, `topVariant`, `bottomVariant`, `outfitColorId`) for the "Fit Check" randomizer.

### Achievements — `js/achievements.js`

Persistent via `localStorage` key `studyAbroad_ach_v1`. Achievement defs live in the `ACHIEVEMENTS` array (id/name/icon/rarity/category/desc). `unlockAchievement(id)` is idempotent — calling again silently no-ops. Triggers fire from `_checkEventAchievements` inside `applyEvent`, plus a few sprinkled in `clampStats` (stat caps) and end-of-game logic. The `all_hidden` combo unlocks automatically when the four hidden-storyline achievements are all done.

When adding an achievement: append to `ACHIEVEMENTS`, then add the unlock trigger — usually inside `_checkEventAchievements` keyed off an event id, `ev.set` value, or storyline transition. Update the badge counter format `0/N` in `index.html` if the total changes (search for the count strings).

## Authoring workflow

### New main-line event
1. Add the event object to `data/events.json` (id unique; reserve id ranges by age for sanity).
2. Add the id to the `event` array in `data/ages.json` for the relevant age.
3. If it's a branch destination only, set `"noRandom": true` and reach it via another event's `branch` or `choices.next`.

### New random event / flavor event
Add to `data/random_events.json`. Use `weight` to bias draw probability (default 1). For storyline-locked events set `"storyline": "<name>"` (or array of names). For events that should fire only in a specific stage clock state, set `"stage": "<stage>"` (e.g. `"debut_window"`, `"comp_window"`).

### New talent
Append to `data/talents.json`. `effect` keys must be one of the visible base stats (`SOC`/`INT`/`MNY`/`PER`/`HLT`/`APP`); use `happyDelta` for `HAP`. Set `grade` 0–3 (rarity). `gachaDraw` enforces a pity rule: at least one purple/orange talent in any draw of 3.

### Hidden state keys

These exist on `state` and can be referenced in DSL but aren't shown in the UI:

| key | source | typical use |
| --- | --- | --- |
| `school` | `set` on admission events. US: `T20/T50/T100+/州大/社区大学`; UK: `G5/罗素/普通英校`; AU: `澳八大/普通澳校/私校`; EU: `顶尖欧校/公立大学/普通欧校`; HK: `港三/港八/普通港校`; JP: `帝大/早庆/普通日校`; SG: `新二/SMU/普通新校`; plus `海外硕`, `遣返`, `退学`, `无` | display string varies by country — use `TIER==top/mid/low` for cross-country gating, or `school==T20` for US-only events |
| `schoolTier` | `top` / `mid` / `low` — set alongside `school` on admission events | cross-country tier gating: `TIER==top` for premium events, `TIER==low` for struggle events |
| `country` | `美国` / `英国` / `澳洲` / `欧洲` / `香港` / `日本` / `新加坡` — set by admission events | gates country-specific flavor: `country==英国` for British humor, etc. |
| `countryIntent` | same value set as `country` — set by event 10220 (高三 9月 国际部 意向选择) | drives event 10301 admission branch routing (`countryIntent==英国` → UK admission events). Empty string falls back to US default |
| `hsType` | `国际` / `体制内` (set in HS branch) | drives college-prep paths |
| `overseas` | 0/1 | gates overseas-only events |
| `major` | `CS`/`商科`/`理科`/`文科`/`文艺` | doubles random event weight when matched |
| `profession` | `高中生`/`本科生`/`研究生`/`求职中`/etc | gates phase-appropriate events |
| `relationship` | `单身`/`恋爱中`/`已婚`/`二婚`/`离异`/`海王`/`海后` | gates romance progression |
| `storyline` | one of the storyline ids above, or `''` | full storyline routing |
| career stats | `POP`, `POK`, `MMR`, `FIT`, `CKL`, `ATH` | career storyline progress |
| xianxia stats | `cul`, `dao`, `karma`, `tribulation` | cultivation system, derived realm via `deriveRealm(cul)` |
| flags | `match_fixing`, `japan_path`, `jp_fluent`, `kohaku`, `scandal`, `party_clean`, `party_dirty`, `academic_dishonesty`, `late_dropout`, `hobby` | one-off booleans/strings set by `ev.set` and read by storyline progress checks |

The full alias table lives at the top of `js/dsl.js`. New hidden keys must be added there (or in the `ALIASES` map) before they can be referenced in conditions — otherwise `readVar` returns `undefined`.

### Endings

Any event with `"end": true` terminates the game (`state.phase = 'ended'`). The summary score and rank tier come from `LEGENDARY_ENDINGS` / `GOOD_ENDINGS` sets at the top of `game.js` plus stat-derived heuristics. Rare endings should be added to those sets so they get the right "S/A级" stamp on the summary screen.

## PWA / 离线支持

站点通过 Service Worker (`sw.js`) + Web App Manifest (`manifest.json`) 提供 PWA 离线能力。用户可在手机浏览器中"添加到主屏幕"获得类原生体验。

### 发布更新流程

每次 push 包含内容变更（JS / JSON / CSS / 图片）时，**必须同时修改 `sw.js` 第 3 行的版本号**：

```js
const CACHE_VER = 'sasr-v1';  // → 'sasr-v2', 'sasr-v3', ...
```

否则已安装的用户会一直使用旧缓存。版本号变更后，用户下次打开 App 时后台自动拉取新资源，关闭再重新打开即为新版本。

### 新增资源时

如果新增了图片、音效、JS 或 JSON 文件，需要同时将路径添加到 `sw.js` 的 `CORE_ASSETS` 数组中，否则该文件不会被离线缓存。

### 注意事项

- 跨域资源（CDN 上的 `html2canvas`、二维码 API）不受 SW 管理，断网时不可用
- iOS 上只有 Safari 支持 PWA 安装，Chrome/Firefox 不支持
- 移动端首次访问时会弹出安装引导（`#pwa-install-guide`），用户点"我知道了"后通过 `localStorage` 永久隐藏

## File map

- `js/game.js` — engine, monthly tick, all storyline logic, render loop, summary screen
- `js/dsl.js` — condition expression evaluator + branch picker (priority and weighted)
- `js/avatar.js` — pixel canvas renderer, standalone avatar factory
- `js/cinematic.js` — storyline intro/exit overlay animations
- `js/achievements.js` — unlock tracker + toast/wall UI, persisted to `localStorage`
- `data/talents.json` — talent pool, gacha-rolled
- `data/events.json` — age-pinned main-line events + branch destinations
- `data/random_events.json` — bulk of content; weighted monthly random pool
- `data/xianxia_events.json` — cultivation storyline events; merged into the random pool at load time
- `data/ages.json` — age → list of main-line event ids
- `js/memory.js` — memory card system (前世记忆), carousel UI, localStorage persistence
- `sw.js` — Service Worker, pre-caches all game assets for offline play
- `manifest.json` — PWA manifest (app name, icons, theme)
- `assets/icons/` — PWA icons (192×192, 512×512)
- `assets/avatars/` — currently only used for LPC sprite reference; the live avatar is procedurally drawn, not blitted

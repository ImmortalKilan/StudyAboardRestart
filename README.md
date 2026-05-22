# 留学重开模拟器

基于 [lifeRestart](https://github.com/VickScarlet/lifeRestart) 的二创。聚焦留学路径，从 15 岁开始，以**月**为最小时间单位推进人生。

一个纯静态、数据驱动的人生模拟器：引擎在 `js/`，绝大部分玩法内容都写在 `data/*.json` 里。加内容通常不需要改 JS——你写好带条件和分支的事件，注册到年龄池或随机事件池，引擎负责调度。

## 快速开始

页面用了 ES Modules + `fetch` 读取 JSON 数据文件，**必须走 HTTP 协议**（直接 `file://` 打开 `index.html` 会失败）。没有打包步骤、没有构建。

```powershell
cd New-Study-Aboard
npx http-server -p 8000 -c-1 .
# 或：python -m http.server 8000
```

浏览器打开 <http://127.0.0.1:8000> 即可。`-c-1` 关掉缓存，改完数据/JS 直接硬刷新即可。

没有 lint、没有 typecheck、没有测试命令——验证方式就是在浏览器里把对应的事件/剧情线玩一遍。

唯一从 CDN 加载的运行时依赖是 `html2canvas`（结算页"生成人生档案"海报导出用），其余全部手写。

### 联机模式（可选）

联机重开依赖一个 PeerJS 信令服务器，代码在 `peerjs-server/`：

```powershell
cd peerjs-server
npm install
npm start
```

## 玩法

1. **选择性别**：影响像素角色的体型，不显示在属性面板里。
2. **抽取天赋**：从天赋池抽 3 选若干（按 `grade` 加权，越稀有越难出；抽 3 必有一张紫/橙保底）。
3. **分配属性**：共 20 点，单项上限 10。
   - 可见属性：社交 / 智力 / 家境 / 健康 / 毅力 / 颜值
   - 快乐不参与分配，局内固定从 5 开始，上限 10
4. **月度推进**：每点一次"下一月"前进一个月。事件按年龄池抽取，每年 1–3 件随机分布到各月；其余月份从随机事件池抽，或显示季节性旁白。

游戏阶段：`talent`（抽天赋）→ `alloc`（分配属性）→ `playing`（推进）→ `ended`（结算）。

### 剧情线

游戏内藏有大量**剧情线**——触发后会切换可抽事件池，进入独立的小状态机。分两类：

- **职业线**（金色开场动画 + 解锁隐藏属性面板）：偶像、超级巨星、主播、扑克、电竞、健身、厨师、运动员、CEO、派对狂魔等。
- **隐藏线**（红色电影感开场 + 特殊日志配色）：间谍、深渊、Meta、修仙、神偷、霍格沃茨等。

职业线大多跑一套"训练 → 出道窗口 → 自动判定"的阶段时钟，玩家可在游戏内横幅手动触发尝试。

### 成就系统

61 个成就，通过 `localStorage` 持久化（key：`studyAbroad_ach_v1`）。从事件、属性封顶、剧情线转换、结局等处触发，结算页有"命运图谱"成就墙。

### 隐藏属性

很多属性存在于状态中、可被事件条件引用，但不在属性面板里显示。常用的有：

| 内部 key | 含义 | 说明 |
| --- | --- | --- |
| `school` / `schoolTier` | 学校 / 档位 | 录取事件设置，档位 `top/mid/low` 用于跨国通用门槛 |
| `country` / `countryIntent` | 国家 / 意向 | 美/英/澳/欧/港/日/新，驱动各国专属事件 |
| `profession` | 职业 | 高中生 / 本科生 / 研究生 / 求职中…… |
| `major` | 专业 | CS / 商科 / 理科 / 文科 / 文艺 |
| `relationship` | 感情状态 | 单身 / 恋爱中 / 已婚 / 海王…… |
| `storyline` | 剧情线 | 当前剧情线 id，空字符串表示无 |
| 职业/修仙属性 | `POP` `MMR` `FIT` `cul` `karma`… | 剧情线进度数值 |

完整别名表见 `js/dsl.js` 顶部。新隐藏 key 必须先加进别名表才能在条件里引用。

## 目录结构

```
New-Study-Aboard/
├── index.html        入口
├── styles.css        视觉
├── data/
│   ├── talents.json           天赋池（gacha 抽取）
│   ├── events.json            年龄主线事件 + branch 跳转目标
│   ├── ages.json              年龄 → 主线事件 id 映射
│   ├── random_events.json     随机事件池（内容主体，按月加权抽）
│   ├── xianxia_events.json    修仙线事件，加载时并入随机池
│   ├── hogwarts_events.json   霍格沃茨线事件，加载时并入随机池
│   ├── multiplayer_events.json 联机模式事件
│   └── flowchart.json         事件流程图数据
├── js/
│   ├── game.js        引擎：主状态机、月度调度、剧情线逻辑、渲染、结算
│   ├── dsl.js         include / exclude / branch 条件求值 + 分支选择器
│   ├── avatar.js      Canvas 像素角色渲染
│   ├── cinematic.js   剧情线开场/退场叠层动画
│   ├── achievements.js 成就解锁追踪 + 弹窗/成就墙
│   ├── audio.js       音效系统
│   ├── multiplayer.js 联机重开模式
│   └── flowchart.js   事件流程图视图
├── assets/
│   ├── avatars/       LPC 精灵参考图（实际角色为程序绘制）
│   └── sfx/           音效素材
└── peerjs-server/     联机用 PeerJS 信令服务器
```

## 引擎要点

### 月度心跳 `advanceMonth()`

每个月：① 排空上一事件 branch 留下的 `pendingEvent`；② 检查 `yearlyPlan` 是否有本月固定事件；③ 否则在 `randomEvents` 上加权抽取；④ 否则输出季节旁白；⑤ 跑剧情线阶段时钟与 `progressChecks` / `deathChecks`；⑥ 推进月/岁、按年龄段同步职业、检查死亡/退休。

`yearlyPlan` 由 `planYear(age)` 在年初懒构建：从 `ages.json` 该年龄的事件里挑 1–3 个，固定月事件先排，其余随机分布到 2–12 月（1 月留给主线）。

### 两个事件池

- `events.json` —— 按**年龄**经 `ages.json` 索引，每年的主线剧情节拍。
- `random_events.json`（+ 修仙/霍格沃茨事件并入）—— 每月独立加权抽取，按剧情线/阶段过滤。

两者都存进同一个以 `id` 为键的 `eventsMap`，所以 `branch` 和 `choices.next` 的 id 跨池通用。非 `repeatable` 事件触发后记入 `firedEvents`，不再重复。

### 分支 vs 选择

- **`branch`** —— 引擎驱动、无 UI。事件生效后 `pickBranch` 解析出后续 id，排进 `pendingEvent`。支持优先级写法 `"cond?id"` 和加权写法 `"cond?id:weight"`。
- **`choices`** —— 玩家驱动。暂停自动播放，在事件日志里渲染按钮，点击后执行 `choice.next` 或内联效果。

同一事件上 `branch` 和 `choices` 互斥。

## 数据模型

### 天赋 `data/talents.json`

```json
{
  "id": 2004,
  "grade": 2,
  "name": "竞赛获奖者",
  "description": "智力 +3，毅力 +1",
  "effect": { "INT": 3, "PER": 1 },
  "happyDelta": 0
}
```

- `grade`：0–3，越高越稀有
- `effect`：key 必须是可见属性 `SOC / INT / MNY / PER / HLT / APP` 之一
- `happyDelta`：对快乐（HAP）的额外增量

### 事件 `data/events.json` / `data/random_events.json`

```json
{
  "id": 10001,
  "text": "你正在念高一。父母问你要不要走留学路线。",
  "include": "AGE=15",
  "exclude": "",
  "noRandom": false,
  "weight": 1,
  "effect": { "INT": 1 },
  "happyDelta": -1,
  "set": { "school": "T20", "profession": "本科生" },
  "branch": ["MNY>=6?10002", "MNY<=2?10003", "?10004"]
}
```

- `include` / `exclude`：触发 / 排除条件表达式
- `noRandom: true`：不会被随机抽中，只能经 branch / choices 跳转进入
- `weight`：随机池抽取权重（默认 1）
- `storyline` / `stage`：剧情线 / 阶段时钟门槛
- `set`：覆盖隐藏属性
- `end: true`：终结游戏

### 条件 DSL

```
AGE>=17 & INT>=8 & SOC>=6      # 与
MNY>=6 | INT>=9                # 或
school!=无                     # 字符串 = / !=
EVT?[10001]                    # 某事件是否触发过
TLT?[2004]                     # 某天赋是否被选中
```

运算符 `= == != > >= < <=`，逻辑 `&` `|`，支持括号。小写键等价大写，别名表（`IQ`→`INT` 等）见 `js/dsl.js`。

## 扩展

### 加一个主线事件

1. 在 `data/events.json` 追加一条（id 不重复，建议按年龄区段规划）。
2. 在 `data/ages.json` 对应年龄的 `event` 数组里加上这个 id。
3. 若仅作 branch 结果，加 `"noRandom": true`，从别处 `branch`/`choices.next` 跳入。

### 加一个随机/旁白事件

在 `data/random_events.json` 追加，用 `weight` 调概率。剧情线专属事件加 `"storyline": "<名>"`，阶段专属加 `"stage": "<阶段>"`。

### 加一个天赋

在 `data/talents.json` 追加，`effect` key 限 `SOC / INT / MNY / PER / HLT / APP`，对快乐用 `happyDelta`，`grade` 取 0–3。

### 加一个成就

在 `js/achievements.js` 的 `ACHIEVEMENTS` 数组追加，再在 `applyEvent` 的 `_checkEventAchievements` 里加触发点。如果总数变了，记得同步 `index.html` 里 `0/N` 的计数。

更详细的引擎说明（剧情线配置、阶段时钟、电影动画、像素角色分层）见 [`CLAUDE.md`](./CLAUDE.md)。

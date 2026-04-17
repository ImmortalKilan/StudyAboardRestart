# 留学重开模拟器

基于 [lifeRestart](https://github.com/VickScarlet/lifeRestart) 的二创。聚焦留学路径，从 15 岁开始，以**月**为最小时间单位推进人生。

## 快速开始

依赖：Node.js（用来起一个静态服务器，因为页面用了 ES Modules + fetch，必须走 HTTP 协议）。

```bash
cd New-Study-Aboard
npx http-server -p 8000 -c-1 .
```

浏览器打开 <http://127.0.0.1:8000> 即可。

也可以用任何静态服务器替代，比如 `python -m http.server 8000`、VS Code Live Server 等。

## 玩法

1. **选择性别**：影响像素角色的体型，不显示在属性面板里。
2. **抽取天赋**：从 10 个天赋中选 3 个（天赋按 grade 加权抽取，越稀有越难出）。
3. **分配属性**：共 20 点，单项上限 10。
   - 可见属性：社交 / 智力 / 家境 / 健康 / 毅力 / 颜值
   - 快乐不参与分配，局内固定从 5 开始，上限 10
4. **月度推进**：每点一次"下一月"前进一个月。事件按年龄池抽取，每年 1–3 件随机分布到各月，其他月份显示季节性旁白。

### 隐藏属性

以下属性存在于状态中、可被事件条件引用，但不在属性面板里显示：

| 内部 key | 含义 | 初始 | 示例引用 |
| --- | --- | --- | --- |
| `age` (AGE) | 岁数 | 15 | `AGE=17` |
| `sex` (SEX) | 性别 0/1 | 选择 | `SEX=1` |
| `profession` (PROF) | 职业 | 高中生 | `PROF=研究生` |
| `school` (SCHOOL) | 学校 | 无 | `school!=无` |

它们会通过像素角色的外观变化间接表现（发型、服装、胸章、手持道具等）。

## 目录结构

```
New-Study-Aboard/
├── index.html        入口
├── styles.css        视觉
├── data/
│   ├── talents.json  天赋池
│   ├── events.json   事件库（含 include / exclude / branch）
│   └── ages.json     年龄 → 事件 id 映射
└── js/
    ├── dsl.js        include / exclude / branch 条件求值
    ├── avatar.js     Canvas 像素角色渲染
    └── game.js       主状态机 + 月度调度
```

## 数据模型

### 天赋 `data/talents.json`

```json
{
  "id": 2004,
  "grade": 2,
  "name": "竞赛获奖者",
  "description": "智力 +3，毅力 +1",
  "effect": { "IQ": 3, "STR": 1 },
  "happyDelta": 0
}
```

- `grade`: 0–3，越高越稀有（抽取权重 20 / 10 / 4 / 1）
- `effect`: 直接加在对应可见属性上
- `happyDelta`: 对快乐的额外修改（可选）

### 事件 `data/events.json`

```json
{
  "id": 10001,
  "text": "你正在念高一。父母问你要不要走留学路线。",
  "include": "AGE=15",
  "exclude": "",
  "noRandom": false,
  "effect": { "IQ": 1 },
  "happyDelta": -1,
  "set": { "school": "T20", "profession": "本科生" },
  "branch": ["MNY>=6?10002", "MNY<=2?10003", "?10004"]
}
```

- `include` / `exclude`: 触发 / 排除条件表达式
- `noRandom: true`: 不会被随机抽中，只能经 branch 跳转进入（典型是分支结果事件）
- `effect`: 触发时应用到可见属性的增量
- `happyDelta`: 对快乐的增量
- `set`: 覆盖隐藏属性（school / profession）
- `branch`: 按顺序匹配的跳转分支，第一个命中即跳；`?` 前为空表示兜底

### 年龄池 `data/ages.json`

```json
{
  "15": { "event": [10001, 10010, 10011, 10012, 10013] }
}
```

该年龄进入时从此数组随机抽取 1–3 个事件，`include` / `exclude` 过滤后排到 2–12 月（1 月由主线事件优先填）。

### 条件 DSL

与原项目一致，小写键也等价大写：

```
AGE>=17 & IQ>=8 & SOC>=6      # 且
MNY>=6 | IQ>=9                # 或
school!=无                    # 字符串 = / !=
```

可用变量：`AGE / MTH / SEX / IQ / STR / MNY / SOC / APP / HEA / HAP / school / profession`
支持运算符：`=  !=  >  >=  <  <=`
支持逻辑：`&`（与）、`|`（或）

Branch 分支写法：`"COND?id"`，`COND` 为空表示兜底。

## 扩展

### 加一个事件

1. 在 `data/events.json` 里追加一条（id 不重复即可，建议按年龄区段规划 id）。
2. 在 `data/ages.json` 对应年龄的 `event` 数组里加上这个 id。
3. 如果是 branch 结果事件，给它加 `"noRandom": true` 并从主线事件的 `branch` 跳进去。

### 加一个天赋

在 `data/talents.json` 追加一条，`effect` 的 key 必须是 `SOC / IQ / MNY / STR / HEA / APP` 之一，对快乐用 `happyDelta`。

### 调整像素角色

所有绘制逻辑集中在 `js/avatar.js`：

- `drawBody` — 体型（按性别）、皮肤（按健康）、服装（按家境）
- `drawHair` — 发型（按性别）、发色（按颜值）、刘海凌乱度（按毅力）
- `drawFace` — 眼睛 / 眼镜（按智力）、嘴型（按快乐）、腮红（按健康）
- `drawAccessories` — 胸章（按学校）、手持道具（按职业）、腰带（按毅力）

## 继承自原项目的逻辑

- 天赋抽取用的是 grade 加权随机
- 事件的 include / exclude / branch 条件系统
- 事件的 noRandom 标记用于分支结果
- 年龄 → 事件池的随机抽取

## 已知简化 / 与原作差异

- 时间粒度：月（原作：年）
- 起始年龄：15（原作：0）
- 天赋数量：7 个维度（原作：4 个主属性 + 更细）
- 初始属性分配：6 项共 20 点（快乐不参与）
- UI 与原作不同：左侧像素角色 + 属性面板，右侧事件流

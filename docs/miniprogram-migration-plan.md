# 留学重开模拟器 → 微信小程序迁移方案

## 一、现状盘点

### 代码规模
| 模块 | 行数 | DOM 依赖 | 迁移难度 |
|------|------|---------|---------|
| `game.js` (引擎主体) | 9,087 | **重度** — 99× document, 111× addEventListener, 81× innerHTML | 需拆分：逻辑层直接复用，UI 层全部重写 |
| `dsl.js` (条件表达式) | 209 | **零** | ✅ 原样复用 |
| `avatar.js` (像素头像) | 2,229 | 极少 DOM，重度 Canvas (29×) | 小程序 Canvas API 略有差异，需适配 |
| `moments.js` (朋友圈) | 3,425 | 重度 DOM | UI 全部重写，数据逻辑复用 |
| `flowchart.js` (剧情树) | 982 | 重度 DOM + Canvas | UI 重写，Canvas 适配 |
| `achievements.js` | 481 | 中度 DOM | 数据逻辑复用，UI 重写 |
| `memory.js` (前世记忆) | 506 | 中度 DOM + Canvas | 同上 |
| `relic.js` (遗物系统) | 996 | 中度 DOM | 同上 |
| `audio.js` (音效) | 300 | Web Audio API | 改用 `wx.createInnerAudioContext()` |
| `cinematic.js` (过场动画) | 110 | 纯 DOM 动画 | 用小程序 animation API 重写 |
| `multiplayer.js` | 490 | 极少 DOM | 逻辑复用，通信层改 WebSocket/云函数 |

### 数据文件（1.2MB，全部 JSON）
全部原样复用。小程序打包进代码包或放云存储按需加载。

| 文件 | 行数 | 说明 |
|------|------|------|
| `random_events.json` | 32,692 | 最大文件，~750KB |
| `hogwarts_events.json` | 3,003 | |
| `events.json` | 2,942 | |
| `flowchart.json` | 1,193 | |
| `xianxia_events.json` | 941 | |
| `timeloop_events.json` | 678 | |
| `multiplayer_events.json` | 362 | |
| `ages.json` | 116 | |
| `talents.json` | 91 | |

### 静态资源
- **SFX 音效**: 184KB (22 个 ogg 文件) — 需转 mp3（小程序不支持 ogg）
- **UI 图片**: 652KB
- **PWA 图标**: 484KB（小程序不需要，替换为小程序 tabBar 图标）
- **avatars/**: 21MB — 仅 LPC 参考素材，不需要迁移（头像是 Canvas 程序化渲染）

### 包体预估
小程序代码包限制：**单包 2MB，总包 20MB**（分包）。

| 内容 | 大小 | 归属 |
|------|------|------|
| JS 逻辑代码 | ~200KB (minified) | 主包 |
| 样式 (WXSS) | ~80KB | 主包 |
| WXML 模板 | ~30KB | 主包 |
| 核心数据 (ages + events + talents) | ~400KB | 主包 |
| 大型数据 (random_events + hogwarts + xianxia + timeloop) | ~800KB | 分包/云存储 |
| 音效 (mp3) | ~150KB | 分包 |
| UI 图片 | ~400KB | 分包/CDN |
| **主包合计** | **~710KB** | ✅ 远低于 2MB |
| **总计** | **~2.1MB** | ✅ 分包可解 |

---

## 二、架构设计

### 核心思路：逻辑层与视图层分离

现在 `game.js` 是一个 9000 行的巨石，逻辑和 DOM 操作混在一起。迁移的关键是**拆分**：

```
现状:
  game.js = 游戏引擎 + UI 渲染 + 事件监听 (全混在一起)

目标:
  engine/core.js    = 纯状态机（state, advanceMonth, applyEvent, clampStats...）
  engine/dsl.js     = 条件求值（原样复用）
  engine/storyline.js = STORYLINE_CFG, 阶段时钟逻辑
  engine/endings.js = LEGENDARY_ENDINGS, GOOD_ENDINGS, 评分
  pages/game/       = 小程序页面（WXML 模板 + WXSS + Page 逻辑）
```

引擎层输出纯数据对象，视图层通过 `setData()` 驱动 WXML 模板渲染。这个拆分同时也让 Web 版受益（后续可以上框架）。

### 页面结构

```
miniprogram/
├── app.js / app.json / app.wxss          # 全局
├── engine/                                # 纯 JS 逻辑层（从 Web 版提取）
│   ├── core.js                            # 状态机 + advanceMonth + applyEvent
│   ├── dsl.js                             # 原样复用
│   ├── storyline.js                       # STORYLINE_CFG + stage clocks
│   ├── endings.js                         # 结局分类 + 评分
│   ├── achievements.js                    # 成就数据 + 解锁逻辑（无 UI）
│   ├── moments-data.js                    # 朋友圈 NPC 数据 + 生成逻辑（无 UI）
│   ├── memory-data.js                     # 记忆卡数据逻辑
│   └── relic-data.js                      # 遗物数据逻辑
├── pages/
│   ├── start/                             # 开始画面
│   ├── creation/                          # 天赋抽取 + 属性分配
│   ├── game/                              # 主游戏局内
│   │   ├── game.wxml                      # 左面板(头像+属性) + 右面板(事件流)
│   │   ├── game.wxss
│   │   └── game.js
│   ├── summary/                           # 结算画面
│   └── moments/                           # 朋友圈（独立页面 or 半屏弹窗）
├── components/
│   ├── avatar/                            # Canvas 头像组件
│   ├── stat-grid/                         # 属性面板
│   ├── event-log/                         # 事件流滚动区
│   ├── choice-panel/                      # 选项按钮组
│   ├── achievement-wall/                  # 成就墙
│   ├── memory-panel/                      # 前世记忆
│   ├── relic-panel/                       # 遗物系统
│   └── flowchart/                         # 剧情树 (Canvas)
├── data/                                  # JSON 数据（主包放核心，分包放大文件）
└── utils/
    ├── storage.js                         # wx.setStorageSync 封装
    └── audio.js                           # wx.createInnerAudioContext 封装
```

### 数据流

```
用户点击 → Page.bindtap → engine.advanceMonth() → 返回新 state
                                                       ↓
                                              Page.setData(viewModel)
                                                       ↓
                                              WXML 模板自动更新
```

小程序的 `setData` 有性能开销（数据要序列化过 bridge），所以需要：
- 只传增量（`setData({ 'stats.INT': 5 })` 而非整个 state）
- 事件流用虚拟列表（`scroll-view` + `wx:for`）只渲染可见区域
- 头像 Canvas 独立刷新，不走 setData

---

## 三、模块迁移清单

### 🟢 直接复用（改动 < 5%）

| 模块 | 工作 |
|------|------|
| `dsl.js` | 零改动，去掉 `export` 改 `module.exports` 或用小程序 ES module |
| 全部 JSON 数据 | 零改动 |
| 状态机核心逻辑 | 从 game.js 提取 `advanceMonth`, `applyEvent`, `pickBranch`, `drawRandomEvent`, `planYear`, `clampStats`。这些函数操作的是纯 `state` 对象，不碰 DOM |
| STORYLINE_CFG + 阶段时钟 | 纯逻辑，直接提取 |
| 成就数据 + 解锁逻辑 | `ACHIEVEMENTS` 数组 + `unlockAchievement` 逻辑部分，localStorage → `wx.setStorageSync` |
| 遗物数据逻辑 | 遗物池 + 抽取 + mutation 逻辑是纯计算 |

### 🟡 需要适配（改动 20-50%）

| 模块 | 改动点 |
|------|--------|
| `avatar.js` | Web Canvas → 小程序 `Canvas 2D`。API 几乎一样（`getContext('2d')`），但获取 Canvas 节点的方式不同：`wx.createSelectorQuery().select('#avatar').fields({node:true})` |
| `audio.js` | `AudioContext` → `wx.createInnerAudioContext()`；ogg → mp3；Web Audio 合成音效 → 预录 mp3 或 `wx.createWebAudioContext()`（基础库 2.19+） |
| `memory.js` 逻辑 | 卡牌数据 + 解锁逻辑复用；Canvas 渲染适配 |
| 存储层 | 全局替换 `localStorage` → `wx.setStorageSync` / `wx.getStorageSync`，接口形态一致，工作量很小 |
| 数据加载 | `fetch('data/xxx.json')` → 主包内 `require('./data/xxx.json')` 或分包 `wx.request` 从云存储拉取 |

### 🔴 需要重写（改动 > 70%）

| 模块 | 说明 |
|------|------|
| 主游戏 UI (`game.js` 的 render 部分) | 所有 `getElementById` / `innerHTML` / `classList` 操作 → WXML 模板 + `setData` 数据绑定。这是最大的工作量 |
| `moments.js` UI | FAB + 底部弹窗 → 小程序 `page-container` 半屏弹窗 or 独立页面 |
| `cinematic.js` | DOM 动画 → 小程序 `wx.createAnimation` 或 CSS animation（WXSS 支持） |
| `flowchart.js` UI | Canvas 交互 → 小程序 Canvas 2D + touch 事件适配 |
| 结算页 + 海报生成 | `html2canvas` → 小程序 `Canvas` 手绘海报 + `wx.canvasToTempFilePath` 导出 |
| 开始页 + 创建页 | UI 重写，逻辑简单 |

---

## 四、小程序独有优势（做了才有的功能）

### 1. 分享裂变
```js
// 结算页分享
wx.showShareMenu({ withShareTicket: true });

// 自定义分享卡片
onShareAppMessage() {
  return {
    title: `我在留学重开模拟器获得了「${endingName}」结局！`,
    path: '/pages/start/start',
    imageUrl: posterTempFilePath  // Canvas 生成的海报
  };
}

// 朋友圈分享（单页模式）
onShareTimeline() {
  return {
    title: '留学重开模拟器 — 你的留学人生会怎样？',
    query: 'from=timeline'
  };
}
```

### 2. 订阅消息（召回）
- "你上次的存档还在等你" — 7天未玩推送
- "新版本更新了 3 条新剧情线" — 版本更新推送

### 3. 云开发（可选，后期）
- 匿名排行榜：结局收集率、最高分
- 多人对战：用云函数做房间匹配，比现在的 PeerJS WebRTC 稳定得多
- 数据统计：哪些结局被触发最多/最少，指导内容运营

### 4. 小程序广告（变现，可选）
- 激励视频：看广告多抽一个天赋 / 多一次属性点
- 插屏广告：结算页展示

---

## 五、工作计划

### Phase 1: 引擎提取（1-2 天）
**目标**: 把 `game.js` 的纯逻辑从 DOM 操作中剥离出来。

这一步在 Web 版上做，不碰小程序。拆完之后 Web 版照常运行，但代码结构更清晰。

- [ ] 从 `game.js` 提取 `engine/core.js`：state 初始化、advanceMonth、applyEvent、clampStats、drawRandomEvent、planYear
- [ ] 提取 `engine/storyline.js`：STORYLINE_CFG、所有 stage clock 函数
- [ ] 提取 `engine/endings.js`：LEGENDARY_ENDINGS、GOOD_ENDINGS、评分逻辑
- [ ] `game.js` 保留为 Web 版的 UI 壳，import 引擎模块
- [ ] 验证 Web 版功能不变

### Phase 2: 小程序骨架（1-2 天）
- [ ] `wx init` 创建项目，配置 app.json 页面路由
- [ ] 复制 engine/ + data/ + dsl.js 进小程序
- [ ] 实现 `pages/start`（简单启动页）
- [ ] 实现 `pages/creation`（天赋抽取 + 属性分配）
- [ ] 存储层封装 `utils/storage.js`

### Phase 3: 核心游戏页（3-5 天）⭐ 主要工作量
- [ ] `pages/game` WXML 模板：属性面板 + 事件流 + 选项按钮
- [ ] setData 增量更新策略
- [ ] 事件流虚拟滚动
- [ ] `components/avatar` Canvas 头像适配
- [ ] 选项交互、自动推进、速度控制
- [ ] 剧情入场/退场动画

### Phase 4: 子系统 UI（2-3 天）
- [ ] 成就墙 + 结局图鉴
- [ ] 朋友圈系统
- [ ] 前世记忆
- [ ] 遗物系统
- [ ] 剧情树（可后期）

### Phase 5: 小程序特色功能（1-2 天）
- [ ] 分享卡片（结算海报 Canvas 绘制 + onShareAppMessage）
- [ ] 音效适配（ogg → mp3）
- [ ] 朋友圈分享
- [ ] 数据加载优化（分包 / 云存储）

### Phase 6: 打磨 & 提审（2-3 天）
- [ ] 适配不同机型（iPhone SE ~ iPad）
- [ ] 性能优化（setData 频率、内存占用）
- [ ] 小程序审核合规检查（游戏类目需要版号？文字类模拟经营通常不需要）
- [ ] 提交审核

### 总工期预估：10-17 天

---

## 六、风险和注意事项

### 审核风险
- 微信小程序「游戏」类目需要《网络游戏出版物号（ISBN）》，但**文字模拟类通常归为「工具/娱乐」类目**，不需要版号
- 避免出现「博彩」相关字眼（扑克剧情线的描述可能需要调整措辞）
- 内容审核：部分剧情（代考、黑客）可能触发敏感词，需要文案微调

### 性能风险
- `random_events.json` 有 32,000 行（~750KB），小程序内存有限。方案：启动时加载，解析后只保留必要字段的索引，不要全量持久化在 Page.data 里
- `setData` 频率：advanceMonth 每秒可能调多次（快进模式），需要做 batch 合并（`requestAnimationFrame` 节流 or 手动 debounce）
- Canvas 头像：小程序 Canvas 2D 性能比 Web 差，idle animation 可能需要降帧

### 功能取舍（v1 可以先不做）
- 🚫 多人对战 — 需要后端，v1 先砍
- 🚫 剧情树可视化 — Canvas 交互复杂，v1 先砍
- 🚫 海报导出 — v1 用分享卡片代替，后期加 Canvas 海报
- ✅ 核心游戏循环 — 必须完整
- ✅ 成就 + 结局收集 — 重玩动力核心
- ✅ 朋友圈系统 — 游戏特色
- ✅ 分享裂变 — 小程序做的理由之一

---

## 七、关于 Claude 能帮你做什么

我可以直接帮你做的：
1. **Phase 1 引擎提取** — 这是纯重构，我可以直接在现有代码上做
2. **engine/ 模块** — 纯 JS 逻辑，我可以写
3. **WXML/WXSS 模板** — 我可以写，但需要你在微信开发者工具里预览和调试
4. **音效转换脚本** — ogg → mp3 批量转换

需要你做的：
1. 注册小程序账号、配置 AppID
2. 在微信开发者工具中调试和预览
3. 审核类目选择和提交
4. 真机测试（不同 iPhone/Android 机型）

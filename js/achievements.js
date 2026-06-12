// ── Achievement System ─────────────────────────────────────────────────────
// Persistent via localStorage; toasts slide in from bottom-right;
// achievement wall opened via trophy button (top-right).

const STORAGE_KEY = 'studyAbroad_ach_v1';

export const ACHIEVEMENTS = [
  // ── 里程碑 ──────────────────────────────────────────────────────────────
  { id: 'first_play',       name: '人生重来',     icon: '🔄', rarity: 'normal',    cat: '里程碑', desc: '开始了第一次留学重开' },
  { id: 'school_t20',       name: '名校之路',     icon: '🎓', rarity: 'rare',      cat: '里程碑', desc: '成功进入顶尖大学（T20 / G5 / 港三 / 帝大 等）' },
  { id: 'school_expelled',  name: '学业未竟',     icon: '📋', rarity: 'normal',    cat: '里程碑', desc: '被学校开除或遣返回国' },
  { id: 'stat_max',         name: '天赋异禀',     icon: '💪', rarity: 'rare',      cat: '里程碑', desc: '某项基础属性达到了 10 点' },
  { id: 'stat_negative',    name: '人生低谷',     icon: '📉', rarity: 'normal',    cat: '里程碑', desc: '某项基础属性跌入了负数' },
  { id: 'all_hidden',       name: '见过世面',     icon: '👁️', rarity: 'legendary', cat: '里程碑', desc: '解锁了全部隐藏剧情' },

  // ── 感情 ─────────────────────────────────────────────────────────────────
  { id: 'romance_first',    name: '初坠爱河',     icon: '💕', rarity: 'normal',    cat: '感情',   desc: '触发了人生第一段恋爱' },
  { id: 'romance_married',  name: '白头到老',     icon: '💍', rarity: 'rare',      cat: '感情',   desc: '步入了婚姻殿堂' },
  { id: 'romance_sea_king', name: '海王/海后',    icon: '🌊', rarity: 'epic',      cat: '感情',   desc: '成为了游走情场的海王' },
  { id: 'romance_divorced', name: '此情成追忆',   icon: '💔', rarity: 'normal',    cat: '感情',   desc: '经历了一段失败的婚姻' },

  // ── 剧情 ─────────────────────────────────────────────────────────────────
  { id: 'sl_spy',           name: '代号：留学生', icon: '🕵️', rarity: 'epic',      cat: '剧情',   desc: '踏上了国际特工之路' },
  { id: 'sl_xianxia',       name: '踏上修真路',   icon: '🌸', rarity: 'epic',      cat: '剧情',   desc: '踏入了修真世界' },
  { id: 'sl_abyss',         name: '深渊研究员',   icon: '🔬', rarity: 'epic',      cat: '剧情',   desc: '进入了深渊科技机构' },
  { id: 'sl_meta',          name: '破局者',       icon: '📺', rarity: 'epic',      cat: '剧情',   desc: '发现了世界的本质' },
  { id: 'sl_idol',          name: '练习生涯',     icon: '🎤', rarity: 'rare',      cat: '剧情',   desc: '开启了偶像出道之路' },
  { id: 'sl_superstar',     name: '巨星崛起',     icon: '⭐', rarity: 'epic',      cat: '剧情',   desc: '踏上了超级巨星之路' },
  { id: 'sl_streamer',      name: '网红大梦',     icon: '📱', rarity: 'rare',      cat: '剧情',   desc: '开始了网红主播生涯' },
  { id: 'sl_party',         name: '派对狂魔',     icon: '🎉', rarity: 'rare',      cat: '剧情',   desc: '成为了留学圈的派对局长' },
  { id: 'sl_poker',         name: '地下牌局',     icon: '🃏', rarity: 'rare',      cat: '剧情',   desc: '踏入了地下扑克圈' },
  { id: 'sl_esports',       name: '电竞新星',     icon: '🎮', rarity: 'rare',      cat: '剧情',   desc: '踏入了职业电竞赛场' },
  { id: 'sl_wasted',        name: '南柯梦境',     icon: '🌙', rarity: 'rare',      cat: '剧情',   desc: '陷入了颓废的南柯梦' },
  { id: 'sl_worlds',        name: '赛场巅峰',     icon: '🏆', rarity: 'epic',      cat: '剧情',   desc: '踏上了电竞世界赛之路' },
  { id: 'sl_fitness',       name: '铁血健将',     icon: '💪', rarity: 'rare',      cat: '剧情',   desc: '踏上了健美之路' },
  { id: 'sl_chef',          name: '围裙新星',     icon: '👨‍🍳', rarity: 'rare',      cat: '剧情',   desc: '踏入了校园厨神的世界' },
  { id: 'sl_athlete',       name: '运动少年',     icon: '⚽', rarity: 'rare',      cat: '剧情',   desc: '加入了校队，开启运动生涯' },
  { id: 'sl_thief',         name: '影子协会',     icon: '🦊', rarity: 'epic',      cat: '剧情',   desc: '收到了影子协会的邀请' },
  { id: 'sl_hogwarts',      name: '魔法学徒',     icon: '🪄', rarity: 'epic',      cat: '剧情',   desc: '收到了霍格沃茨的入学通知书' },
  { id: 'sl_academic',      name: '学术深渊',     icon: '💻', rarity: 'rare',      cat: '剧情',   desc: '发现了学校考试系统的漏洞' },

  // ── 终局 ─────────────────────────────────────────────────────────────────
  { id: 'end_health',       name: '油尽灯枯',     icon: '💀', rarity: 'normal',    cat: '人生',   desc: '因健康耗尽而离开了人世' },
  { id: 'end_idol',         name: '闪耀登场',     icon: '🌟', rarity: 'epic',      cat: '终局',   desc: '成功以偶像身份出道' },
  { id: 'end_spy',          name: '特工的荣耀',   icon: '🏅', rarity: 'legendary', cat: '终局',   desc: '圆满完成了国际特工任务' },
  { id: 'end_abyss',        name: '深渊彼岸',     icon: '🌌', rarity: 'legendary', cat: '终局',   desc: '完成了深渊科技剧情' },
  { id: 'end_meta',         name: '第五面墙',     icon: '🔮', rarity: 'legendary', cat: '终局',   desc: '和屏幕另一边的人和解了' },
  { id: 'end_ceo',          name: '商界传奇',     icon: '💼', rarity: 'legendary', cat: '终局',   desc: '成功转型，成为了 CEO' },
  { id: 'end_worlds',       name: '全球冠军',     icon: '🥇', rarity: 'legendary', cat: '终局',   desc: '赢得了电竞世界赛冠军' },
  { id: 'end_xianxia',      name: '羽化登仙',     icon: '✨', rarity: 'legendary', cat: '终局',   desc: '踏入修真之路，最终成仙' },
  { id: 'end_fitness',      name: '健美传奇',     icon: '🏋️', rarity: 'legendary', cat: '终局',   desc: '站上了健美巅峰的舞台' },
  { id: 'end_chef',         name: '三星主厨',     icon: '⭐', rarity: 'legendary', cat: '终局',   desc: '获得了米其林三星评级' },
  { id: 'end_athlete',      name: '体坛之巅',     icon: '🏆', rarity: 'legendary', cat: '终局',   desc: '成为了职业体育的传奇' },
  { id: 'end_thief',        name: '幽灵评级',     icon: '👻', rarity: 'legendary', cat: '终局',   desc: '达到了影子协会最高评级' },
  { id: 'end_hogwarts',     name: '救世之星',     icon: '⚡', rarity: 'legendary', cat: '终局',   desc: '摧毁了所有魂器，彻底终结了黑魔王' },
  { id: 'end_academic_white', name: '白骑士',    icon: '🛡️', rarity: 'legendary', cat: '终局',   desc: 'CVE上有你的名字——Google Project Zero最年轻的成员' },
  { id: 'end_academic_black', name: 'Ghost',     icon: '👻', rarity: 'legendary', cat: '终局',   desc: '金盆洗手，无人知晓你曾是暗网上的Ghost' },
  { id: 'sl_band',           name: '地下新声',   icon: '🎸', rarity: 'rare',      cat: '剧情',   desc: '加入了一支地下乐队，虽然你只是贝斯手' },
  { id: 'end_band_win',      name: 'Encore!',    icon: '🏆', rarity: 'legendary', cat: '终局',   desc: '在Battle of the Bands中获得冠军，全场高喊Encore' },
  { id: 'sl_cheater',        name: '天才枪手',   icon: '🎭', rarity: 'rare',      cat: '剧情',   desc: '踏入了代考的灰色地带' },
  { id: 'end_cheater_empire', name: '考神',       icon: '🧠', rarity: 'legendary', cat: '终局',   desc: '建立了跨国代考帝国' },
  { id: 'end_cheater_ghost',   name: '零日',      icon: '🕹️', rarity: 'legendary', cat: '终局',   desc: '成为暗网上让所有考试系统颤抖的传说' },

  // ── 专业传奇终局 ──────────────────────────────────────────────────────────
  { id: 'end_ee',           name: '半导体教父',   icon: '🔬', rarity: 'legendary', cat: '终局',   desc: '在芯片领域封神，重塑了半导体产业格局' },
  { id: 'end_me',           name: '智造先驱',     icon: '🏭', rarity: 'legendary', cat: '终局',   desc: '成为总工程师或智造独角兽创始人' },
  { id: 'end_bio',          name: '新药教父',     icon: '🧬', rarity: 'legendary', cat: '终局',   desc: '研发出重磅新药，改变了医药行业' },
  { id: 'end_med',          name: '杏林圣手',     icon: '🩺', rarity: 'legendary', cat: '终局',   desc: '成为科室主任或以自己命名了新术式' },
  { id: 'end_law',          name: '法界泰斗',     icon: '⚖️', rarity: 'legendary', cat: '终局',   desc: '成为管理合伙人或首席大检察官' },
  { id: 'end_film',         name: '金棕榈之夜',   icon: '🎬', rarity: 'legendary', cat: '终局',   desc: '作为导演斩获国际顶级电影奖' },
  { id: 'end_cs',           name: '硅谷传奇',     icon: '💻', rarity: 'legendary', cat: '终局',   desc: '成为大厂核心或连续创业传奇' },
  { id: 'end_biz',          name: '金融之王',     icon: '💹', rarity: 'legendary', cat: '终局',   desc: '登顶投行或风投界的巅峰' },
  { id: 'end_sci',          name: '学术巨擘',     icon: '🔭', rarity: 'legendary', cat: '终局',   desc: '以全奖直博身份成为学界泰斗' },
  { id: 'end_art',          name: '传世大家',     icon: '🖋️', rarity: 'legendary', cat: '终局',   desc: '作品跨越时代，成为文学/艺术大师' },
  { id: 'end_music',        name: '乐坛传奇',     icon: '🎵', rarity: 'legendary', cat: '终局',   desc: '在音乐领域达到传奇地位' },

  // ── 跨界彩蛋 ──────────────────────────────────────────────────────────────
  { id: 'easter_rhythm',     name: '节奏大师',     icon: '🎹', rarity: 'epic',      cat: '彩蛋',   desc: '音乐爱好者×CS×日本：做出了上架的音游' },
  { id: 'easter_viral',      name: '病毒式传播',   icon: '📹', rarity: 'epic',      cat: '彩蛋',   desc: '电影爱好者×商科×美国：校园纪录片爆红' },
  { id: 'easter_novelist',   name: '跨界作家',     icon: '📖', rarity: 'epic',      cat: '彩蛋',   desc: '法律爱好者×文艺×英国：法律小说出版' },
  { id: 'easter_coral',      name: '科学影像师',   icon: '🪸', rarity: 'epic',      cat: '彩蛋',   desc: '科学爱好者×电影×澳洲：珊瑚纪录片被BBC转发' },
  { id: 'easter_synth',      name: '声音炼金师',   icon: '🔊', rarity: 'epic',      cat: '彩蛋',   desc: '音乐爱好者×理科×欧洲：物理建模合成器走红' },
  { id: 'easter_medtech',    name: '赛博华佗',     icon: '🧬', rarity: 'epic',      cat: '彩蛋',   desc: '医学爱好者×CS×新加坡：AI辅助诊断获奖' },
  { id: 'easter_courtroom',  name: '模拟大律师',   icon: '⚖️', rarity: 'epic',      cat: '彩蛋',   desc: '法律爱好者×商科×香港：模拟庭审全场最佳' },
  { id: 'easter_nomad',      name: '数字游牧',     icon: '🌍', rarity: 'epic',      cat: '彩蛋',   desc: '科技爱好者×商科×欧洲：远程创业走遍三国' },

  // ── 时间回环 ───────────────────────────────────────────────────────────
  { id: 'sl_timeloop',         name: '既视感',       icon: '🔁', rarity: 'epic',      cat: '剧情',   desc: '时间开始重复了' },
  { id: 'end_timeloop',        name: '阳光的角度',   icon: '☀️', rarity: 'legendary', cat: '终局',   desc: '从时间回环中完美逃出——影子带你回了家' },
  { id: 'end_timeloop_escape', name: '逃离了永恒',   icon: '🚪', rarity: 'legendary', cat: '终局',   desc: '你关掉了游戏。这就是出口。' },

  // ── 网红/自媒体 ───────────────────────────────────────────────────────
  { id: 'sl_influencer',          name: '第一条视频',  icon: '📱', rarity: 'rare',      cat: '剧情',   desc: '开始了自媒体之路，从零粉丝起步' },
  { id: 'influencer_mcn',         name: 'MCN签约',     icon: '📝', rarity: 'epic',      cat: '剧情',   desc: '签约顶级MCN，成为头部博主' },
  { id: 'end_influencer_top',     name: '全网顶流',    icon: '👑', rarity: 'legendary', cat: '终局',   desc: '登上福布斯30U30，从留学生到顶流网红' },
  { id: 'end_influencer_comeback', name: '咸鱼翻身',   icon: '🐟', rarity: 'legendary', cat: '终局',   desc: '所有人都以为你过气了——你用一条素颜视频打了所有人的脸' },

  // ── 朋友圈彩蛋 ──────────────────────────────────────────────────────────
  { id: 'egg_mom_last_post',  name: '妈妈的最后一条朋友圈', icon: '💌', rarity: 'epic',   cat: '朋友圈', desc: '结局之后那条没说完的话' },
  { id: 'egg_hidden_npc',     name: '???的踪迹',           icon: '👤', rarity: 'epic',   cat: '朋友圈', desc: '名单上多出来的那位' },
  { id: 'egg_dejavu',         name: '前世的回响',           icon: '🫧', rarity: 'epic',   cat: '朋友圈', desc: '重开够多次才能解锁' },
  { id: 'egg_hidden_entry',   name: '朋友圈里的暗号',       icon: '🔑', rarity: 'legendary', cat: '朋友圈', desc: '用对的暗号回复对的人' },

  // ── 日常 — 吃饭/生存 ───────────────────────────────────────────────────
  { id: 'daily_dreamer',        name: '白日梦想家',     icon: '🥫', rarity: 'normal',  cat: '日常', desc: '连续吃了一周最便宜的食物，还觉得挺好吃' },
  { id: 'daily_chef',           name: '中华小当家',     icon: '🍳', rarity: 'normal',  cat: '日常', desc: '第一次在国外做出了一道像样的中餐' },
  { id: 'daily_noodle',         name: '泡面大师',       icon: '🍜', rarity: 'normal',  cat: '日常', desc: '凌晨三点，泡面加蛋加火腿肠，这就是留学的味道' },
  { id: 'daily_hotpot',         name: '火锅外交官',     icon: '🍲', rarity: 'rare',    cat: '日常', desc: '用一顿火锅搞定了三个国家的室友' },

  // ── 日常 — 学业 ────────────────────────────────────────────────────────
  { id: 'daily_monk',           name: '苦行僧',         icon: '📚', rarity: 'normal',  cat: '日常', desc: '组里的人集体消失，你一人完成了小组项目' },
  { id: 'daily_gpt',            name: 'GPT门徒',       icon: '🤖', rarity: 'rare',    cat: '日常', desc: '用AI写作业被抓到了' },
  { id: 'daily_charity',        name: '慈善家',         icon: '💸', rarity: 'normal',  cat: '日常', desc: '交了一门课的重修费，感觉给教授买了辆车' },
  { id: 'daily_chegg',          name: '学术偷渡者',     icon: '📝', rarity: 'normal',  cat: '日常', desc: '全靠往年卷撑过了这学期' },
  { id: 'daily_office',         name: 'Office Hours常客', icon: '🏫', rarity: 'rare',  cat: '日常', desc: '教授已经能叫出你的中文名了' },
  { id: 'daily_fullattend',     name: '全勤战士',       icon: '⏰', rarity: 'rare',    cat: '日常', desc: '一学期没缺过一节早八' },
  { id: 'daily_course',         name: '选课大师',       icon: '🎯', rarity: 'normal',  cat: '日常', desc: '用三个学期练就了避开hard professor的直觉' },
  { id: 'daily_deadline',       name: 'Deadline战神',   icon: '⚡', rarity: 'normal',  cat: '日常', desc: '在due前两小时写完了论文，质量居然还不错' },
  { id: 'daily_library',        name: '图书馆幽灵',     icon: '👻', rarity: 'normal',  cat: '日常', desc: '期末周在图书馆待到闭馆，保安都认识你了' },

  // ── 日常 — 社交/情感 ──────────────────────────────────────────────────
  { id: 'daily_shycourage',     name: '社恐の勇气',     icon: '🫡', rarity: 'normal',  cat: '日常', desc: '第一次主动跟外国同学搭话，磕磕巴巴但对方笑了' },
  { id: 'daily_sober',          name: '人间清醒',       icon: '🌙', rarity: 'normal',  cat: '日常', desc: '朋友圈大家都在秀，你默默关掉了手机' },
  { id: 'daily_drunk',          name: '喝醉了',         icon: '🍺', rarity: 'normal',  cat: '日常', desc: '有些委屈，只能让酒精替我说完' },
  { id: 'daily_fakeextro',      name: '假装外向',       icon: '🎭', rarity: 'normal',  cat: '日常', desc: 'party上笑得最大声的人，回家后最沉默' },
  { id: 'daily_peace',          name: '和解于心',       icon: '🤝', rarity: 'rare',    cat: '日常', desc: '原谅了那个没能成为理想模样的自己' },

  // ── 日常 — 生活 ────────────────────────────────────────────────────────
  { id: 'daily_nocar',          name: '车轮上的美国',   icon: '🚗', rarity: 'normal',  cat: '日常', desc: '没有车寸步难行，靠室友蹭车买了三个月菜' },
  { id: 'daily_metro',          name: '地铁老司机',     icon: '🚇', rarity: 'normal',  cat: '日常', desc: '这座城市的地铁图已经刻在DNA里了' },
  { id: 'daily_ikea',           name: '宜家组装师',     icon: '🔧', rarity: 'normal',  cat: '日常', desc: '一个人组装家具到凌晨三点，螺丝还多了两颗' },
  { id: 'daily_visa',           name: '签证焦虑症',     icon: '📄', rarity: 'normal',  cat: '日常', desc: '续签的那段日子，每天刷十遍邮箱' },
  { id: 'daily_jetlag',         name: '时差候鸟',       icon: '🕐', rarity: 'normal',  cat: '日常', desc: '凌晨三点跟爸妈视频，假装自己过得很好' },
  { id: 'daily_nomad',          name: '搬家游牧民',     icon: '📦', rarity: 'normal',  cat: '日常', desc: '来这个城市两年，换了四次住处' },
  { id: 'daily_daigou',         name: '人肉代购',       icon: '🧳', rarity: 'normal',  cat: '日常', desc: '回国行李箱一半是给亲戚朋友带的东西' },

  // ── 日常 — 打工/经济 ──────────────────────────────────────────────────
  { id: 'daily_moonlight',      name: '月光族',         icon: '💰', rarity: 'normal',  cat: '日常', desc: '工资到账和花光之间只隔了一顿火锅' },
  { id: 'daily_blackwork',      name: '黑工体验家',     icon: '🍽️', rarity: 'rare',    cat: '日常', desc: '在中餐馆洗碗到凌晨，时薪折算不如国内' },
  { id: 'daily_resume',         name: '简历海王',       icon: '📮', rarity: 'normal',  cat: '日常', desc: '投了200份简历，收到了3个拒信和197个已读不回' },
  { id: 'daily_exchange',       name: '汇率心碎',       icon: '💱', rarity: 'normal',  cat: '日常', desc: '每次花钱都在心里乘以汇率，然后默默放下购物车' },
  { id: 'daily_scholarship',    name: '奖学金猎手',     icon: '🏅', rarity: 'rare',    cat: '日常', desc: '申到了奖学金，这学期终于不用吃土了' },

  // ── 日常 — 文化/适应 ──────────────────────────────────────────────────
  { id: 'daily_shock',          name: '文化休克',       icon: '😵', rarity: 'normal',  cat: '日常', desc: '来了才发现，课本上教的和真实世界是两种语言' },
  { id: 'daily_nodsmile',       name: '点头微笑机器',   icon: '😊', rarity: 'normal',  cat: '日常', desc: '听不懂但你已经学会了在正确的时候笑' },
  { id: 'daily_dreamenglish',   name: '梦里说英语',     icon: '💤', rarity: 'rare',    cat: '日常', desc: '有一天梦里突然开始说英语了，这算融入了吗？' },
  { id: 'daily_worldly',        name: '甘败世俗',       icon: '👔', rarity: 'normal',  cat: '日常', desc: '你终于成为了小时候最不想成为的大人' },
  { id: 'daily_noequal',        name: '事与愿违',       icon: '📉', rarity: 'normal',  cat: '日常', desc: '努力和结果，不是等号' },
  { id: 'daily_tradeoff',       name: '有舍有得',       icon: '⚖️', rarity: 'normal',  cat: '日常', desc: '硬币没有第三面，人生没有两全' },

  // ── 日常 — 专业 ───────────────────────────────────────────────────────
  { id: 'daily_debug',          name: 'Debug人生',      icon: '🐛', rarity: 'normal',  cat: '日常', desc: '凌晨四点终于找到了那个少写的分号' },
  { id: 'daily_case',           name: 'Case面试官',     icon: '📊', rarity: 'normal',  cat: '日常', desc: '能用framework分析一切，包括今晚吃什么' },
  { id: 'daily_labghost',       name: '实验室幽灵',     icon: '🔬', rarity: 'normal',  cat: '日常', desc: '导师以为你住在实验室，其实你真的住在实验室' },
  { id: 'daily_pre',            name: 'Pre恐惧症',      icon: '🎤', rarity: 'normal',  cat: '日常', desc: 'Presentation前一晚对着镜子练了二十遍' },
  { id: 'daily_medbags',        name: '医学生的黑眼圈', icon: '🩺', rarity: 'normal',  cat: '日常', desc: '连续考了三周，黑眼圈已经成了你的标志' },
  { id: 'daily_mootcourt',      name: '模拟法庭之王',   icon: '⚖️', rarity: 'rare',    cat: '日常', desc: '用中式逻辑赢了一场英语辩论' },
  { id: 'daily_client',         name: '甲方乙方',       icon: '🎬', rarity: 'normal',  cat: '日常', desc: '学Film才知道，最难的不是创作，是满足甲方' },

  // ── 日常 — 情绪/氛围 ─────────────────────────────────────────────────
  { id: 'daily_firstsnow',      name: '第一场雪',       icon: '❄️', rarity: 'normal',  cat: '日常', desc: '异国的第一场雪，你在街头站了很久' },
  { id: 'daily_airport',        name: '凌晨的机场',     icon: '✈️', rarity: 'normal',  cat: '日常', desc: '一个人拖着行李箱，突然觉得自己很勇敢' },
  { id: 'daily_goodreport',     name: '报喜不报忧',     icon: '📱', rarity: 'normal',  cat: '日常', desc: '挂了电话之后，眼泪才掉下来' },
  { id: 'daily_honest',         name: '坦白局',         icon: '💬', rarity: 'rare',    cat: '日常', desc: '妈，我其实不太好——最亲的人一直在等你开口' },
  { id: 'daily_emo',            name: '深夜emo',        icon: '🌃', rarity: 'normal',  cat: '日常', desc: '半夜发了一条很丧的朋友圈，五分钟后删掉了' },

  // ── 日常 — 选择类社交 ─────────────────────────────────────────────────
  { id: 'daily_niceguy',        name: '老好人',         icon: '😇', rarity: 'normal',  cat: '日常', desc: '你不会拒绝别人，但有谁在意过你也很累？' },
  { id: 'daily_hedgehog',       name: '刺猬',           icon: '🦔', rarity: 'normal',  cat: '日常', desc: '不是不想靠近，是怕靠近了又要失去' },
  { id: 'daily_truth',          name: '真话很贵',       icon: '💎', rarity: 'rare',    cat: '日常', desc: '真话可能刺耳，但你选择了尊重' },
  { id: 'daily_flatter',        name: '职业捧场王',     icon: '👏', rarity: 'normal',  cat: '日常', desc: '你总是说对的话，但不一定是真的话' },
  { id: 'daily_outsider',       name: '局外人',         icon: '🪟', rarity: 'normal',  cat: '日常', desc: '热闹是他们的，你什么也没有' },
  { id: 'daily_braveit',        name: '硬着头皮',       icon: '💪', rarity: 'normal',  cat: '日常', desc: '全场你只听懂了How are you，但你去了' },
  { id: 'daily_partways',       name: '分道扬镳',       icon: '🚶', rarity: 'normal',  cat: '日常', desc: '不是所有关系都值得委屈自己去维护' },
  { id: 'daily_drunktruth',     name: '酒后真言',       icon: '🥃', rarity: 'normal',  cat: '日常', desc: '清醒时不敢说的话，酒替你说了' },

  // ── 日常 — 选择类学业/职业 ────────────────────────────────────────────
  { id: 'daily_switchtrack',    name: '换赛道',         icon: '🔀', rarity: 'rare',    cat: '日常', desc: '别人在冲终点，你回到了起跑线——但这次是自己选的' },
  { id: 'daily_grindlord',      name: '卷王觉醒',       icon: '📖', rarity: 'normal',  cat: '日常', desc: '你不知道路通向哪里，但你就是停不下来' },
  { id: 'daily_tangping',       name: '躺平宣言',       icon: '🛋️', rarity: 'normal',  cat: '日常', desc: '想通了，绩点是暂时的，快乐是永恒的' },
  { id: 'daily_freeintern',     name: '实习牛马',       icon: '🐴', rarity: 'normal',  cat: '日常', desc: 'PPT最后一页"感谢实习生的贡献"——就这？' },
  { id: 'daily_stable',         name: '铁饭碗',         icon: '🍚', rarity: 'normal',  cat: '日常', desc: '长大就是学会把梦想折好放进抽屉' },
  { id: 'daily_dream',          name: '追梦人',         icon: '🌠', rarity: 'rare',    cat: '日常', desc: '不确定能走多远，但至少方向是自己选的' },
  { id: 'daily_gapyear',        name: 'Gap Year',       icon: '🌍', rarity: 'rare',    cat: '日常', desc: '所有人都在赶路，你选择了停下来看看风景' },
  { id: 'daily_integrity',      name: '学术诚信',       icon: '🛡️', rarity: 'rare',    cat: '日常', desc: '正确答案可能在那张纸条上，但你选择了不知道' },
  { id: 'daily_gambler',        name: '学术赌徒',       icon: '🎲', rarity: 'normal',  cat: '日常', desc: '心跳了一整场考试，卷子上的字一个都没看进去' },

  // ── 日常 — 选择类生活 ─────────────────────────────────────────────────
  { id: 'daily_latenight',      name: '深夜外卖',       icon: '🥡', rarity: 'normal',  cat: '日常', desc: '这单外卖比任何安慰都管用' },
  { id: 'daily_yolo',           name: '青春无价',       icon: '🎒', rarity: 'rare',    cat: '日常', desc: '钱花了还能赚，青春过了就没了' },
  { id: 'daily_sensible',       name: '量力而行',       icon: '📏', rarity: 'normal',  cat: '日常', desc: '你学会了一个大人才懂的词' },
  { id: 'daily_letgo',          name: '断舍离',         icon: '🗑️', rarity: 'normal',  cat: '日常', desc: '扔掉旧东西的时候，好像也放下了一些什么' },
  { id: 'daily_stay',           name: '留下来',         icon: '🏠', rarity: 'rare',    cat: '日常', desc: '留下需要勇气，你不想让这几年变成一场旅行' },
  { id: 'daily_gohome',         name: '回家',           icon: '🏡', rarity: 'normal',  cat: '日常', desc: '落地那一刻，故乡也变成了远方' },
  { id: 'daily_er',             name: '第一次看急诊',   icon: '🏥', rarity: 'normal',  cat: '日常', desc: '看完账单/排完队，觉得自己的病突然好了' },
  { id: 'daily_restart',        name: '删掉重来',       icon: '🗃️', rarity: 'rare',    cat: '日常', desc: '凌晨两点按下全选删除——有些东西必须亲手推倒' },

  // ── 日常 — 选择类成长 ─────────────────────────────────────────────────
  { id: 'daily_sayno',          name: '说不',           icon: '✋', rarity: 'rare',    cat: '日常', desc: '你终于学会了世界上最短也最难说的那个字' },
  { id: 'daily_selfpeace',      name: '与自己和解',     icon: '🕊️', rarity: 'rare',    cat: '日常', desc: '你不再追赶那个完美的自己了' },
  { id: 'daily_solotrip',       name: '一个人的旅行',   icon: '🧭', rarity: 'normal',  cat: '日常', desc: '你以为你在找风景，其实你在找自己' },
  { id: 'daily_lookback',       name: '回头看',         icon: '🪞', rarity: 'normal',  cat: '日常', desc: '人生没有存档点，但你学会了不后悔' },
  { id: 'daily_giveup',         name: '认输',           icon: '🏳️', rarity: 'normal',  cat: '日常', desc: '放手不是懦弱，是终于听见了自己的声音' },
  { id: 'daily_onemore',        name: '再试一次',       icon: '🔥', rarity: 'rare',    cat: '日常', desc: '所有人都觉得你疯了——然后你做到了' },
];

let _unlocked = new Set();

// ── Init ──────────────────────────────────────────────────────────────────
export function initAchievements() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _unlocked = new Set(raw ? JSON.parse(raw) : []);
  } catch {
    _unlocked = new Set();
  }
  _setupWallHandlers();
  _initWallTabs();
  _updateBadge();
}

function _save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([..._unlocked]));
  } catch { /* storage may be unavailable */ }
}

// ── Unlock ────────────────────────────────────────────────────────────────
let _onUnlock = null;
export function setOnUnlock(fn) { _onUnlock = fn; }

export function unlockAchievement(id) {
  if (_unlocked.has(id)) return false;
  const def = ACHIEVEMENTS.find(a => a.id === id);
  if (!def) return false;

  _unlocked.add(id);
  _save();
  _showToast(def);
  _updateBadge();
  if (_onUnlock) try { _onUnlock(def); } catch (e) {}

  // Combo: unlock "见过世面" when all four hidden storylines done
  if (id !== 'all_hidden' &&
      ['sl_spy', 'sl_xianxia', 'sl_abyss', 'sl_meta', 'sl_thief', 'sl_hogwarts', 'sl_timeloop'].every(x => _unlocked.has(x))) {
    unlockAchievement('all_hidden');
  }
  return true;
}

export function isUnlocked(id) { return _unlocked.has(id); }
export function getUnlockedCount() { return _unlocked.size; }

// ── Achievement Bonus System ─────────────────────────────────────────────
// Cumulative milestones: unlock N achievements → extra distributable points
const ACH_MILESTONES = [
  { threshold: 3,  pts: 1 },   // Lv.1  — total +1
  { threshold: 7,  pts: 1 },   // Lv.2  — total +2
  { threshold: 12, pts: 1 },   // Lv.3  — total +3
  { threshold: 18, pts: 1 },   // Lv.4  — total +4
  { threshold: 25, pts: 1 },   // Lv.5  — total +5
  { threshold: 33, pts: 1 },   // Lv.6  — total +6
  { threshold: 42, pts: 1 },   // Lv.7  — total +7
  { threshold: 52, pts: 2 },   // Lv.8  — total +9
  { threshold: 62, pts: 2 },   // Lv.9  — total +11
  { threshold: 72, pts: 2 },   // Lv.10 — total +13
  { threshold: 80, pts: 3 },   // Lv.11 — total +16
];

// Specific achievements → fixed stat boosts (applied automatically, not distributable)
const ACH_STAT_BONUSES = {
  school_t20:        { INT: 1 },          // 名校之路 → 智力+1
  all_hidden:        { SOC: 1, INT: 1 },  // 见过世面 → 社交+1, 智力+1
  romance_married:   { HAP: 1 },          // 白头到老 → 快乐+1 (HAP is applied separately)
  stat_max:          { PER: 1 },          // 天赋异禀 → 毅力+1
  end_spy:           { SOC: 1 },          // 特工的荣耀 → 社交+1
  end_xianxia:       { HLT: 1 },          // 羽化登仙 → 健康+1
  end_ceo:           { MNY: 1 },          // 商界传奇 → 家境+1
  end_worlds:        { PER: 1 },          // 全球冠军 → 毅力+1
  end_meta:          { INT: 1 },          // 第五面墙 → 智力+1
  end_fitness:       { HLT: 1 },          // 健美传奇 → 健康+1
  end_chef:          { APP: 1 },          // 三星主厨 → 颜值+1
  end_athlete:       { PER: 1 },          // 体坛之巅 → 毅力+1
  romance_sea_king:  { SOC: 1 },          // 海王/海后 → 社交+1
  easter_rhythm:     { APP: 1 },          // 节奏大师 → 颜值+1
};

/**
 * Calculate all achievement bonuses for the current unlock state.
 * @returns {{ extraPts: number, level: number, fixedBonus: Object<string,number>, milestoneDetails: Array }}
 */
export function getAchievementBonuses() {
  const count = _unlocked.size;

  // Cumulative extra points
  let extraPts = 0;
  let level = 0;
  const milestoneDetails = [];
  for (const m of ACH_MILESTONES) {
    if (count >= m.threshold) {
      extraPts += m.pts;
      level++;
      milestoneDetails.push({ threshold: m.threshold, pts: m.pts, reached: true });
    } else {
      milestoneDetails.push({ threshold: m.threshold, pts: m.pts, reached: false });
    }
  }

  // Fixed stat bonuses from specific achievements
  const fixedBonus = {};
  for (const [achId, bonuses] of Object.entries(ACH_STAT_BONUSES)) {
    if (_unlocked.has(achId)) {
      for (const [stat, val] of Object.entries(bonuses)) {
        fixedBonus[stat] = (fixedBonus[stat] || 0) + val;
      }
    }
  }

  // Per-achievement stat bonus details (for popover)
  const statBonusDetails = [];
  for (const [achId, bonuses] of Object.entries(ACH_STAT_BONUSES)) {
    const achDef = ACHIEVEMENTS.find(a => a.id === achId);
    const unlocked = _unlocked.has(achId);
    statBonusDetails.push({
      achId,
      achName: achDef ? achDef.name : achId,
      achIcon: achDef ? achDef.icon : '?',
      bonuses, // e.g. { INT: 1 }
      unlocked
    });
  }

  return { extraPts, level, fixedBonus, milestoneDetails, statBonusDetails, totalAch: ACHIEVEMENTS.length, unlockedCount: count };
}

// ── Toast notification (slides in from bottom-right) ──────────────────────
function _showToast(def) {
  const container = document.getElementById('ach-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `ach-toast ach-r-${def.rarity}`;
  toast.innerHTML = `
    <div class="ach-toast-icon">${def.icon}</div>
    <div class="ach-toast-body">
      <div class="ach-toast-label">成就解锁</div>
      <div class="ach-toast-name">${def.name}</div>
      <div class="ach-toast-desc">${def.desc}</div>
    </div>
  `;
  container.appendChild(toast);

  // Slide-in on next frame
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('ach-toast-show')));

  // Slide-out after 4.5 s
  setTimeout(() => {
    toast.classList.remove('ach-toast-show');
    const remove = () => { if (toast.parentNode) toast.parentNode.removeChild(toast); };
    toast.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 700); // fallback if transitionend doesn't fire
  }, 4500);
}

// ── Trophy badge count ────────────────────────────────────────────────────
function _updateBadge() {
  const count = _unlocked.size;
  const total = ACHIEVEMENTS.length;
  const badge = document.getElementById('ach-trophy-badge');
  if (badge) badge.textContent = `${count}/${total}`;
  const startBadge = document.getElementById('ach-trophy-start-badge');
  if (startBadge) startBadge.textContent = `${count}/${total}`;
  // Level on start screen
  const levelEl = document.getElementById('ach-start-level');
  if (levelEl) {
    let lv = 0;
    for (const m of ACH_MILESTONES) { if (count >= m.threshold) lv++; }
    levelEl.textContent = `Lv.${lv}`;
  }
}

// ── Achievement wall ──────────────────────────────────────────────────────
function _setupWallHandlers() {
  const btn      = document.getElementById('ach-trophy-btn');
  const startBtn = document.getElementById('ach-trophy-start-btn');
  const wall     = document.getElementById('ach-wall');
  const closeBtn = document.getElementById('ach-wall-close');
  if (!wall) return;

  if (btn) btn.addEventListener('click', openAchievementWall);
  if (startBtn) startBtn.addEventListener('click', openAchievementWall);
  if (closeBtn) closeBtn.addEventListener('click', closeAchievementWall);

  // Click on backdrop (not on the panel) closes wall
  wall.addEventListener('click', e => {
    if (e.target === wall) closeAchievementWall();
  });

  // Escape key closes wall
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && wall.classList.contains('ach-wall-open')) {
      closeAchievementWall();
    }
  });
}

export function openAchievementWall() {
  const wall = document.getElementById('ach-wall');
  if (!wall) return;
  _renderWall();
  wall.classList.add('ach-wall-open');
}

export function closeAchievementWall() {
  const wall = document.getElementById('ach-wall');
  if (wall) wall.classList.remove('ach-wall-open');
}

function _renderWall() {
  const grid = document.getElementById('ach-wall-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Update progress count in header (exclude 日常, they have their own tab)
  const nonDaily = ACHIEVEMENTS.filter(a => a.cat !== '日常');
  const nonDailyUnlocked = nonDaily.filter(a => _unlocked.has(a.id)).length;
  const countEl = document.getElementById('ach-wall-count');
  if (countEl) countEl.textContent = `${nonDailyUnlocked} / ${nonDaily.length}`;

  const cats = ['里程碑', '感情', '剧情', '终局', '彩蛋', '朋友圈'];
  for (const cat of cats) {
    const items = ACHIEVEMENTS.filter(a => a.cat === cat);
    if (!items.length) continue;

    const section = document.createElement('div');
    section.className = 'ach-section';

    const title = document.createElement('div');
    title.className = 'ach-section-title';
    title.textContent = cat;
    section.appendChild(title);

    const row = document.createElement('div');
    row.className = 'ach-section-items';

    for (const def of items) {
      const done = _unlocked.has(def.id);
      const card = document.createElement('div');
      card.className = `ach-card ach-r-${def.rarity} ${done ? 'ach-unlocked' : 'ach-locked'}`;
      card.innerHTML = `
        <div class="ach-card-icon">${def.icon}</div>
        <div class="ach-card-body">
          <div class="ach-card-name">${def.name}</div>
          <div class="ach-card-desc">${done ? def.desc : '???'}</div>
        </div>
        ${done ? '<div class="ach-card-check">✓</div>' : ''}
      `;
      row.appendChild(card);
    }

    section.appendChild(row);
    grid.appendChild(section);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  ENDING CATALOG (结局图鉴) — S/A tier only, with trigger hints
// ══════════════════════════════════════════════════════════════════════════════

const ENDING_STORAGE_KEY = 'sasr_endings_v1';
let _collectedEndings = {};  // id → { text, tier, ts }
let _activeWallTab = 'ach';

// ── Static catalog: only S and A tier endings, with name + hint ──────────
const ENDING_CATALOG = [
  // ── S 传奇结局 ─────────────────────────────────────────────────────────
  // 隐藏剧情线
  { id: 50099, tier: 'S', icon: '🕵️', name: '特工的荣耀',     hint: '圆满完成了国际特工任务' },
  { id: 60090, tier: 'S', icon: '🌌', name: '数字神明',       hint: '在深渊的尽头，你成为了新的造物主' },
  { id: 60095, tier: 'S', icon: '🧠', name: 'AGI融合',       hint: '意识与机器的边界彻底消融了' },
  { id: 70092, tier: 'S', icon: '📺', name: 'Ctrl+W',        hint: '当你足够清醒，也许该关掉这扇窗' },
  { id: 70093, tier: 'S', icon: '🔮', name: '第五面墙',       hint: '和屏幕另一边的人和解了' },
  { id: 87190, tier: 'S', icon: '👻', name: '幽灵评级',       hint: '达到了影子协会最高评级' },
  { id: 61611, tier: 'S', icon: '⚡', name: '救世之星',       hint: '摧毁所有碎片后的最终对决——需要真正的力量' },

  // 职业剧情线
  { id: 82090, tier: 'S', icon: '💼', name: '商界传奇',       hint: '从派对之王到商业帝国，需要人脉和资本的双重巅峰' },
  { id: 81090, tier: 'S', icon: '🃏', name: '赌神',           hint: '在最高级别的牌桌上，技术就是一切' },
  { id: 83090, tier: 'S', icon: '🥇', name: '全球冠军',       hint: '天梯登顶还不够，世界赛需要钢铁般的意志' },
  { id: 84061, tier: 'S', icon: '🏋️', name: '健美传奇',       hint: '站上了健美巅峰的舞台' },
  { id: 85061, tier: 'S', icon: '⭐', name: '三星主厨',       hint: '获得了米其林三星评级' },
  { id: 86105, tier: 'S', icon: '🏀', name: 'NBA状元',        hint: '篮球天赋的极致绽放' },
  { id: 86120, tier: 'S', icon: '⚽', name: '世界杯冠军',      hint: '绿茵场上的最高荣耀' },
  { id: 86136, tier: 'S', icon: '🥏', name: '飞盘世锦赛冠军',  hint: '小众运动的世界之巅' },
  { id: 78081, tier: 'S', icon: '🎸', name: 'Encore!',       hint: '全场高喊Encore——虽然你只是贝斯手' },
  { id: 89090, tier: 'S', icon: '🛡️', name: '白骑士',         hint: 'CVE上有你的名字——正义的黑客也有归宿' },
  { id: 89092, tier: 'S', icon: '👻', name: 'Ghost',          hint: '金盆洗手，无人知晓你曾是暗网上的传说' },
  { id: 76090, tier: 'S', icon: '👑', name: '全网顶流',        hint: '登上福布斯30U30，从留学生到顶流网红' },
  { id: 76096, tier: 'S', icon: '🐟', name: '咸鱼翻身',        hint: '所有人都以为你过气了——直到那条视频' },
  { id: 88261, tier: 'S', icon: '🧠', name: '考神',            hint: '建立了跨国代考帝国（传统路线）' },
  { id: 88267, tier: 'S', icon: '🕹️', name: '零日',            hint: '成为暗网上让所有考试系统颤抖的传说（技术路线）' },

  // 专业传奇
  { id: 42190, tier: 'S', icon: '💻', name: '硅谷传奇',        hint: 'CS专业的技术路线巅峰' },
  { id: 42191, tier: 'S', icon: '🚀', name: '连续创业者',      hint: 'CS专业的创业路线巅峰' },
  { id: 43190, tier: 'S', icon: '💹', name: '金融之王',        hint: '商科专业——人脉与资本缺一不可' },
  { id: 44190, tier: 'S', icon: '🔭', name: '学术巨擘',        hint: '理科专业——以全奖直博身份登顶学界' },
  { id: 45191, tier: 'S', icon: '🖋️', name: '传世大家',        hint: '文科/文艺专业——作品跨越了时代' },
  { id: 48190, tier: 'S', icon: '🔬', name: '半导体教父',      hint: 'EE专业——在芯片领域封神，重塑了产业格局' },
  { id: 48191, tier: 'S', icon: '💡', name: '芯片独角兽',      hint: 'EE专业——从实验室走向资本市场' },
  { id: 48290, tier: 'S', icon: '🏭', name: '总工程师',        hint: 'ME专业——技术路线的天花板' },
  { id: 48291, tier: 'S', icon: '🤖', name: '智造独角兽',      hint: 'ME专业——智能制造赛道的创业传奇' },
  { id: 48390, tier: 'S', icon: '🧬', name: '新药教父',        hint: 'BIO专业——研发出了改变世界的新药' },
  { id: 48391, tier: 'S', icon: '💊', name: '生物医药独角兽',   hint: 'BIO专业——从科学家到企业家的跨越' },
  { id: 48590, tier: 'S', icon: '🩺', name: '科室主任',        hint: 'MED专业——医术精湛，独当一面' },
  { id: 48591, tier: 'S', icon: '✂️', name: '新术式命名',       hint: 'MED专业——以自己的名字命名了新术式' },
  { id: 48790, tier: 'S', icon: '⚖️', name: '管理合伙人',      hint: 'LAW专业——全能型法律精英的终极归宿' },
  { id: 48791, tier: 'S', icon: '🏛️', name: '首席大检察官',    hint: 'LAW专业——选择了正义的那条路' },
  { id: 48990, tier: 'S', icon: '🎬', name: '金棕榈之夜',      hint: 'Film专业——独立电影人的最高荣耀' },
  { id: 48991, tier: 'S', icon: '🎥', name: '百亿票房',        hint: 'Film专业——商业电影的票房神话' },
  { id: 49990, tier: 'S', icon: '🎸', name: '独立音乐人',      hint: '音乐专业——不妥协的声音终被世界听见' },
  { id: 49991, tier: 'S', icon: '🎤', name: '流行巨星',        hint: '音乐专业——舞台上最耀眼的那颗星' },
  { id: 49992, tier: 'S', icon: '🎼', name: '传奇作曲家',      hint: '音乐专业——用音符书写了不朽的篇章' },

  // ── A 优秀结局 ─────────────────────────────────────────────────────────
  { id: 70091, tier: 'A', icon: '🤝', name: '接受命运',        hint: '也许接受这个世界的设定，也是一种勇气' },
  { id: 80105, tier: 'A', icon: '🌟', name: '闪耀登场',        hint: '偶像出道——日本路线有特别的可能性' },
  { id: 82096, tier: 'A', icon: '👔', name: '企业精英',        hint: '从派对转型商界，虽未封神，也算体面' },
  { id: 84091, tier: 'A', icon: '📸', name: '健身网红',        hint: '没拿冠军，但在社交媒体上找到了另一种巅峰' },
  { id: 85091, tier: 'A', icon: '⭐', name: '二星主厨',        hint: '差一点点到顶峰——但已经超越了大多数人' },
  { id: 85092, tier: 'A', icon: '⭐', name: '一星主厨',        hint: '第一颗星，是梦想照进现实的起点' },
  { id: 61612, tier: 'A', icon: '⚡', name: '牺牲式胜利',      hint: '魂器全毁，但最终一战中力量不够……代价是什么？' },
  { id: 76095, tier: 'A', icon: '📄', name: 'MCN合约到期',     hint: '签约顶级MCN之后，合约期满的平稳着陆' },
  { id: 88160, tier: 'A', icon: '🧹', name: '金盆洗手',        hint: '在代考帝国做大之前，选择了急流勇退' },
  { id: 88262, tier: 'A', icon: '😰', name: '惊险过关',        hint: '代考线的关键抉择——险中求生' },
  { id: 88264, tier: 'A', icon: '✈️', name: '跑路',            hint: '东窗事发前，你已经在飞机上了' },
  { id: 48192, tier: 'A', icon: '💻', name: 'EE转码逆袭',      hint: 'EE读不下去了？也许换条赛道反而海阔天空' },
  { id: 48292, tier: 'A', icon: '💻', name: 'ME转码逆袭',      hint: 'ME转码——工科人的曲线救国之路' },
  { id: 48392, tier: 'A', icon: '💻', name: '生信逆袭',        hint: 'BIO转码——当生物遇上代码' },
  { id: 48592, tier: 'A', icon: '🩺', name: '受人尊敬的主治',   hint: 'MED专业——平凡而伟大的从医之路' },
  { id: 48792, tier: 'A', icon: '⚖️', name: '知名人权律师',    hint: 'LAW专业——选择了报酬最少但最有意义的那条路' },
  { id: 48992, tier: 'A', icon: '📝', name: '奥斯卡编剧',      hint: 'Film专业——幕后英雄也有登上领奖台的一天' },
  { id: 90050, tier: 'A', icon: '💰', name: '大客户销售王',     hint: '退学不是终点——能说会道的人哪里都吃得开' },
  { id: 90052, tier: 'A', icon: '📚', name: '考证逆袭',        hint: '退学之后脱产考证，用毅力重写人生' },
  { id: 90054, tier: 'A', icon: '🏃', name: '灵活就业达人',     hint: '退学后自由职业——身体是革命的本钱' },
  { id: 90056, tier: 'A', icon: '🏪', name: '个体户老板',       hint: '退学后开了家小店——快乐比什么都重要' },
];

function _loadEndings() {
  try {
    const raw = localStorage.getItem(ENDING_STORAGE_KEY);
    _collectedEndings = raw ? JSON.parse(raw) : {};
  } catch { _collectedEndings = {}; }
}

function _saveEndings() {
  try { localStorage.setItem(ENDING_STORAGE_KEY, JSON.stringify(_collectedEndings)); } catch {}
}

export function recordEnding(endingId, endingText, tier) {
  _loadEndings();
  if (_collectedEndings[endingId]) return;
  // Only persist S/A tier endings
  if (tier !== 'S' && tier !== 'A') return;
  _collectedEndings[endingId] = {
    text: (endingText || '').slice(0, 80),
    tier: tier,
    ts: Date.now(),
  };
  _saveEndings();
}

// buildEndingCatalog is kept for backward compat but catalog is now static
export function buildEndingCatalog(_eventsMap, _legendarySet, _goodSet) {
  _loadEndings();
}

function _initWallTabs() {
  const wall = document.getElementById('ach-wall');
  if (!wall) return;
  wall.addEventListener('click', (e) => {
    const tab = e.target.closest('.ach-wall-tab');
    if (!tab) return;
    const key = tab.dataset.tab;
    if (key === _activeWallTab) return;
    _activeWallTab = key;
    wall.querySelectorAll('.ach-wall-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === key));
    const achGrid = document.getElementById('ach-wall-grid');
    const dailyGrid = document.getElementById('daily-wall-grid');
    const endGrid = document.getElementById('ending-wall-grid');
    achGrid && (achGrid.style.display = key === 'ach' ? '' : 'none');
    dailyGrid && (dailyGrid.style.display = key === 'daily' ? '' : 'none');
    endGrid && (endGrid.style.display = key === 'endings' ? '' : 'none');
    if (key === 'daily') _renderDailyWall();
    if (key === 'endings') _renderEndingWall();
  });
}

function _renderEndingWall() {
  const grid = document.getElementById('ending-wall-grid');
  if (!grid) return;
  grid.innerHTML = '';
  _loadEndings();

  const sOnly = ENDING_CATALOG.filter(e => e.tier === 'S' || e.tier === 'A');
  const collected = sOnly.filter(e => _collectedEndings[e.id]).length;
  const total = sOnly.length;
  const countEl = document.getElementById('ending-wall-count');
  if (countEl) countEl.textContent = `${collected}/${total}`;

  const tierLabels = { S: '👑 传奇结局', A: '⭐ 优秀结局' };

  for (const tier of ['S', 'A']) {
    const items = ENDING_CATALOG.filter(e => e.tier === tier);
    if (!items.length) continue;

    const section = document.createElement('div');
    section.className = 'ach-section';

    const title = document.createElement('div');
    title.className = 'ach-section-title';
    const tierCollected = items.filter(e => _collectedEndings[e.id]).length;
    title.textContent = `${tierLabels[tier]}  ${tierCollected}/${items.length}`;
    section.appendChild(title);

    const row = document.createElement('div');
    row.className = 'ach-section-items ending-section-items';

    for (const def of items) {
      const done = !!_collectedEndings[def.id];

      const card = document.createElement('div');
      card.className = `ending-card ending-tier-${tier.toLowerCase()} ${done ? 'ending-unlocked' : 'ending-locked'}`;
      if (done) {
        card.innerHTML = `
          <div class="ending-card-icon">${def.icon}</div>
          <div class="ending-card-body">
            <div class="ending-card-name">${def.name}</div>
            <div class="ending-card-hint">${def.hint}</div>
          </div>
          <div class="ending-card-check">✓</div>
        `;
      } else {
        card.innerHTML = `<div class="ending-card-icon ending-card-icon-locked">${def.icon}</div>`;
      }
      row.appendChild(card);
    }

    section.appendChild(row);
    grid.appendChild(section);
  }
}

function _renderDailyWall() {
  const grid = document.getElementById('daily-wall-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const dailyAch = ACHIEVEMENTS.filter(a => a.cat === '日常');
  const unlocked = dailyAch.filter(a => _unlocked.has(a.id)).length;
  const countEl = document.getElementById('daily-wall-count');
  if (countEl) countEl.textContent = `${unlocked}/${dailyAch.length}`;

  const rarityOrder = ['legendary', 'epic', 'rare', 'normal'];
  const rarityLabels = { legendary: '🌟 传说', epic: '💜 史诗', rare: '💙 稀有', normal: '🤍 普通' };

  for (const r of rarityOrder) {
    const items = dailyAch.filter(a => a.rarity === r);
    if (!items.length) continue;

    const section = document.createElement('div');
    section.className = 'ach-section';

    const title = document.createElement('div');
    title.className = 'ach-section-title';
    const rUnlocked = items.filter(a => _unlocked.has(a.id)).length;
    title.textContent = `${rarityLabels[r]}  ${rUnlocked}/${items.length}`;
    section.appendChild(title);

    const row = document.createElement('div');
    row.className = 'ach-section-items';

    for (const def of items) {
      const done = _unlocked.has(def.id);
      const card = document.createElement('div');
      card.className = `ach-card ach-r-${def.rarity} ${done ? 'ach-unlocked' : 'ach-locked'}`;
      card.innerHTML = `
        <div class="ach-card-icon">${def.icon}</div>
        <div class="ach-card-body">
          <div class="ach-card-name">${def.name}</div>
          <div class="ach-card-desc">${done ? def.desc : '???'}</div>
        </div>
        ${done ? '<div class="ach-card-check">✓</div>' : ''}
      `;
      row.appendChild(card);
    }

    section.appendChild(row);
    grid.appendChild(section);
  }
}

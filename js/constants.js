// ============================================================
// constants.js — 全局游戏常量
// 所有可调参数集中管理，便于调试和平衡
// ============================================================

// --- 场景 ---
export const WORLD = {
    /** 地面大小（米） */
    GROUND_SIZE: 120,
    /** 墙高度（米） */
    WALL_HEIGHT: 20,
    /** 墙厚度（米） */
    WALL_THICKNESS: 2,
};

// --- 地图颜色（沙漠主题 / Dust2 风格） ---
export const COLORS = {
    GROUND: 0xc8a951,       // 沙地土黄
    WALL: 0xa0825a,         // 墙壁土褐
    WALL_ACCENT: 0x8b7355,  // 墙壁深色
    CRATE: 0x8b6914,        // 箱子深棕
    SKY_TOP: 0x87ceeb,      // 天空蓝
    SKY_BOTTOM: 0xd4b896,   // 沙漠天际线
    MUZZLE_FLASH: 0xffaa00, // 枪口火焰
    BULLET_HOLE: 0x333333,  // 弹孔深灰
};

// --- 玩家 ---
export const PLAYER = {
    /** 碰撞体总高（米）—— eye=HEIGHT/2≈1.6m */
    HEIGHT: 3.2,
    /** 玩家半径（米），碰撞体 */
    RADIUS: 0.4,
    /** 行走速度（米/秒） */
    WALK_SPEED: 6,
    /** 奔跑速度（米/秒） */
    RUN_SPEED: 10,
    /** 跳跃初速度（米/秒） */
    JUMP_VELOCITY: 9,
    /** 重力加速度（米/秒²） */
    GRAVITY: 20,
    /** 鼠标灵敏度 */
    MOUSE_SENSITIVITY: 0.002,
    /** 上下看的最小角度（弧度，防止翻跟头） */
    PITCH_MIN: -1.5,
    /** 上下看的最大角度（弧度） */
    PITCH_MAX: 1.5,
    /** 玩家血量 */
    HEALTH: 100,
    /** 受伤无敌时间（秒） */
    INVINCIBLE_TIME: 0.3,
};

// --- 武器 ---
export const WEAPON = {
    /** 射速（发/秒）AK47约600RPM → 翻倍1200RPM */
    FIRE_RATE: 20,
    /** 弹匣容量 */
    MAG_SIZE: 30,
    /** 备弹数量 */
    RESERVE_AMMO: 90,
    /** 换弹时间（秒） */
    RELOAD_TIME: 1.25,
    /** 战术换弹时间（秒）弹匣有剩余 */
    TACTICAL_RELOAD: 1.1,
    /** 空仓换弹时间（秒）弹匣打光 */
    EMPTY_RELOAD: 1.4,
    /** 射线最大射程（米） */
    MAX_RANGE: 200,
    /** 单发伤害 */
    DAMAGE: 35,
    /** 爆头伤害倍率（确保最多2发爆头击杀） */
    HEADSHOT_MULTIPLIER: 5,
    /** 最大备弹量 */
    MAX_RESERVE: 180,
    /** 散布半径 — 前3发（精准） */
    SPREAD_1: 0.005,
    /** 散布半径 — 4-10发（扩散） */
    SPREAD_2: 0.012,
    /** 散布半径 — 11发以上（泼水） */
    SPREAD_3: 0.022,
    /** 散布恢复时间（秒） */
    SPREAD_RECOVERY: 0.3,
    /** 枪口火焰持续时间（秒） */
    FLASH_DURATION: 0.05,
    /** 枪模晃动幅度 */
    SWAY_AMOUNT: 0.003,
    /** 屏幕震动强度（米） */
    SCREEN_SHAKE_INTENSITY: 0.012,
    /** 屏幕震动恢复速度 */
    SCREEN_SHAKE_RECOVERY: 12,
};

// --- 敌人 ---
export const ENEMY = {
    /** 基础血量 */
    HEALTH: 100,
    /** 移动速度（米/秒） */
    SPEED: 3,
    /** 检测玩家的距离（米） */
    DETECT_RANGE: 30,
    /** 攻击距离（米） */
    ATTACK_RANGE: 3,
    /** 攻击间隔（秒） */
    ATTACK_COOLDOWN: 0.8,
    /** 单次攻击伤害 */
    DAMAGE: 10,
    /** 死亡动画持续时长（秒） */
    DEATH_DURATION: 1.0,
    /** 敌人碰撞半径 */
    RADIUS: 0.35,
    /** 敌人高度 */
    HEIGHT: 1.85,
    /** 生成坐标 [x, y, z]，分布在地图各区域（Y=0 脚着地） */
    SPAWN_POSITIONS: [
        [28,  0, -12],   // A点（原）
        [23,  0, -20],   // A点箱子后（原）
        [34,  0, -25],   // A狙击平台旁 🆕
        [18,  0, -32],   // A长墙后 🆕
        [-28, 0,  12],   // B点（原）
        [-20, 0,  20],   // B平台旁 🆕
        [-32, 0,  16],   // B矮掩体后 🆕
        [-8,  0,   8],   // 中路左（原）
        [ 8,  0,  -5],   // 中路右（原）
        [-15, 0,  25],   // 南出生区（原）
        [ 15, 0, -30],   // 北区（微调）
        [-6,  0, -22],   // 北补给区 🆕
    ],
    /** 射击开始距离（米）—— 困难模式此距离外切换射击 */
    SHOOT_RANGE_MIN: 8,
    /** 射击结束距离（米）—— 超出此距离继续追击 */
    SHOOT_RANGE_MAX: 14,
    /** 射击间隔（秒） */
    SHOOT_COOLDOWN: 0.6,
    /** 子弹伤害 */
    BULLET_DAMAGE: 15,
    /** 射击散布（弧度） */
    SHOOT_INACCURACY: 0.03,
    /** 枪口闪光持续时间（秒） */
    MUZZLE_FLASH_DURATION: 0.08,
    /** 弹道曳光持续时间（秒） */
    TRACER_DURATION: 0.15,
};

// --- 按键映射 ---
export const KEYS = {
    FORWARD:  'KeyW',
    BACKWARD: 'KeyS',
    LEFT:     'KeyA',
    RIGHT:    'KeyD',
    JUMP:     'Space',
    RUN:      'ShiftLeft',
    RELOAD:   'KeyR',
    FIRE:     'Mouse0',  // 用于标识；实际鼠标用 PointerLock + click 事件
    /** 双击W奔跑间隔阈值（秒） */
    SPRINT_DOUBLETAP_TIME: 0.3,
    WEAPON_1: 'Digit1',
    WEAPON_2: 'Digit2',
    WEAPON_3: 'Digit3',
    GRENADE:  'KeyG',
};

// --- 拾取物 ---
export const PICKUP = {
    /** 拾取半径（米） */
    RADIUS: 1.5,
    /** 弹药包恢复量 */
    AMMO_AMOUNT: 30,
    /** 血包恢复量 */
    HEALTH_AMOUNT: 25,
    /** 最大备弹量 */
    MAX_RESERVE: 180,
    /** 拾取物重生时间（秒） */
    RESPAWN_TIME: 30,
    /** 生成坐标 [x, y, z] */
    SPAWN_POSITIONS: [
        [10,  0.8, -10],   // A侧（原）
        [-10, 0.8,  12],   // B侧（原）
        [ 0,  0.8,   0],   // 中路柱阵 🆕
        [-5,  0.8,  25],   // 南区 血包（原）
        [ 5,  0.8, -30],   // 北区 弹药（原）
        [22,  0.8, -22],   // A点后 血包（原）
        [-20, 0.8,  20],   // B平台旁 🆕
        [30,  2.8, -25],   // A狙击平台顶 弹药 🆕
        [-32, 0.8,  16],   // B矮掩体旁 🆕
    ],
};

// --- 得分 ---
export const SCORE = {
    /** 普通击杀得分 */
    KILL: 100,
    /** 爆头额外得分 */
    HEADSHOT_BONUS: 50,
};

// --- 武器切换 ---
export const WEAPON_SWITCH = {
    /** 武器下沉时间（秒） */
    LOWER_TIME: 0.08,
    /** 武器抬起时间（秒） */
    RAISE_TIME: 0.08,
    /** 切换时Y轴下沉量（米） */
    LOWER_Y_OFFSET: -0.2,
};

// --- 近战 ---
export const MELEE = {
    /** 匕首攻击范围（米） */
    RANGE: 5.0,
    /** 匕首伤害 */
    DAMAGE: 50,
    /** 挥刀动画总时长（秒）— 前摇80ms + 爆发100ms + 后摇170ms */
    ANIM_DURATION: 0.35,
};

// --- 手雷 ---
export const GRENADE = {
    /** 投掷初速度（米/秒） */
    THROW_SPEED: 15,
    /** 手雷重力（米/秒²） */
    GRAVITY: 15,
    /** 落地后延迟爆炸时间（秒） */
    LAND_FUSE: 1.0,
    /** 爆炸半径（米） */
    EXPLOSION_RADIUS: 16,
    /** 中心最大伤害 */
    MAX_DAMAGE: 200,
    /** 反弹系数 */
    BOUNCE_FACTOR: 0.3,
    /** 最大携带数 */
    MAX_COUNT: 2,
};

// --- 连杀 ---
export const KILLSTREAK = {
    /** 连杀时间窗口（秒） */
    WINDOW: 3.0,
    /** 连杀卡片显示时长（秒） */
    DISPLAY_DURATION: 2.5,
    /** 击杀确认显示时长（秒） */
    KILL_CONFIRM_DURATION: 0.8,
};

// --- 渲染 ---
export const RENDER = {
    /** 视场角（度） */
    FOV: 75,
    /** 近裁剪面 */
    NEAR: 0.1,
    /** 远裁剪面 */
    FAR: 500,
};

// --- HUD ---
export const HUD = {
    /** 命中标记显示时长（秒） */
    HIT_MARKER_DURATION: 0.15,
    /** 准星默认颜色 */
    CROSSHAIR_COLOR: '#ffffff',
    /** 准星基准缩放 */
    CROSSHAIR_STANDING: 1.0,
    /** 移动时准星缩放 */
    CROSSHAIR_MOVING: 1.4,
    /** 跳跃时准星缩放 */
    CROSSHAIR_JUMPING: 1.8,
    /** 射击时准星缩放 */
    CROSSHAIR_FIRING: 2.2,
    /** 准星恢复速度（lerp因子） */
    CROSSHAIR_RECOVERY: 8,
    /** 线宽（px） */
    CROSSHAIR_LINE_WIDTH: 2,
    /** 线长（px） */
    CROSSHAIR_LINE_LEN: 12,
    /** 中心间距（px） */
    CROSSHAIR_GAP: 4,
    /** 伤害方向指示器显示时长（秒） */
    DAMAGE_DIR_DURATION: 0.5,
    /** 击杀信息显示时长（秒） */
    KILL_MSG_DURATION: 3.0,
};

// --- 音效 ---
export const AUDIO = {
    /** 脚步声间隔 — 走路（秒） */
    FOOTSTEP_WALK: 0.50,
    /** 脚步声间隔 — 奔跑（秒） */
    FOOTSTEP_RUN: 0.35,
    /** 主音量 */
    MASTER_VOLUME: 0.6,
};

// --- HTML 元素 ID ---
export const UI_IDS = {
    BLOCKER: 'blocker',
    INSTRUCTIONS: 'instructions',
    CROSSHAIR: 'crosshair',
    HUD: 'hud',
    AMMO_DISPLAY: 'ammo',
    HEALTH_BAR: 'health-bar',
    HEALTH_FILL: 'health-fill',
    HIT_MARKER: 'ch-hit',
    DAMAGE_OVERLAY: 'damage-overlay',
    SCORE_DISPLAY: 'score',
    DAMAGE_DIRECTION: 'damage-dir',
    KILL_FEED: 'kill-feed',
    KILL_STREAK_CARD: 'kill-streak-card',
    KILL_CONFIRM: 'kill-confirm',
    WEAPON_NAME: 'weapon-name',
    GRENADE_COUNT: 'grenade-count',
    // 第五批新增
    DEATH_OVERLAY: 'death-overlay',
    DEATH_SCORE: 'death-score',
    DEATH_KILLS: 'death-kills',
    DEATH_WAVE: 'death-wave',
    SETTINGS_OVERLAY: 'settings-overlay',
    SENSITIVITY_SLIDER: 'sensitivity-slider',
    VOLUME_SLIDER: 'volume-slider',
    SETTINGS_RESUME: 'settings-resume',
    SENS_VALUE: 'sens-value',
    VOL_VALUE: 'vol-value',
    WAVE_DISPLAY: 'wave-display',
    WAVE_REMAIN: 'wave-remain',
    WAVE_TRANSITION: 'wave-transition',
};

// --- 生成 Box3 的辅助常数 ---
export const BOX3 = {
    /** 箱子半尺寸（米） */
    CRATE_HALF: 1.5,
};

// --- 设置系统 ---
export const SETTINGS = {
    DEFAULT_SENSITIVITY: 0.002,
    SENSITIVITY_MIN: 0.0005,
    SENSITIVITY_MAX: 0.006,
    DEFAULT_VOLUME: 0.6,
    VOLUME_MIN: 0.0,
    VOLUME_MAX: 1.0,
};

// --- localStorage 存储键 ---
export const STORAGE_KEYS = {
    SENSITIVITY: 'fps_settings_sensitivity',
    VOLUME: 'fps_settings_volume',
    DIFFICULTY: 'fps_settings_difficulty',
    CROSSHAIR_COLOR: 'fps_ch_color',
    CROSSHAIR_SHAPE: 'fps_ch_shape',
};

// --- 波次系统 ---
export const WAVES = {
    /** 波次间过渡时间（秒）—— 传送门模式仅作最小间隔 */
    TRANSITION_DELAY: 0.5,
};

// --- 传送门 ---
export const PORTAL = {
    /** 触发距离（米） */
    TRIGGER_RANGE: 4.0,
    /** 传送门高度（米，离地） */
    HEIGHT: 1.8,
    /** 传送门环半径（米） */
    RADIUS: 1.8,
    /** 环管半径（米） */
    TUBE_RADIUS: 0.12,
    /** 主色 */
    COLOR: 0xffaa00,
    /** 光晕色 */
    GLOW_COLOR: 0xff4400,
    /** 旋转速度（弧度/秒） */
    SPIN_SPEED: 1.5,
    /** 粒子数 */
    PARTICLE_COUNT: 12,
    /** 粒子轨道半径（米） */
    PARTICLE_ORBIT: 2.0,
    /** 粒子大小（米） */
    PARTICLE_SIZE: 0.15,
    /** 光点强度 */
    LIGHT_INTENSITY: 5.0,
    /** 光点范围（米） */
    LIGHT_RANGE: 15.0,
};

# 🔫 FPS 射击游戏

基于 **Three.js WebGL** 的浏览器端第一人称射击游戏。纯静态 HTML/JS，无需安装，打开即玩。

## 🎮 在线试玩

> **https://fsc-01.github.io/fps-shooting-game/**

## 🕹️ 操作方式

| 按键 | 功能 |
|------|------|
| W A S D | 移动 |
| 鼠标 | 视角 |
| 左键 | 射击 / 挥刀 |
| R | 换弹 |
| G | 投掷手雷 |
| 1 / 2 / 3 | 匕首 / USP手枪 / AK47 |
| 滚轮 | 快速切换武器 |
| 空格 | 跳跃 |
| Shift / 双击W | 奔跑 |
| V | 开镜 |
| C | 设置面板 |
| 走近传送门 | 进入下一波 |

## ✨ 核心功能

- **4 种武器**：AK47（全自动）、USP手枪、匕首（CS:GO 风格斜向斩击）、手雷（着地 1s 引信 + 16m AoE）
- **10 波关卡**：消灭全部敌人 → 传送门出现 → 走近进入下一波，难度递增
- **敌人 AI**：追击 + 困难模式射击 + 爆头独立判定（×5 伤害）
- **3D 真模型**：匕首/pistol/手雷（GLB） + AK47（OBJ），异步加载
- **真实纹理**：Poly Haven 2K 砖墙/沙地贴图
- **击杀信息流**：左下角实时滚动击杀日志（爆头/刀杀/手雷分类着色）
- **准星自定义**：4 种形状（十字/圆点/圆环/箭头）+ 颜色自选，localStorage 持久化
- **设置面板**：鼠标灵敏度/音量/困难模式，C 键呼出
- **程序化音效**：Web Audio API 合成全部音效，不依赖外部音频文件

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| Three.js 0.168 | WebGL 3D 渲染 |
| Web Audio API | 程序化音效合成 |
| Pointer Lock API | FPS 鼠标锁定控制 |
| ES Modules | 模块化架构（21 个源文件） |
| localStorage | 设置持久化 |

## 📁 项目结构

```
├── index.html              # 入口 + 全部 UI DOM
├── 启动.bat                 # Windows 一键启动
├── js/
│   ├── main.js             # 主循环（21 步帧逻辑）
│   ├── constants.js        # 全局常量（16 个配置块）
│   ├── scene.js            # Three.js 初始化（渲染器/相机/光照）
│   ├── map.js              # Dust2 风格地图（地面/围墙/掩体/传送门）
│   ├── collision.js        # AABB 分轴碰撞（滑墙效果）
│   ├── player.js           # 玩家控制（WASD/跳跃/血量/死亡）
│   ├── input.js            # 键鼠输入（PointerLock/双击W/C设置/V开镜）
│   ├── weapon.js           # 武器代理层
│   ├── weapon-manager.js   # 4 武器状态机（切换/射击/换弹/CS:GO 刀砍）
│   ├── weapon-models.js    # 3D 模型加载（GLB/OBJ + 程序化 fallback）
│   ├── enemy.js            # 敌人系统（AI 追击/射击/曳光弹/死亡动画）
│   ├── grenade.js          # 手雷系统（抛物线物理/反弹/AoE 爆炸）
│   ├── hud.js              # HUD（准星/血量/得分/击杀信息流）
│   ├── audio.js            # 音效合成（枪声/脚步/换弹/爆炸/刀砍）
│   ├── settings.js         # 设置面板（localStorage 持久化）
│   ├── waves.js            # 波次系统（10 波传送门模式）
│   ├── pickup.js           # 拾取系统（弹药包/血包/bob 动画）
│   ├── killstreak.js       # 连杀追踪（双杀/三杀/多杀）
│   ├── loaders/            # GLTFLoader.js + OBJLoader.js
│   └── utils/              # BufferGeometryUtils.js
├── textures/
│   ├── 砖墙.jpg / 沙地.jpg     # Poly Haven 2K diffuse
│   ├── pistol.glb / 手雷.glb   # Blender 导出 3D 模型
│   ├── 匕首/                   # 匕首 GLB + 贴图
│   └── AK47/                   # AK47 OBJ + MTL + TGA
├── LICENSE.md              # 许可证（源码 + 第三方资源）
└── README.md               # 本文件
```

## 🚀 本地运行

### Windows
双击 `启动.bat`

### macOS / Linux
```bash
cd 项目目录
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

## 📄 许可证

- **源代码**：由 Claude Code AI 辅助生成，基于用户（fsc-01）设计需求
- **贴图/3D模型**：见 [LICENSE.md](LICENSE.md)
- **Three.js**：[MIT License](https://github.com/mrdoob/three.js/blob/dev/LICENSE)

---

*开发历时 11 天（2026.06.10 – 06.22），6 批次迭代递增，~6000 行 JavaScript*

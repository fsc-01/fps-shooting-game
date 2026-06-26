// ============================================================
// map.js — Dust2 风格地图生成
// 地面 + 外围围墙 + A点/B点/中路 + 箱子掩体
// 返回碰撞体数组供 collision.js 使用
// ============================================================

import * as THREE from 'three';
import { WORLD, COLORS, PLAYER, BOX3, ENEMY, PICKUP } from './constants.js?v=701';

const texLoader = new THREE.TextureLoader();

/** @type {THREE.Box3[]} 所有可碰撞物体的 Box3 */
const colliders = [];

/**
 * 生成完整地图并添加到场景
 * @param {THREE.Scene} scene
 * @returns {{ colliders: THREE.Box3[], spawnPoint: THREE.Vector3 }}
 */
export function buildMap(scene) {
    colliders.length = 0; // 清空

    const { GROUND_SIZE, WALL_HEIGHT, WALL_THICKNESS } = WORLD;
    const HALF = GROUND_SIZE / 2;
    const T = WALL_THICKNESS;

    // === 地面 ===
    const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
    const groundTex = texLoader.load('./textures/sand.jpg',
        undefined,  // onProgress
        function (err) { console.warn('[map] 地面纹理加载失败, 使用纯色fallback', err); }
    );
    groundTex.colorSpace = THREE.SRGBColorSpace;
    groundTex.wrapS = THREE.RepeatWrapping; groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(24, 24);
    const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, color: COLORS.GROUND, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    // 地面本身不算碰撞体（始终在上面），但外边界由墙处理

    // === 外围四面墙 ===
    const wallGeoH = new THREE.BoxGeometry(GROUND_SIZE, WALL_HEIGHT, T); // 水平墙（北/南）
    const wallTex = texLoader.load('./textures/brick.jpg',
        undefined,  // onProgress
        function (err) { console.warn('[map] 墙壁纹理加载失败, 使用纯色fallback', err); }
    );
    wallTex.colorSpace = THREE.SRGBColorSpace;
    wallTex.wrapS = THREE.RepeatWrapping; wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(20, 4);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: COLORS.WALL, roughness: 0.8 });

    // 北墙 & 南墙（无门洞，整面）
    const wallsNS = [
        { geo: wallGeoH, pos: [0, WALL_HEIGHT / 2, -HALF], rx: 0 },  // 北
        { geo: wallGeoH, pos: [0, WALL_HEIGHT / 2, HALF], rx: 0 },   // 南
    ];
    for (const w of wallsNS) {
        const mesh = new THREE.Mesh(w.geo, wallMat);
        mesh.position.set(...w.pos);
        mesh.rotation.x = w.rx;
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
        addCollider(mesh);
    }

    // 东墙 & 西墙 — 在门洞处断开（z≈±10，门宽4m），免得墙Box3挡住门
    const doorZ1 = -10, doorZ2 = 10, doorHalfW = 3;  // 门半宽3m（总宽6m留余地）
    const wallSegs = [
        // 南段: doorZ2+doorHalfW 到 HALF
        { zc: ((doorZ2 + doorHalfW) + HALF) / 2, len: HALF - (doorZ2 + doorHalfW) },
        // 中段: doorZ1+doorHalfW 到 doorZ2-doorHalfW
        { zc: ((doorZ1 + doorHalfW) + (doorZ2 - doorHalfW)) / 2, len: (doorZ2 - doorHalfW) - (doorZ1 + doorHalfW) },
        // 北段: -HALF 到 doorZ1-doorHalfW
        { zc: (-HALF + (doorZ1 - doorHalfW)) / 2, len: (doorZ1 - doorHalfW) - (-HALF) },
    ];
    for (const seg of wallSegs) {
        // 东墙
        const geoE = new THREE.BoxGeometry(T, WALL_HEIGHT, seg.len);
        const meshE = new THREE.Mesh(geoE, wallMat);
        meshE.position.set(HALF, WALL_HEIGHT / 2, seg.zc);
        meshE.castShadow = true; meshE.receiveShadow = true;
        scene.add(meshE); addCollider(meshE);
        // 西墙
        const geoW = new THREE.BoxGeometry(T, WALL_HEIGHT, seg.len);
        const meshW = new THREE.Mesh(geoW, wallMat);
        meshW.position.set(-HALF, WALL_HEIGHT / 2, seg.zc);
        meshW.castShadow = true; meshW.receiveShadow = true;
        scene.add(meshW); addCollider(meshW);
    }

    // === A 点掩体群（地图东侧） ===
    createCrate(scene, 25, 1.5, -15);
    createCrate(scene, 28, 1.5, -18);
    createCrate(scene, 22, 1.5, -18);
    // 堆叠箱子
    createCrate(scene, 25, 4.5, -18);

    // === B 点掩体群（地图西侧） ===
    createCrate(scene, -25, 1.5, 15);
    createCrate(scene, -28, 1.5, 12);
    createCrate(scene, -22, 1.5, 12);

    // === 中路短墙 ===
    // 对角线斜墙 — 拆成4段轴对齐小墙，消除45°旋转导致的AABB膨胀（原先~40m²空气碰撞区）
    // 4段沿 z=x 对角线阶梯排列，从(-2.1,-2.1)到(2.1,2.1)，每段2.5×2.5m
    const diagPts = [[-2.1, -2.1], [-0.7, -0.7], [0.7, 0.7], [2.1, 2.1]];
    for (const [dx, dz] of diagPts) {
        createWallSegment(scene, dx, WALL_HEIGHT / 2, dz, 2.5, 2.5, 0, COLORS.WALL_ACCENT);
    }
    // 正方位短墙（无旋转，AABB=几何体 ✓）
    createWallSegment(scene, -5, WALL_HEIGHT / 2, 5, 10, 3, 0, COLORS.WALL_ACCENT);
    createWallSegment(scene, 5, WALL_HEIGHT / 2, -5, 10, 3, 0, COLORS.WALL_ACCENT);

    // === A大门（东侧入口，rotY=π/2 使门框沿Z轴平行墙面，X=59贴墙面） ===
    createDoorway(scene, HALF - T / 2, 0, -10, 6, 4, Math.PI / 2);
    createDoorway(scene, HALF - T / 2, 0, 10, 6, 4, Math.PI / 2);

    // === B大门（西侧入口，rotY=π/2 使门框沿Z轴平行墙面） ===
    createDoorway(scene, -HALF + T / 2, 0, -10, 6, 4, Math.PI / 2);
    createDoorway(scene, -HALF + T / 2, 0, 10, 6, 4, Math.PI / 2);

    // ══════════════════════════════════════════════════
    // 地图复杂度增强（第6批优化）
    // ══════════════════════════════════════════════════

    // --- A点 狙击平台（可跳上的2m高台，6×6m，坐地） ---
    createPlatform(scene, 30, 0, -25, 6, 2, 6, 0xa08060);
    // 台阶（跳跃辅助，也可作小掩体）
    createStepBox(scene, 27, 0.67, -23, 2, 0.67, 2, 0xa08060);

    // --- A点 长走廊墙（10×2m，形成通道感） ---
    createWallSegment(scene, 15, WALL_HEIGHT / 2, -30, 10, 2, 0, COLORS.WALL_ACCENT);
    createCrate(scene, 20, 1.5, -28);

    // --- B点 L形矮掩体（1m高，蹲姿掩体） ---
    createBarrier(scene, -30, 18, 8, 1, 0xa08050);
    createBarrier(scene, -34, 22, 6, 1, 0xa08050);

    // --- B点 小高台（1.5m，一步跳上，坐地） ---
    createPlatform(scene, -28, 0, 22, 5, 1.5, 5, 0xa08060);
    createCrate(scene, -20, 1.5, 18);

    // --- 中路 四根柱子（围绕对角线墙，提供动态掩体） ---
    const pillars = [[-4, -4], [4, 4], [-3, 3], [3, -3]];
    for (const [px, pz] of pillars) {
        createPillar(scene, px, pz, 0.6, WALL_HEIGHT, COLORS.WALL_ACCENT);
    }

    // --- 中路南 矮墙（出生区前沿掩体） ---
    createBarrier(scene, -6, 12, 5, 0.8, 0xa08050);
    createBarrier(scene, 6, 12, 5, 0.8, 0xa08050);

    // --- 北区 补给站掩体 ---
    createBarrier(scene, -8, -20, 6, 0.8, 0xa08050);
    createCrate(scene, 8, 1.5, -22);

    // --- 战场散落油桶（圆柱形视觉变化） ---
    createBarrel(scene, 15, -8);
    createBarrel(scene, -15, 8);
    createBarrel(scene, -10, -10);
    createBarrel(scene, 10, 10);

    // 出生点（中路靠南）
    const spawnPoint = new THREE.Vector3(0, PLAYER.HEIGHT, 20);

    // 敌人生成点（Vector3数组）
    const enemySpawns = ENEMY.SPAWN_POSITIONS.map(([x, y, z]) => new THREE.Vector3(x, y, z));

    // 拾取物生成点（Vector3数组）
    const pickupSpawns = PICKUP.SPAWN_POSITIONS.map(([x, y, z]) => new THREE.Vector3(x, y, z));

    return { colliders, spawnPoint, enemySpawns, pickupSpawns };
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 创建一个 3×3×3 的箱子掩体
 */
function createCrate(scene, x, y, z) {
    const geo = new THREE.BoxGeometry(BOX3.CRATE_HALF * 2, BOX3.CRATE_HALF * 2, BOX3.CRATE_HALF * 2);
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.CRATE, roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    addCollider(mesh);
    return mesh;
}

/**
 * 创建一段墙体
 * @param {number} w — 宽（X轴）
 * @param {number} d — 厚（Z轴）
 * @param {number} rotY — 绕Y轴旋转
 */
function createWallSegment(scene, x, y, z, w, d, rotY, color) {
    const geo = new THREE.BoxGeometry(w, WORLD.WALL_HEIGHT, d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    addCollider(mesh);
    return mesh;
}

/**
 * 在墙上开门洞（两根门柱 + 横梁，通过 Group 统一旋转）
 * 门框在局部空间沿 X 轴展开（柱子在 ±w/2），rotY 将整个门框旋转到墙面方向：
 *   - rotY=0      → 门框沿 X 轴，用于北/南墙（墙面沿 X）
 *   - rotY=π/2    → 门框沿 Z 轴，用于东/西墙（墙面沿 Z）
 * @param {number} h — 门洞高度（米）
 * @param {number} w — 门洞宽度（米）
 * @param {number} rotY — Group 绕 Y 轴旋转（弧度）
 */
function createDoorway(scene, x, y, z, h, w, rotY) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;

    const pillarGeo = new THREE.BoxGeometry(0.5, h, 0.5);
    const pillarMat = new THREE.MeshStandardMaterial({ color: COLORS.WALL_ACCENT, roughness: 0.8 });

    // 左柱（局部空间 -w/2 沿 X）
    const l = new THREE.Mesh(pillarGeo, pillarMat);
    l.position.set(-w / 2, h / 2, 0);
    l.castShadow = true;
    group.add(l);
    // 右柱（局部空间 +w/2 沿 X）
    const r = new THREE.Mesh(pillarGeo, pillarMat);
    r.position.set(w / 2, h / 2, 0);
    r.castShadow = true;
    group.add(r);
    // 横梁（局部空间居中，沿 X 展开 w+1）
    const beamGeo = new THREE.BoxGeometry(w + 1, 0.5, 0.5);
    const beam = new THREE.Mesh(beamGeo, pillarMat);
    beam.position.set(0, h, 0);
    group.add(beam);

    scene.add(group);
    // 碰撞盒在 world space 计算（setFromObject 会遍历 group 层级）
    addCollider(group);
}

/**
 * 将 mesh 的包围盒注册到碰撞列表
 */
function addCollider(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    colliders.push(box);
}

// ============================================================
// 新增辅助函数（地图复杂度增强）
// ============================================================

/**
 * 创建一个可站立的平台（BoxGeometry，轴对齐）
 * @param {number} h — 平台总高度（米）
 * @param {number} w — 宽（X轴）
 * @param {number} d — 深（Z轴）
 */
function createPlatform(scene, x, yBase, z, w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    // yBase 是平台底部高度，mesh.position.y = yBase + h/2
    mesh.position.set(x, yBase + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    addCollider(mesh);
    return mesh;
}

/**
 * 创建一个台阶（细扁盒子，可踩踏）
 */
function createStepBox(scene, x, yTop, z, w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, yTop - h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    addCollider(mesh);
    return mesh;
}

/**
 * 创建一个矮掩体（1m高左右，适合蹲姿掩体）
 */
function createBarrier(scene, x, z, width, height, color) {
    const geo = new THREE.BoxGeometry(width, height, 0.5);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    addCollider(mesh);
    return mesh;
}

/**
 * 创建一根柱子（细高，提供掩体）
 */
function createPillar(scene, x, z, radius, height, color) {
    const geo = new THREE.CylinderGeometry(radius, radius, height, 12);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    addCollider(mesh);
    return mesh;
}

/**
 * 创建一个油桶（圆柱形装饰掩体）
 */
function createBarrel(scene, x, z) {
    const geo = new THREE.CylinderGeometry(0.6, 0.6, 1.2, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.5, metalness: 0.3 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.6, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    addCollider(mesh);
    // 顶部环
    const ringGeo = new THREE.TorusGeometry(0.55, 0.08, 8, 16);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x3a3020, roughness: 0.3, metalness: 0.7 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.6;
    mesh.add(ring);
    return mesh;
}

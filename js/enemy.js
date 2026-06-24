// ============================================================
// enemy.js — 敌人系统
// MC风格方块人模型 + AI + 碰撞 + 攻击 + 死亡动画
// 第五批新增：射击能力 / statScale / spawnWaveEnemies
// ============================================================

import * as THREE from 'three';
import { ENEMY } from './constants.js?v=700';
import { resolveCollision } from './collision.js?v=700';
import { isHardMode } from './settings.js?v=700';

// --- 内部状态 ---
const enemies = [];
const tracerPool = [];
let nextEnemyId = 0;
/** 最后一个敌人死亡的位置（用于传送门生成） */
const lastDeathPosition = new THREE.Vector3();
/** 本帧是否有敌人射击 */
let enemyShotThisFrame = false;

// 复用射线
const losRaycaster = new THREE.Raycaster();

// ============================================================
// 公开 API
// ============================================================

/**
 * 初始化所有敌人（清除旧敌人后重新生成）
 */
export function initEnemies(scene, spawns) {
    clearAllEnemies(scene);
    for (const [x, y, z] of spawns) {
        enemies.push(createEnemy(scene, new THREE.Vector3(x, y, z)));
    }
    console.log('[enemy] ' + enemies.length + ' 个敌人生成完毕');
}

/**
 * 波次生成：在已有敌人基础上追加新敌人（不清除现有）
 * @param {THREE.Scene} scene
 * @param {number[]} config — [count, hpMult, speedMult, dmgMult]
 * @param {THREE.Vector3[]} spawnPositions — 可用的生成位置列表
 */
export function spawnWaveEnemies(scene, config, spawnPositions) {
    var count = config[0];
    var statScale = { hp: config[1], speed: config[2], damage: config[3] };
    var startId = nextEnemyId;

    for (var i = 0; i < count; i++) {
        var base = spawnPositions[i % spawnPositions.length].clone();
        // 微小随机偏移避免重叠
        base.x += (Math.random() - 0.5) * 1.5;
        base.z += (Math.random() - 0.5) * 1.5;
        enemies.push(createEnemy(scene, base, statScale));
    }

    console.log('[enemy] 波次生成 ' + count + ' 个敌人 (ID ' + startId + '-' + (nextEnemyId - 1) + ')');
}

/**
 * 每帧更新所有敌人
 * @param {number} dt
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3} playerPos
 * @param {THREE.Box3[]} colliders
 * @param {(amount: number, sourcePos?: THREE.Vector3) => void} onPlayerDamage — 玩家受伤回调(伤害值, 可选来源坐标)
 */
export function updateEnemies(dt, scene, playerPos, colliders, onPlayerDamage) {
    var enemiesAttacking = 0;
    enemyShotThisFrame = false;

    for (var i = 0; i < enemies.length; i++) {
        var enemy = enemies[i];

        if (!enemy.alive) {
            updateDeathAnimation(enemy, dt, scene);
            continue;
        }

        var dx = playerPos.x - enemy.group.position.x;
        var dz = playerPos.z - enemy.group.position.z;
        var distToPlayer = Math.sqrt(dx * dx + dz * dz);

        // 检测
        if (distToPlayer <= ENEMY.DETECT_RANGE) {
            enemy.aggro = true;
        }

        // 计时器
        enemy.attackTimer -= dt;
        enemy.shootTimer -= dt;

        // --- 射击行为（仅困难模式，15-25m 范围，有视线） ---
        if (isHardMode() && enemy.aggro && distToPlayer >= ENEMY.SHOOT_RANGE_MIN && distToPlayer <= ENEMY.SHOOT_RANGE_MAX) {
            // 停止移动，面向玩家
            enemy.velocity.x = 0;
            enemy.velocity.z = 0;
            var angle = Math.atan2(dx, dz);
            enemy.group.rotation.y = angle;

            if (hasLineOfSight(enemy, playerPos, colliders) && enemy.shootTimer <= 0) {
                var hit = enemyShoot(enemy, playerPos, scene);
                enemy.shootTimer = ENEMY.SHOOT_COOLDOWN;
                if (hit) {
                    var scaledDmg = ENEMY.BULLET_DAMAGE * (enemy.damage / ENEMY.DAMAGE);
                    onPlayerDamage(scaledDmg, enemy.group.position.clone());
                }
            }
        } else if (enemy.aggro && distToPlayer > 0.01) {
            // --- 追击（近距离 + 远距离） ---
            var angle = Math.atan2(dx, dz);
            enemy.group.rotation.y = angle;

            var dirX = dx / distToPlayer;
            var dirZ = dz / distToPlayer;
            enemy.velocity.x = dirX * enemy.speed;
            enemy.velocity.z = dirZ * enemy.speed;
        } else {
            enemy.velocity.x = 0;
            enemy.velocity.z = 0;
        }

        // --- 移动 + 碰撞 ---
        if (enemy.velocity.x !== 0 || enemy.velocity.z !== 0) {
            enemy.group.position.x += enemy.velocity.x * dt;
            enemy.group.position.z += enemy.velocity.z * dt;

            var body = {
                x: enemy.group.position.x,
                y: enemy.group.position.y,
                z: enemy.group.position.z,
                radius: ENEMY.RADIUS,
                height: ENEMY.HEIGHT,
            };
            var resolved = resolveCollision(body, colliders);
            enemy.group.position.x = resolved.x;
            enemy.group.position.z = resolved.z;
        }

        // --- 行走动画 ---
        var isMoving = (enemy.velocity.x !== 0 || enemy.velocity.z !== 0);
        if (enemy.aggro && isMoving) {
            var bob = Math.sin(performance.now() * 0.008) * 0.3;
            enemy.armL.rotation.x = bob;
            enemy.armR.rotation.x = -bob;
            enemy.legL.rotation.x = -bob;
            enemy.legR.rotation.x = bob;
        }

        // --- 近战攻击 ---
        if (enemy.aggro && distToPlayer <= ENEMY.ATTACK_RANGE && enemy.attackTimer <= 0) {
            onPlayerDamage(ENEMY.DAMAGE * (enemy.damage / ENEMY.DAMAGE));
            enemy.attackTimer = ENEMY.ATTACK_COOLDOWN;
            enemiesAttacking++;
        }

        updateHitboxes(enemy);
    }

    // 清理过期曳光弹
    updateTracers(dt);

    return { enemiesAttacking: enemiesAttacking };
}

export function getEnemyHitTargets() {
    var colliders = [];
    var headMap = new Map();
    var bodyMap = new Map();

    for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (!e.alive) continue;
        colliders.push(e.headBox);
        headMap.set(e.headBox, e.id);
        colliders.push(e.bodyBox);
        bodyMap.set(e.bodyBox, e.id);
    }
    return { colliders: colliders, headMap: headMap, bodyMap: bodyMap };
}

export function applyDamage(enemyId, amount, isHeadshot) {
    var enemy = findEnemy(enemyId);
    if (!enemy || !enemy.alive) return { killed: false, headshot: false, score: 0 };

    enemy.health -= amount;
    if (enemy.health <= 0) {
        enemy.health = 0;
        enemy.alive = false;
        enemy.deathTimer = 0;
        enemy.originalY = enemy.group.position.y;
        enemy.velocity.set(0, 0, 0);
        // 记录最后死亡位置（用于传送门）
        lastDeathPosition.copy(enemy.group.position);
        return { killed: true, headshot: isHeadshot };
    }
    return { killed: false, headshot: false, score: 0 };
}

export function getAliveCount() {
    var c = 0;
    for (var i = 0; i < enemies.length; i++) { if (enemies[i].alive) c++; }
    return c;
}

export function getEnemyPositions() {
    var arr = [];
    for (var i = 0; i < enemies.length; i++) {
        if (enemies[i].alive) arr.push(enemies[i].group.position.clone());
    }
    return arr;
}

export function getEnemyPositionsWithIds() {
    var arr = [];
    for (var i = 0; i < enemies.length; i++) {
        if (enemies[i].alive) {
            arr.push({ enemyId: enemies[i].id, position: enemies[i].group.position.clone() });
        }
    }
    return arr;
}

/** 返回最后一个敌人死亡的位置（用于生成传送门） */
export function getLastDeathPosition() {
    return lastDeathPosition.clone();
}

/** 返回并清除"本帧有敌人射击"标记（用于触发子弹呼啸音效） */
export function getAndClearEnemyShotFired() {
    var fired = enemyShotThisFrame;
    enemyShotThisFrame = false;
    return fired;
}

/** 获取正在追击玩家的近处敌人数量（用于脚步声） */
export function getMovingEnemiesNearPlayer(playerPos, maxDist) {
    var count = 0;
    for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (!e.alive) continue;
        var isMoving = (e.velocity.x !== 0 || e.velocity.z !== 0);
        if (!isMoving) continue;
        var dx = playerPos.x - e.group.position.x;
        var dz = playerPos.z - e.group.position.z;
        if (Math.sqrt(dx * dx + dz * dz) <= maxDist) {
            count++;
        }
    }
    return count;
}

// ============================================================
// 内部 — 创建敌人
// ============================================================

function createEnemy(scene, position, statScale) {
    statScale = statScale || { hp: 1.0, speed: 1.0, damage: 1.0 };

    var group = new THREE.Group();
    group.position.copy(position);
    group.castShadow = true;

    var skinColors = [0xc69c6d, 0xd4a574, 0xb8875b, 0xa07848, 0xcc9966, 0xbb8b55, 0xd0a080, 0xc89860];
    var shirtColors = [0xcc3333, 0x3366cc, 0x33aa33, 0xcc6633, 0x6633cc, 0xcc9900, 0x338888, 0x883388];
    var idx = nextEnemyId;
    var skinColor = skinColors[idx % skinColors.length];
    var shirtColor = shirtColors[idx % shirtColors.length];

    var skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
    var shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
    var pantsMat = new THREE.MeshStandardMaterial({ color: 0x334466, roughness: 0.8 });

    // 头部
    var headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    var headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.set(0, 1.55, 0);
    headMesh.castShadow = true;
    group.add(headMesh);

    // 身体
    var bodyGeo = new THREE.BoxGeometry(0.7, 0.8, 0.4);
    var bodyMesh = new THREE.Mesh(bodyGeo, shirtMat);
    bodyMesh.position.set(0, 0.95, 0);
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // 四肢
    var armGeo = new THREE.BoxGeometry(0.25, 0.7, 0.25);
    var armL = new THREE.Mesh(armGeo, skinMat);
    armL.position.set(-0.55, 1.15, 0);
    armL.castShadow = true;
    group.add(armL);

    var armR = new THREE.Mesh(armGeo, skinMat);
    armR.position.set(0.55, 1.15, 0);
    armR.castShadow = true;
    group.add(armR);

    var legGeo = new THREE.BoxGeometry(0.28, 0.6, 0.28);
    var legL = new THREE.Mesh(legGeo, pantsMat);
    legL.position.set(-0.2, 0.35, 0);
    legL.castShadow = true;
    group.add(legL);

    var legR = new THREE.Mesh(legGeo, pantsMat);
    legR.position.set(0.2, 0.35, 0);
    legR.castShadow = true;
    group.add(legR);

    scene.add(group);

    var headBox = new THREE.Box3();
    var bodyBox = new THREE.Box3();
    var enemyId = nextEnemyId++;

    var enemy = {
        id: enemyId,
        group: group,
        headMesh: headMesh,
        bodyMesh: bodyMesh,
        armL: armL,
        armR: armR,
        legL: legL,
        legR: legR,
        headBox: headBox,
        bodyBox: bodyBox,
        health: ENEMY.HEALTH * statScale.hp,
        attackTimer: 0,
        velocity: new THREE.Vector3(),
        alive: true,
        deathTimer: 0,
        aggro: false,
        originalY: position.y,
        // 第五批新增
        speed: ENEMY.SPEED * statScale.speed,
        damage: ENEMY.DAMAGE * statScale.damage,
        shootTimer: 0,
        muzzleFlash: null,
    };

    updateHitboxes(enemy);
    return enemy;
}

// ============================================================
// 内部 — Hitbox
// ============================================================

function updateHitboxes(enemy) {
    var hw = new THREE.Vector3();
    enemy.headMesh.getWorldPosition(hw);
    var hh = 0.28;
    enemy.headBox.min.set(hw.x - hh, hw.y - hh, hw.z - hh);
    enemy.headBox.max.set(hw.x + hh, hw.y + hh, hw.z + hh);

    var bw = new THREE.Vector3();
    enemy.bodyMesh.getWorldPosition(bw);
    enemy.bodyBox.min.set(bw.x - 0.5, bw.y - 0.5, bw.z - 0.35);
    enemy.bodyBox.max.set(bw.x + 0.5, bw.y + 0.5, bw.z + 0.35);
}

// ============================================================
// 内部 — 死亡动画
// ============================================================

function updateDeathAnimation(enemy, dt, scene) {
    enemy.deathTimer += dt;
    var p = Math.min(enemy.deathTimer / ENEMY.DEATH_DURATION, 1.0);
    enemy.group.rotation.x = p * (Math.PI / 2);
    enemy.group.position.y = enemy.originalY - p * 0.8;

    enemy.group.traverse(function (child) {
        if (child.isMesh && child.material && child.material.opacity !== undefined) {
            child.material.transparent = true;
            child.material.opacity = 1 - p;
            child.material.depthWrite = p < 0.5;
        }
    });

    if (p >= 1.0) {
        scene.remove(enemy.group);
        disposeEnemy(enemy);
    }
}

// ============================================================
// 第五批新增 — 敌人射击
// ============================================================

/**
 * 视线检测：敌人头部 → 玩家位置，是否被地图碰撞体遮挡
 */
function hasLineOfSight(enemy, playerPos, colliders) {
    var headWorld = new THREE.Vector3();
    enemy.headMesh.getWorldPosition(headWorld);
    var dir = playerPos.clone().sub(headWorld).normalize();
    var dist = headWorld.distanceTo(playerPos);

    losRaycaster.set(headWorld, dir);

    for (var i = 0; i < colliders.length; i++) {
        var pt = new THREE.Vector3();
        if (losRaycaster.ray.intersectBox(colliders[i], pt)) {
            var hitDist = headWorld.distanceTo(pt);
            if (hitDist < dist - 0.1) return false;
        }
    }
    return true;
}

/**
 * 敌人射击 — 散布 + 枪口火焰 + 曳光弹 + 命中判定
 * @returns {boolean} 是否命中玩家
 */
function enemyShoot(enemy, playerPos, scene) {
    enemyShotThisFrame = true;
    showEnemyMuzzleFlash(enemy);

    var headWorld = new THREE.Vector3();
    enemy.headMesh.getWorldPosition(headWorld);
    var dirToPlayer = playerPos.clone().sub(headWorld).normalize();

    // 散布
    var spreadX = (Math.random() - 0.5) * ENEMY.SHOOT_INACCURACY * 2;
    var spreadY = (Math.random() - 0.5) * ENEMY.SHOOT_INACCURACY * 2;
    dirToPlayer.x += spreadX;
    dirToPlayer.y += spreadY;
    dirToPlayer.normalize();

    // 命中判定：散布后的射线终点离玩家距离
    var dist = headWorld.distanceTo(playerPos);
    var projected = headWorld.clone().addScaledVector(dirToPlayer, dist);
    var missDistance = projected.distanceTo(playerPos);
    var isHit = missDistance <= 0.5;

    // 曳光弹
    createTracer(headWorld, dirToPlayer, Math.min(dist, ENEMY.SHOOT_RANGE_MAX), isHit);

    return isHit;
}

/**
 * 敌人在右臂位置显示枪口火焰 sprite
 */
function showEnemyMuzzleFlash(enemy) {
    if (!enemy.muzzleFlash) {
        var tex = createMuzzleFlashTexture();
        var mat = new THREE.SpriteMaterial({
            map: tex, blending: THREE.AdditiveBlending,
            depthTest: false, depthWrite: false,
        });
        enemy.muzzleFlash = new THREE.Sprite(mat);
        enemy.muzzleFlash.scale.set(0.3, 0.3, 1);
        enemy.muzzleFlash.visible = false;
        enemy.armR.add(enemy.muzzleFlash);
        enemy.muzzleFlash.position.set(0, -0.4, 0);
    }
    enemy.muzzleFlash.visible = true;
    // 短时后隐藏
    setTimeout(function () {
        if (enemy.muzzleFlash) enemy.muzzleFlash.visible = false;
    }, ENEMY.MUZZLE_FLASH_DURATION * 1000);
}

/**
 * 敌人枪口火焰纹理（程序化径向渐变）
 */
function createMuzzleFlashTexture() {
    var size = 32;
    var canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    var ctx = canvas.getContext('2d');
    var g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,200,1)');
    g.addColorStop(0.2, 'rgba(255,180,50,0.8)');
    g.addColorStop(0.5, 'rgba(255,80,20,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

/**
 * 创建曳光弹道线（细圆柱，短暂显示后自动清理）
 */
function createTracer(origin, direction, length, isHit) {
    var geo = new THREE.CylinderGeometry(0.01, 0.01, length, 4);
    var mat = new THREE.MeshBasicMaterial({
        color: isHit ? 0xff4444 : 0xffaa44,
        transparent: true, opacity: 0.8, depthTest: true,
    });
    var tracer = new THREE.Mesh(geo, mat);
    tracer.position.copy(origin).addScaledVector(direction, length / 2);
    var quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), direction);
    tracer.setRotationFromQuaternion(quat);

    // 需要加到 scene 中 — 通过存储引用来管理
    // 简化方案：把 tracer 加到 enemy.js 可以看到的 scene。这里通过闭包处理：
    // 实际上 scene 不在本函数作用域中，改为在 updateTracers 中管理。
    // 用全局 tracerPool 推迟添加。
    tracer.userData = { timer: ENEMY.TRACER_DURATION, scene: null };
    tracerPool.push(tracer);
    return tracer;
}

/**
 * 将新 tracer 加入场景（由 updateEnemies 的调用者在 scene 上下文中调用）
 */
function updateTracers(dt) {
    for (var i = tracerPool.length - 1; i >= 0; i--) {
        var t = tracerPool[i];
        // 如果还没加入场景，跳过（在外部由 updateEnemies 的 scene 参数处理）
        if (!t.parent) continue;
        t.userData.timer -= dt;
        if (t.userData.timer <= 0) {
            if (t.parent) t.parent.remove(t);
            t.geometry.dispose();
            t.material.dispose();
            tracerPool.splice(i, 1);
        }
    }
}

/**
 * 将新建 tracer 加到场景（在 updateEnemies 主循环中调用）
 */
export function flushTracers(scene) {
    for (var i = 0; i < tracerPool.length; i++) {
        if (!tracerPool[i].parent) {
            scene.add(tracerPool[i]);
            tracerPool[i].userData.scene = scene;
        }
    }
}

// ============================================================
// 内部 — 工具
// ============================================================

function findEnemy(id) {
    for (var i = 0; i < enemies.length; i++) {
        if (enemies[i].id === id) return enemies[i];
    }
    return null;
}

function clearAllEnemies(scene) {
    for (var i = 0; i < enemies.length; i++) {
        scene.remove(enemies[i].group);
        disposeEnemy(enemies[i]);
    }
    enemies.length = 0;
    nextEnemyId = 0;
    // 清理残留 tracer
    for (var j = 0; j < tracerPool.length; j++) {
        var t = tracerPool[j];
        if (t.parent) t.parent.remove(t);
        if (t.geometry) t.geometry.dispose();
        if (t.material) t.material.dispose();
    }
    tracerPool.length = 0;
}

function disposeEnemy(enemy) {
    enemy.group.traverse(function (child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(function (m) { m.dispose(); });
            } else {
                child.material.dispose();
            }
        }
    });
}

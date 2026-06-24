// ============================================================
// grenade.js — 手雷系统
// G键投掷 + 抛物线物理 + 碰撞反弹 + 3秒引信 + AoE爆炸
// ============================================================

import * as THREE from 'three';
import { GRENADE } from './constants.js?v=700';
import { playGrenadePin, playExplosion } from './audio.js?v=700';

// --- 内部状态 ---
let grenadeCount = GRENADE.MAX_COUNT;
/** @type {Array<{ mesh: THREE.Group, velocity: THREE.Vector3, position: THREE.Vector3,
      landed: boolean, landTimer: number, alive: boolean }>} */
const grenades = [];
const explosionEffects = [];

// ============================================================
// 公开 API
// ============================================================

export function initGrenades() {
    grenadeCount = GRENADE.MAX_COUNT;
    grenades.length = 0;
    explosionEffects.length = 0;
}

/**
 * 投掷手雷
 * @param {THREE.Camera} camera
 * @param {THREE.Scene} scene
 */
export function throwGrenade(camera, scene) {
    if (grenadeCount <= 0) return false;
    grenadeCount--;

    const origin = camera.getWorldPosition(new THREE.Vector3());
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

    // 初速度：前向 + 上弧
    const velocity = forward.clone().multiplyScalar(GRENADE.THROW_SPEED * 0.75);
    velocity.y += GRENADE.THROW_SPEED * 0.35;

    // 出生位置：相机前0.6米
    const pos = origin.clone().addScaledVector(forward, 0.6);

    const mesh = buildGrenadeMesh();
    mesh.position.copy(pos);
    scene.add(mesh);

    grenades.push({
        mesh,
        velocity,
        position: pos.clone(),
        landed: false,
        landTimer: 0,
        alive: true,
    });

    playGrenadePin();
    return true;
}

/**
 * 每帧更新所有飞行中的手雷
 * @param {number} dt
 * @param {THREE.Scene} scene
 * @param {THREE.Box3[]} colliders
 * @param {{ enemyId: number, position: THREE.Vector3 }[]} enemyPositions — 带ID的敌人位置
 * @param {(enemyId: number, damage: number, isHeadshot: boolean) => { killed: boolean }} onDamage
 * @param {() => number} getNow — 获取当前时间（用于连杀追踪）
 */
// 外部注入：爆炸时获取最新的敌人位置
var getFreshEnemyPositions = null;
export function setEnemyPositionProvider(fn) { getFreshEnemyPositions = fn; }

export function updateGrenades(dt, scene, colliders, enemyPositions, onDamage, getNow) {
    // 更新飞行中的手雷
    for (const g of grenades) {
        if (!g.alive) continue;

        // 落地后倒计时
        if (g.landed) {
            g.landTimer -= dt;
            if (g.landTimer <= 0) {
                explode(g, scene, enemyPositions, onDamage, getNow);
                continue;
            }
            continue;
        }

        // 重力
        g.velocity.y -= GRENADE.GRAVITY * dt;

        // 位置更新
        g.position.x += g.velocity.x * dt;
        g.position.y += g.velocity.y * dt;
        g.position.z += g.velocity.z * dt;
        g.mesh.position.copy(g.position);

        // 地面碰撞 → 着地即触发1秒引信
        if (g.position.y <= 0.05) {
            g.position.y = 0.05;
            g.mesh.position.y = 0.05;
            // 首次着地：启动1秒引信
            if (!g.landed) {
                g.landed = true;
                g.landTimer = GRENADE.LAND_FUSE;
                g.velocity.set(0, 0, 0);
                continue;
            }
        }

        // 墙壁碰撞
        for (const box of colliders) {
            if (g.position.y > box.max.y || g.position.y < box.min.y) continue;

            const cx = Math.max(box.min.x, Math.min(g.position.x, box.max.x));
            const cz = Math.max(box.min.z, Math.min(g.position.z, box.max.z));
            const dx = g.position.x - cx;
            const dz = g.position.z - cz;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const radius = 0.04;

            if (dist < radius) {
                const nx = dx / (dist || 0.0001);
                const nz = dz / (dist || 0.0001);
                g.position.x = cx + nx * radius;
                g.position.z = cz + nz * radius;
                g.mesh.position.x = g.position.x;
                g.mesh.position.z = g.position.z;
                // 撞墙也触发落地
                if (!g.landed) {
                    g.landed = true;
                    g.landTimer = GRENADE.LAND_FUSE;
                    g.velocity.set(0, 0, 0);
                    continue;
                }
            }
        }
    }

    // 清理
    for (let i = grenades.length - 1; i >= 0; i--) {
        if (!grenades[i].alive) grenades.splice(i, 1);
    }

    // 更新爆炸特效
    for (let i = explosionEffects.length - 1; i >= 0; i--) {
        const fx = explosionEffects[i];
        fx.timer -= dt;
        const s = 1 + (0.3 - fx.timer) * 25;
        fx.mesh.scale.setScalar(Math.max(s, 0));
        fx.mesh.material.opacity = Math.max(fx.timer / 0.3, 0);
        if (fx.timer <= 0) {
            scene.remove(fx.mesh);
            fx.mesh.geometry.dispose();
            fx.mesh.material.dispose();
            explosionEffects.splice(i, 1);
        }
    }
}

export function getGrenadeCount() { return grenadeCount; }
export function addGrenade() { grenadeCount = Math.min(3, grenadeCount + 1); }
/** 重置手雷计数到最大值（每波开始时调用） */
export function resetGrenadeCount() { grenadeCount = GRENADE.MAX_COUNT; }

// ============================================================
// 内部函数
// ============================================================

function explode(g, scene, enemyPositions, onDamage, getNow) {
    // 爆炸闪光
    const flashGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({
        color: 0xff6600, transparent: true, opacity: 0.9,
        depthTest: false, depthWrite: false,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(g.position);
    scene.add(flash);
    explosionEffects.push({ mesh: flash, timer: 0.3 });

    playExplosion();

    // AoE伤害 — 用最新敌人位置（而非上帧缓存的）
    var targets = getFreshEnemyPositions ? getFreshEnemyPositions() : enemyPositions;
    targets = targets || [];
    console.log('[grenade] 爆炸! 位置:', g.position.x.toFixed(1), g.position.y.toFixed(1), g.position.z.toFixed(1), '敌人数:', targets.length);
    for (var i = 0; i < targets.length; i++) {
        var ep = targets[i];
        var dx = g.position.x - ep.position.x;
        var dy = g.position.y - ep.position.y;
        var dz = g.position.z - ep.position.z;
        var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist <= GRENADE.EXPLOSION_RADIUS) {
            var damage = Math.max(1, Math.round(GRENADE.MAX_DAMAGE * (1 - dist / GRENADE.EXPLOSION_RADIUS)));
            console.log('[grenade]  敌人', ep.enemyId, '距离', dist.toFixed(1), 'm →', damage, '伤害');
            onDamage(ep.enemyId, damage, false);
        }
    }

    // 清理手雷模型
    scene.remove(g.mesh);
    disposeMesh(g.mesh);
    g.alive = false;
}

// 由 weapon-models.js 中的 grenadeRoot 注入
var shareGrenadeRoot = null;
var shareGrenadeReady = false;
export function setGrenadeGLB(root, ready) { shareGrenadeRoot = root; shareGrenadeReady = ready; }

function buildGrenadeMesh() {
    if (shareGrenadeReady && shareGrenadeRoot) {
        var clone = shareGrenadeRoot.clone(true);
        // 投出后: 柄朝前（-Z），头朝后
        clone.rotation.set(-Math.PI / 2, 0, 0);
        return clone;
    }
    // fallback
    const group = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.3 });
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8), metalMat));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 }));
    ring.position.y = 0.06; ring.rotation.x = Math.PI / 2;
    group.add(ring);
    return group;
}

function disposeMesh(mesh) {
    mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
        }
    });
}

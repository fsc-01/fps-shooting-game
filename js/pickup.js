// ============================================================
// pickup.js — 拾取系统
// 弹药包（棕色） + 血包（白色红十字） + bob动画 + 拾取检测
// ============================================================

import * as THREE from 'three';
import { PICKUP } from './constants.js?v=700';

// --- 内部状态 ---
/** @type {Array<{ mesh: THREE.Mesh, type: 'ammo'|'health', collected: boolean, bobPhase: number, respawnTimer: number }>} */
const items = [];

// ============================================================
// 公开 API
// ============================================================

/**
 * 初始化所有拾取物
 * @param {THREE.Scene} scene
 * @param {number[][]} spawns — [[x, y, z], ...]
 */
export function initPickups(scene, spawns) {
    // 清除旧拾取物
    for (const item of items) {
        scene.remove(item.mesh);
        disposeItem(item);
    }
    items.length = 0;

    // 交替生成弹药包和血包
    for (let i = 0; i < spawns.length; i++) {
        const [x, y, z] = spawns[i];
        const type = i % 2 === 0 ? 'ammo' : 'health';
        const item = createPickup(scene, new THREE.Vector3(x, y, z), type);
        items.push(item);
    }

    console.log(`[pickup] ${items.length} 个拾取物生成完毕`);
}

/**
 * 每帧更新拾取物（bob动画 + 拾取检测）
 * @param {number} dt — 帧间隔
 * @param {THREE.Vector3} playerPos — 玩家位置
 * @param {number} playerRadius — 玩家碰撞半径
 * @param {(type: string) => void} onPickup — 拾取回调
 */
export function updatePickups(dt, playerPos, playerRadius, onPickup) {
    for (const item of items) {
        // --- 重生倒计时 ---
        if (item.collected) {
            item.respawnTimer -= dt;
            if (item.respawnTimer <= 0) {
                // 重生：重新显示
                item.collected = false;
                item.mesh.visible = true;
                item.bobPhase = Math.random() * Math.PI * 2; // 随机相位
                item.respawnTimer = 0;
            }
            continue;
        }

        // --- bob 浮动动画 ---
        item.bobPhase += dt * 2.5;
        item.mesh.position.y = item.mesh.userData.baseY + Math.sin(item.bobPhase) * 0.06;
        item.mesh.rotation.y += dt * 1.2; // 缓慢旋转

        // --- 拾取检测 ---
        const dx = playerPos.x - item.mesh.position.x;
        const dz = playerPos.z - item.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= PICKUP.RADIUS + playerRadius) {
            item.collected = true;
            item.mesh.visible = false;
            item.respawnTimer = PICKUP.RESPAWN_TIME;
            onPickup(item.type);
        }
    }
}

/**
 * 获取未拾取物品数量
 * @returns {number}
 */
export function getRemainingCount() {
    return items.filter(i => !i.collected).length;
}

// ============================================================
// 内部函数
// ============================================================

/**
 * 创建一个拾取物模型
 */
function createPickup(scene, position, type) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.userData.baseY = position.y;

    if (type === 'ammo') {
        // 弹药包：棕色盒子 + 浅色条纹
        const boxGeo = new THREE.BoxGeometry(0.3, 0.15, 0.3);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.6 });
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.castShadow = true;
        group.add(box);

        // 顶部浅色条纹
        const stripeGeo = new THREE.BoxGeometry(0.2, 0.04, 0.2);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd4b896, roughness: 0.5, emissive: 0x332200, emissiveIntensity: 0.3 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.y = 0.1;
        group.add(stripe);

    } else {
        // 血包：白色盒子 + 红十字
        const boxGeo = new THREE.BoxGeometry(0.3, 0.15, 0.3);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.castShadow = true;
        group.add(box);

        // 红十字（两个交叉的红色薄片）
        const redMat = new THREE.MeshStandardMaterial({ color: 0xff2222, roughness: 0.4, emissive: 0x440000, emissiveIntensity: 0.3 });
        const barH = new THREE.BoxGeometry(0.16, 0.03, 0.06);
        const barV = new THREE.BoxGeometry(0.06, 0.03, 0.16);
        const crossH = new THREE.Mesh(barH, redMat);
        const crossV = new THREE.Mesh(barV, redMat);
        crossH.position.y = 0.1;
        crossV.position.y = 0.1;
        group.add(crossH);
        group.add(crossV);
    }

    scene.add(group);

    return {
        mesh: group,
        type,
        collected: false,
        bobPhase: Math.random() * Math.PI * 2,
        respawnTimer: 0,
    };
}

/**
 * 清理拾取物资源
 */
function disposeItem(item) {
    item.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                child.material.dispose();
            }
        }
    });
}

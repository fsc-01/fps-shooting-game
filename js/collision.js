// ============================================================
// collision.js — 碰撞检测模块
// 玩家胶囊体 vs 场景 Box3 列表，分轴检测实现滑墙效果
// ============================================================

import { PLAYER } from './constants.js?v=700';

/**
 * 检测玩家与场景碰撞，分 X/Z 轴独立处理。
 * 分轴的好处：撞墙时身体会沿着墙滑动，不会卡死。
 *
 * @param {{ x: number, y: number, z: number, radius: number, height: number }} playerBody
 *        — 玩家当前位置和碰撞体参数
 * @param {THREE.Box3[]} colliders — 场景碰撞体列表
 * @returns {{ x: number, z: number }} 碰撞修正后的 X/Z 坐标
 */
export function resolveCollision(playerBody, colliders) {
    let { x, z } = playerBody;
    const { y, radius, height } = playerBody;

    // 胶囊体简化为圆柱：底部 (y - height/2) 到顶部 (y + height/2) + 上下半球
    const playerMinY = y - height / 2;
    const playerMaxY = y + height / 2;

    for (const box of colliders) {
        // 先检查 Y 轴是否重叠
        if (playerMaxY <= box.min.y || playerMinY >= box.max.y) continue;

        // 找到 XZ 平面上最近点
        const closestX = Math.max(box.min.x, Math.min(x, box.max.x));
        const closestZ = Math.max(box.min.z, Math.min(z, box.max.z));

        const dx = x - closestX;
        const dz = z - closestZ;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // 无碰撞
        if (dist >= radius) continue;
        // 玩家恰好在盒子内部（极少发生），推出去
        if (dist < 0.0001) {
            x = closestX + radius;
            continue;
        }

        const overlap = radius - dist;
        const nx = dx / dist; // 法线 X
        const nz = dz / dist; // 法线 Z

        // 分轴推离（让玩家沿墙滑动）
        x += nx * overlap;
        z += nz * overlap;
    }

    return { x, z };
}

/**
 * 检查玩家脚底是否着地。
 * 从玩家底部向下扫描，检测是否站在某个碰撞体上。
 *
 * @param {{ x: number, y: number, z: number }} position — 玩家位置
 * @param {THREE.Box3[]} colliders — 碰撞体列表
 * @param {number} footOffset — 脚底偏移（玩家中心到脚底距离）
 * @returns {{ grounded: boolean, groundY: number }}
 */
export function checkGrounded(position, colliders, footOffset) {
    const { x, y, z } = position;
    const footY = y - footOffset;
    const groundCheck = 0.05; // 着地容差

    // 如果已经在 Y=0 以下，直接着地
    if (footY <= 0) {
        return { grounded: true, groundY: 0 };
    }

    for (const box of colliders) {
        // 水平范围检查
        if (x < box.min.x || x > box.max.x) continue;
        if (z < box.min.z || z > box.max.z) continue;
        // 脚在盒子上方且非常接近
        if (footY >= box.max.y && footY <= box.max.y + groundCheck) {
            return { grounded: true, groundY: box.max.y };
        }
    }

    // 地面着地
    if (footY <= groundCheck) {
        return { grounded: true, groundY: 0 };
    }

    return { grounded: false, groundY: null };
}

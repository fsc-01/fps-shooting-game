// ============================================================
// player.js — 玩家控制模块
// 第一人称相机、WASD移动 + Shift奔跑 + 双击W奔跑、空格跳跃 + 重力
// 第五批新增：死亡状态（isDead / getIsDead / respawnPlayer）
// ============================================================

import * as THREE from 'three';
import { PLAYER, KEYS } from './constants.js?v=700';
import { isDown, isJust, getMouseX, getMouseY, isSprinting } from './input.js?v=700';
import { resolveCollision, checkGrounded } from './collision.js?v=700';

/** 欧拉旋转（弧度）：绕 X 轴俯仰，绕 Y 轴偏航 */
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
/** 速度向量 */
const velocity = new THREE.Vector3();

/** 玩家血量 */
let health = PLAYER.HEALTH;
/** 受伤无敌计时器 */
let invincibleTimer = 0;
/** 受伤闪红标志 */
let damageFlash = false;
/** 死亡标志 */
let isDead = false;

/**
 * 初始化玩家状态
 */
export function initPlayer(camera, spawnPoint) {
    camera.position.copy(spawnPoint);
    velocity.set(0, 0, 0);
    euler.set(0, Math.PI, 0);
    health = PLAYER.HEALTH;
    invincibleTimer = 0;
    damageFlash = false;
    isDead = false;
    return {
        body: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            radius: PLAYER.RADIUS,
            height: PLAYER.HEIGHT,
        },
    };
}

/**
 * 每帧更新玩家状态
 * @returns {{ body: object, isMoving: boolean, isJumping: boolean, health: number }}
 */
export function updatePlayer(camera, colliders, dt) {
    // 受伤无敌计时器
    if (invincibleTimer > 0) {
        invincibleTimer -= dt;
        if (invincibleTimer <= 0) damageFlash = false;
    }

    // --- 鼠标视角旋转 ---
    const mx = getMouseX() * PLAYER.MOUSE_SENSITIVITY;
    const my = getMouseY() * PLAYER.MOUSE_SENSITIVITY;

    euler.setFromQuaternion(camera.quaternion, 'YXZ');
    euler.y -= mx;
    euler.x -= my;
    euler.x = Math.max(PLAYER.PITCH_MIN, Math.min(PLAYER.PITCH_MAX, euler.x));
    camera.quaternion.setFromEuler(euler);

    // --- 移动方向 ---
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0; forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0; right.normalize();

    const isRunning = isDown(KEYS.RUN) || isSprinting();
    const speed = isRunning ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED;

    const moveDir = new THREE.Vector3();
    if (isDown(KEYS.FORWARD))  moveDir.add(forward);
    if (isDown(KEYS.BACKWARD)) moveDir.sub(forward);
    if (isDown(KEYS.LEFT))     moveDir.sub(right);
    if (isDown(KEYS.RIGHT))    moveDir.add(right);

    const isMoving = moveDir.lengthSq() > 0;
    if (isMoving) moveDir.normalize();

    // --- 重力与跳跃 ---
    const pos = camera.position;
    const footOffset = PLAYER.HEIGHT / 2;
    const { grounded, groundY } = checkGrounded(
        { x: pos.x, y: pos.y, z: pos.z }, colliders, footOffset);

    let isJumping = false;
    if (grounded) {
        velocity.y = 0;
        pos.y = groundY + footOffset;
        if (isJust(KEYS.JUMP)) {
            velocity.y = PLAYER.JUMP_VELOCITY;
        }
    } else {
        velocity.y -= PLAYER.GRAVITY * dt;
        isJumping = true;
    }

    // --- 应用位移 ---
    const displacement = moveDir.clone().multiplyScalar(speed * dt);
    displacement.y = velocity.y * dt;
    pos.x += displacement.x;
    pos.y += displacement.y;
    pos.z += displacement.z;

    // --- 碰撞处理 ---
    const playerBody = {
        x: pos.x, y: pos.y, z: pos.z,
        radius: PLAYER.RADIUS, height: PLAYER.HEIGHT,
    };
    const resolved = resolveCollision(playerBody, colliders);
    pos.x = resolved.x;
    pos.z = resolved.z;

    return { body: playerBody, isMoving, isJumping, isRunning, health, grounded };
}

/**
 * 玩家受到伤害
 * @param {number} amount — 伤害值
 * @returns {number} 剩余血量
 */
export function takeDamage(amount) {
    if (invincibleTimer > 0 || isDead) return health;
    health = Math.max(0, health - amount);
    invincibleTimer = PLAYER.INVINCIBLE_TIME;
    damageFlash = true;
    if (health <= 0) isDead = true;
    return health;
}

/** 获取当前血量 */
export function getHealth() { return health; }

/** 获取死亡状态 */
export function getIsDead() { return isDead; }

/** 获取受伤闪红状态（每帧读取后需手动重置） */
export function getDamageFlash() {
    const v = damageFlash;
    damageFlash = false;
    return v;
}

/**
 * 治疗玩家（拾取血包等）
 * @param {number} amount — 恢复量
 * @returns {number} 当前血量
 */
export function healPlayer(amount) {
    health = Math.min(PLAYER.HEALTH, health + amount);
    return health;
}

/**
 * 仅重置玩家位置和速度（波次过渡时使用，不改变血量/死亡状态）
 */
export function resetPlayerPosition(camera, spawnPoint) {
    camera.position.copy(spawnPoint);
    velocity.set(0, 0, 0);
}

/**
 * 重生玩家（死亡后重新开始 — 不重置武器弹药）
 * @param {THREE.Camera} camera
 * @param {THREE.Vector3} spawnPoint
 */
export function respawnPlayer(camera, spawnPoint) {
    camera.position.copy(spawnPoint);
    velocity.set(0, 0, 0);
    euler.set(0, Math.PI, 0);
    health = PLAYER.HEALTH;
    invincibleTimer = 0;
    damageFlash = false;
    isDead = false;
}

/** 获取当前视角 */
export function getRotation() {
    return euler.clone();
}

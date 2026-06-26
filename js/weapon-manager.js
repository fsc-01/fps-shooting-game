// ============================================================
// weapon-manager.js — 多武器状态机
// 管理3把武器切换、独立弹药/散布/换弹状态、近战攻击、枪口火焰、弹孔池
// ============================================================

import * as THREE from 'three';
import { WEAPON, WEAPON_SWITCH, MELEE, COLORS, KEYS, GRENADE as GRENADE_CFG } from './constants.js?v=700';
import { isFireJust, isJust, isFireHeld, releaseFire } from './input.js?v=700';
import { playGunshot, playReloadStage, playKnifeSwing, playGrenadePin } from './audio.js?v=700';
import { buildAK47Model, buildUSPModel, buildKnifeModel, buildHandGrenadeModel, setModelReadyCallback } from './weapon-models.js?v=708';
import { throwGrenade, getGrenadeCount } from './grenade.js?v=700';

// ============================================================
// 武器配置（不可变数据）
// ============================================================

const KNIFE_CONFIG = {
    id: 'knife', name: '匕首', slot: 0, category: 'melee',
    damage: MELEE.DAMAGE, fireRate: 1.5, magSize: 1, reserve: 0,
    tacticalReload: 0, emptyReload: 0, maxReserve: 0, headshotMultiplier: 1,
    offset: new THREE.Vector3(0.28, -0.28, -0.35), scale: 1.3,
    swayAmount: 0.002, screenShakeIntensity: 0.004,
};

const USP_CONFIG = {
    id: 'usp', name: 'USP手枪', slot: 1, category: 'pistol',
    damage: 25, fireRate: 6.7, magSize: 12, reserve: 36,
    tacticalReload: 0.9, emptyReload: 1.0, maxReserve: 72, headshotMultiplier: 5,
    offset: new THREE.Vector3(0.28, -0.28, -0.42), scale: 1.3,
    swayAmount: 0.0025, screenShakeIntensity: 0.008,
    spread1: 0.004, spread2: 0.010, spread3: 0.020, spreadRecovery: 0.35,
    maxRange: 200, recoilPerShot: 1.0,
};

const AK47_CONFIG = {
    id: 'ak47', name: 'AK47', slot: 2, category: 'rifle',
    damage: WEAPON.DAMAGE, fireRate: WEAPON.FIRE_RATE, magSize: WEAPON.MAG_SIZE,
    reserve: WEAPON.RESERVE_AMMO, tacticalReload: WEAPON.TACTICAL_RELOAD,
    emptyReload: WEAPON.EMPTY_RELOAD, maxReserve: WEAPON.MAX_RESERVE,
    headshotMultiplier: WEAPON.HEADSHOT_MULTIPLIER,
    offset: new THREE.Vector3(0.35, -0.28, -0.55), scale: 1.15,
    swayAmount: WEAPON.SWAY_AMOUNT, screenShakeIntensity: WEAPON.SCREEN_SHAKE_INTENSITY,
    spread1: WEAPON.SPREAD_1, spread2: WEAPON.SPREAD_2, spread3: WEAPON.SPREAD_3,
    spreadRecovery: WEAPON.SPREAD_RECOVERY, maxRange: WEAPON.MAX_RANGE,
    recoilPerShot: 1.5,
};

const GRENADE_CONFIG = {
    id: 'grenade', name: '手雷', slot: 3, category: 'grenade',
    damage: GRENADE_CFG.MAX_DAMAGE, fireRate: 0.5, magSize: 1, reserve: 0,
    tacticalReload: 0, emptyReload: 0, maxReserve: 0, headshotMultiplier: 1,
    offset: new THREE.Vector3(0.25, -0.19, -0.35), scale: 0.7,
    swayAmount: 0.001, screenShakeIntensity: 0.002,
};

const ALL_CONFIGS = [KNIFE_CONFIG, USP_CONFIG, AK47_CONFIG, GRENADE_CONFIG];

// ============================================================
// 模块内部状态
// ============================================================

const raycaster = new THREE.Raycaster();

/** @type {Array<{ config: object, currentAmmo: number, reserveAmmo: number,
      fireTimer: number, reloadTimer: number, shotCount: number, spreadRecovery: number }>} */
let weaponStates = [];
let currentSlot = 2; // 默认 AK47

let switchTimer = 0;
let isSwitching = false;
let switchingTargetSlot = -1;
let switchingModelSwapped = false;
let switchYOffset = 0;

let meleeAnimTimer = 0;
// 近战动画三段式：前摇(80ms) → 爆发(100ms) → 后摇(170ms)，总长0.35s
const MELEE_WINDUP  = 0.080;
const MELEE_STRIKE  = 0.100;
const MELEE_RECOVER = 0.170;
const MELEE_TOTAL   = MELEE_WINDUP + MELEE_STRIKE + MELEE_RECOVER; // 0.35
// 爆发阶段目标值 — CS:GO 风格右上→左下斜向斩击
const CHOP_ROTX  = -65 * Math.PI / 180;  // rotation.x: 向下猛砍 65°
const CHOP_ROTZ  =  20 * Math.PI / 180;  // rotation.z: 刀锋倾斜 20°
const PULL_Z     = -0.15;   // 蓄力后拉 15cm
const THRUST_Z   =  0.25;   // 刺出前推 25cm
const PRESS_Y    = -0.10;   // 下压 10cm
const WINDUP_X   =  0.06;   // 前摇右摆 6cm（起手右上角）
const STRIKE_X   = -0.18;   // 爆发左划 18cm（砍向左下角）
// 简易缓动（无外部依赖）
function easeInCubic(t)  { return t * t * t; }
function easeOutQuart(t) { const u = 1 - t; return 1 - u * u * u * u; }
function easeOutCubic(t) { const u = 1 - t; return 1 - u * u * u; }

let recoilOffset = 0;
let swayX = 0, swayY = 0;
let shakeIntensity = 0;
let gunGroup;
let muzzleFlash;
const bulletHoles = [];
const MAX_HOLES = 100;
let lastReloadStage = '';

// ============================================================
// 公开 API（与原 weapon.js 兼容）
// ============================================================

export function initWeaponManager(scene, camera) {
    // 初始化每把武器状态
    weaponStates = ALL_CONFIGS.map(function(cfg) { return {
        config: cfg,
        currentAmmo: cfg.magSize,
        reserveAmmo: cfg.reserve,
        fireTimer: 0,
        reloadTimer: 0,
        shotCount: 0,
        spreadRecovery: 0,
    }; });

    currentSlot = 2;
    switchTimer = 0;
    isSwitching = false;
    switchYOffset = 0;
    meleeAnimTimer = 0;
    recoilOffset = 0;
    shakeIntensity = 0;
    lastReloadStage = '';

    // 先创建枪口火焰（swapModel 里会用到）
    var flashTex = createFlashTexture();
    var flashMat = new THREE.SpriteMaterial({
        map: flashTex, blending: THREE.AdditiveBlending,
        depthTest: false, depthWrite: false,
    });
    muzzleFlash = new THREE.Sprite(flashMat);
    muzzleFlash.scale.set(0.5, 0.5, 1);
    muzzleFlash.visible = false;

    // 再创建枪模
    gunGroup = new THREE.Group();
    swapModel(currentSlot);
    applyFirstPersonRendering(gunGroup);
    scene.add(gunGroup);

    // 异步模型加载完成后自动刷新（OBJ/GLB 加载比 init 慢）
    setModelReadyCallback(function (slot) {
        if (slot === currentSlot && gunGroup) {
            console.log('[weapon-manager] 模型就绪, 刷新当前武器 slot=' + slot);
            swapModel(slot);
            applyFirstPersonRendering(gunGroup);
        }
    });

    console.log('[weapon-manager] 3武器初始化完成 (AK47默认)');
    return getAmmoStatus();
}

export function updateWeaponManager(scene, camera, colliders, dt, enemyTargets = null) {
    let hitConfirmed = false;
    let isFiring = false;
    let enemyHit = null;
    let isReloading = false;

    // --- 武器切换输入 ---
    if (isJust(KEYS.WEAPON_1) && currentSlot !== 0 && !isSwitching) startSwitch(0);
    if (isJust(KEYS.WEAPON_2) && currentSlot !== 1 && !isSwitching) startSwitch(1);
    if (isJust(KEYS.WEAPON_3) && currentSlot !== 2 && !isSwitching) startSwitch(2);
    if (isJust(KEYS.GRENADE) && currentSlot !== 3 && !isSwitching && getGrenadeCount() > 0) startSwitch(3);

    // --- 切换动画 ---
    if (isSwitching) {
        updateSwitchAnimation(dt);
        updateGunPosition(camera);
        updateSway(dt);
        return { hitConfirmed: false, isFiring: false, isReloading: false, enemyHit: null, isSwitching: true };
    }

    const cfg = getCurrentConfig();
    const state = getCurrentState();

    // --- 近战挥刀动画 ---
    if (meleeAnimTimer > 0) {
        meleeAnimTimer -= dt;
        updateMeleeAnimation();
        updateGunPosition(camera);
        updateSway(dt);
        return { hitConfirmed: false, isFiring: false, isReloading: false, enemyHit: null, isSwitching: false };
    }

    // --- 散布恢复 ---
    if (cfg.category !== 'melee' && state.fireTimer <= 0 && state.shotCount > 0) {
        state.spreadRecovery += dt;
        if (state.spreadRecovery > (cfg.spreadRecovery || 0.3)) {
            state.shotCount = 0;
            state.spreadRecovery = 0;
        }
    }

    // --- 换弹中 ---
    if (state.reloadTimer > 0) {
        state.reloadTimer -= dt;
        const stage = getReloadStage(cfg, state);
        if (stage !== lastReloadStage && stage !== '') {
            playReloadStage(stage);
            lastReloadStage = stage;
        }
        if (state.reloadTimer <= 0) {
            const needed = cfg.magSize - state.currentAmmo;
            const available = Math.min(needed, state.reserveAmmo);
            state.currentAmmo += available;
            state.reserveAmmo -= available;
            state.reloadTimer = 0;
            lastReloadStage = '';
            state.shotCount = 0;
        }
        isReloading = true;
        updateGunPosition(camera);
        updateSway(dt);
        return { hitConfirmed, isFiring, isReloading, enemyHit: null, isSwitching: false };
    }

    // R键换弹
    if (cfg.category !== 'melee' && isJust(KEYS.RELOAD) && state.currentAmmo < cfg.magSize && state.reserveAmmo > 0) {
        state.reloadTimer = (state.currentAmmo === 0) ? cfg.emptyReload : cfg.tacticalReload;
        lastReloadStage = '';
        updateGunPosition(camera);
        updateSway(dt);
        return { hitConfirmed, isFiring, isReloading: false, enemyHit: null, isSwitching: false };
    }

    // 空仓自动换弹
    if (cfg.category !== 'melee' && state.currentAmmo === 0 && state.fireTimer <= 0 && state.reserveAmmo > 0) {
        state.reloadTimer = cfg.emptyReload;
        lastReloadStage = '';
        updateGunPosition(camera);
        updateSway(dt);
        return { hitConfirmed, isFiring, isReloading: false, enemyHit: null, isSwitching: false };
    }

    // --- 后座恢复 ---
    recoilOffset = Math.max(0, recoilOffset - 30 * dt);

    // --- 射击计时器 ---
    if (state.fireTimer > 0) state.fireTimer -= dt;

    // --- 开火 / 近战 / 投掷手雷 ---
    // 枪械：按住连射（fireHeld + fireTimer<=0）; 匕首/手雷：点射（fireJust）
    var wantFire = false;
    if (cfg.category === 'rifle' || cfg.category === 'pistol') {
        wantFire = (isFireJust() || isFireHeld());
    } else {
        wantFire = isFireJust();
    }

    if (wantFire && state.fireTimer <= 0) {
        if (cfg.category === 'grenade') {
            // 手雷投掷
            if (getGrenadeCount() > 0) {
                throwGrenade(camera, scene);
                playGrenadePin();
                state.fireTimer = 1 / cfg.fireRate;
                // 投完后若没有手雷了，自动切回AK47
                if (getGrenadeCount() <= 0) {
                    startSwitch(2);
                } else {
                    // 还有手雷，保持手雷状态（可以连投）
                    updateGunPosition(camera);
                    updateSway(dt);
                    return { hitConfirmed: false, isFiring: true, isReloading: false, enemyHit: null, isSwitching: false };
                }
                updateGunPosition(camera);
                updateSway(dt);
                return { hitConfirmed: false, isFiring: true, isReloading: false, enemyHit: null, isSwitching: false };
            }
        } else if (cfg.category === 'melee') {
            // 匕首攻击
            isFiring = true;
            meleeAnimTimer = MELEE.ANIM_DURATION;
            playKnifeSwing();
            const result = meleeAttack(camera, enemyTargets);
            hitConfirmed = result.hitConfirmed;
            enemyHit = result.enemyHit;
            state.fireTimer = 1 / cfg.fireRate;
        } else if (state.currentAmmo > 0) {
            // 枪械射击
            isFiring = true;
            const result = fireRanged(cfg, state, scene, camera, colliders, enemyTargets);
            hitConfirmed = result.hitConfirmed;
            enemyHit = result.enemyHit;
            playGunshot();
        }
    }

    // --- 震动衰减 ---
    shakeIntensity = Math.max(0, shakeIntensity - 12 * dt);

    // --- 枪模跟随 ---
    updateGunPosition(camera);
    updateSway(dt);

    return { hitConfirmed, isFiring, isReloading, enemyHit, isSwitching: false };
}

export function getAmmoStatus() {
    const state = getCurrentState();
    return {
        currentAmmo: state.currentAmmo,
        reserveAmmo: state.reserveAmmo,
        reloadTimer: state.reloadTimer,
    };
}

export function getScreenShakeOffset() {
    if (shakeIntensity < 0.0001) return { x: 0, y: 0 };
    return {
        x: (Math.random() - 0.5) * shakeIntensity * 2,
        y: (Math.random() - 0.5) * shakeIntensity * 2,
    };
}

export function addReserveAmmo(amount) {
    const state = getCurrentState();
    state.reserveAmmo = Math.min(getCurrentConfig().maxReserve, state.reserveAmmo + amount);
    return state.reserveAmmo;
}

export function getCurrentWeaponName() { return getCurrentConfig().name; }
export function getCurrentSlot() { return currentSlot; }
export function isCurrentWeaponKnife() { return getCurrentConfig().category === 'melee'; }

// ============================================================
// 武器切换
// ============================================================

function startSwitch(newSlot) {
    if (!isSwitching && currentSlot === newSlot) return;
    switchingTargetSlot = newSlot;
    switchingModelSwapped = false;
    // 如果不在切枪中，启动完整动画；如果在切枪中，回退到下降阶段
    if (!isSwitching) {
        switchTimer = WEAPON_SWITCH.LOWER_TIME + WEAPON_SWITCH.RAISE_TIME;
    } else {
        switchTimer = Math.min(switchTimer, WEAPON_SWITCH.LOWER_TIME);
    }
    isSwitching = true;
    releaseFire();
}

function updateSwitchAnimation(dt) {
    switchTimer -= dt;
    const halfTime = WEAPON_SWITCH.LOWER_TIME;
    const elapsed = (WEAPON_SWITCH.LOWER_TIME + WEAPON_SWITCH.RAISE_TIME) - switchTimer;

    if (elapsed < halfTime) {
        switchYOffset = WEAPON_SWITCH.LOWER_Y_OFFSET * (elapsed / halfTime);
    } else {
        if (!switchingModelSwapped) {
            swapModel(switchingTargetSlot);
            currentSlot = switchingTargetSlot;
            switchingModelSwapped = true;
        }
        const raiseP = (elapsed - halfTime) / WEAPON_SWITCH.RAISE_TIME;
        switchYOffset = WEAPON_SWITCH.LOWER_Y_OFFSET * (1 - raiseP);
    }

    if (switchTimer <= 0) {
        switchYOffset = 0;
        isSwitching = false;
        switchTimer = 0;
    }
}

function swapModel(slot) {
    while (gunGroup.children.length > 0) gunGroup.remove(gunGroup.children[0]);

    let model;
    if (slot === 0) model = buildKnifeModel();
    else if (slot === 1) model = buildUSPModel();
    else if (slot === 3) model = buildHandGrenadeModel();
    else model = buildAK47Model();

    gunGroup.add(model);
    const cfg = ALL_CONFIGS[slot];
    gunGroup.scale.set(cfg.scale, cfg.scale, cfg.scale);
    applyFirstPersonRendering(gunGroup);

    // 枪口火焰（仅枪械和手雷）
    if (cfg.category === 'rifle' || cfg.category === 'pistol') gunGroup.add(muzzleFlash);
}

// ============================================================
// 枪模跟随相机
// ============================================================

function updateGunPosition(camera) {
    if (!gunGroup) return;

    const worldPos = camera.position.clone();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

    const cfg = getCurrentConfig();
    const offset = cfg.offset;

    // 换弹动画Y偏移
    let reloadYOffset = 0;
    const state = getCurrentState();
    if (state.reloadTimer > 0) {
        const total = (state.currentAmmo === 0) ? cfg.emptyReload : cfg.tacticalReload;
        const elapsed = total - state.reloadTimer;
        const p = elapsed / total;
        if (p < 0.3)       reloadYOffset = -0.15 * (p / 0.3);
        else if (p < 0.55) reloadYOffset = -0.15;
        else               reloadYOffset = -0.15 * (1 - (p - 0.55) / 0.45);
    }

    // ── 近战动画三段式：计算本帧偏移（旋转+位移同步，形成斜向弧线）──
    let meleeRotX = 0, meleeRotZ = 0, meleeOffZ = 0, meleeOffY = 0, meleeOffX = 0;
    if (meleeAnimTimer > 0) {
        const elapsed = MELEE_TOTAL - meleeAnimTimer;
        if (elapsed < MELEE_WINDUP) {
            // ■ 前摇 0–80ms：缓慢蓄力，刀向右上角抬起
            const pe = elapsed / MELEE_WINDUP;
            const t  = easeInCubic(pe);
            meleeRotX = CHOP_ROTX * 0.1 * t;
            meleeRotZ = CHOP_ROTZ * 0.15 * t;
            meleeOffZ = PULL_Z * t;
            meleeOffX = WINDUP_X * t;          // 向右摆 → 起手右上角
        } else if (elapsed < MELEE_WINDUP + MELEE_STRIKE) {
            // ■ 爆发 80–180ms：极快斜向砍下，刀划向左下角
            const pe = (elapsed - MELEE_WINDUP) / MELEE_STRIKE;
            const t  = easeOutQuart(pe);
            meleeRotX = CHOP_ROTX * t;                              // 下砍
            meleeRotZ = CHOP_ROTZ * t;                              // 刀锋倾斜
            meleeOffZ = PULL_Z + (THRUST_Z - PULL_Z) * t;          // 前刺
            meleeOffY = PRESS_Y * t;                                // 下压
            meleeOffX = WINDUP_X + (STRIKE_X - WINDUP_X) * t;      // 右→左横扫
        } else if (elapsed < MELEE_TOTAL) {
            // ■ 后摇 180–350ms：缓慢回正，回到中心
            const pe = (elapsed - MELEE_WINDUP - MELEE_STRIKE) / MELEE_RECOVER;
            const t  = easeOutCubic(pe);
            meleeRotX = CHOP_ROTX * (1 - t);
            meleeRotZ = CHOP_ROTZ * (1 - t);
            meleeOffZ = THRUST_Z * (1 - t);
            meleeOffY = PRESS_Y * (1 - t);
            meleeOffX = STRIKE_X * (1 - t);                         // 从左回中
        }
    }

    worldPos.addScaledVector(right, offset.x + swayX + meleeOffX);
    worldPos.addScaledVector(up, offset.y + swayY + reloadYOffset + switchYOffset + meleeOffY);
    worldPos.addScaledVector(forward, -offset.z + meleeOffZ);

    gunGroup.position.copy(worldPos);
    gunGroup.quaternion.copy(camera.quaternion);

    // 近战旋转（X下砍 + Z倾斜，同步作用形成斜向弧线）
    if (Math.abs(meleeRotX) > 0.0001 || Math.abs(meleeRotZ) > 0.0001) {
        gunGroup.rotateX(meleeRotX);
        gunGroup.rotateZ(meleeRotZ);
    }

    // 后座
    gunGroup.rotateX(-recoilOffset * (Math.PI / 180) * 0.3);
}

// ============================================================
// 散布
// ============================================================

function getCurrentSpread(cfg, state) {
    if (cfg.category === 'melee' || !cfg.spread1) return 0;
    if (state.shotCount <= 3)       return cfg.spread1;
    else if (state.shotCount <= 10) return cfg.spread2;
    else                            return cfg.spread3;
}

function getReloadStage(cfg, state) {
    if (state.reloadTimer <= 0) return '';
    const total = (state.currentAmmo === 0) ? cfg.emptyReload : cfg.tacticalReload;
    const elapsed = total - state.reloadTimer;
    const p = elapsed / total;
    if (p < 0.05) return 'magOut';
    if (p > 0.50 && p < 0.55) return 'magIn';
    if (p > 0.85 && p < 0.90) return 'boltSlide';
    return '';
}

// ============================================================
// 射击
// ============================================================

function fireRanged(cfg, state, scene, camera, colliders, enemyTargets) {
    state.currentAmmo--;
    state.fireTimer = 1 / cfg.fireRate;
    recoilOffset += cfg.recoilPerShot;
    state.shotCount++;
    state.spreadRecovery = 0;
    shakeIntensity = cfg.screenShakeIntensity;

    const spread = getCurrentSpread(cfg, state);
    const spreadX = (Math.random() - 0.5) * spread * 2;
    const spreadY = (Math.random() - 0.5) * spread * 2;

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    dir.x += spreadX;
    dir.y += spreadY - (recoilOffset * 0.001);
    dir.normalize();

    const origin = camera.getWorldPosition(new THREE.Vector3());
    raycaster.set(origin, dir);

    let bestDist = Infinity;
    let bestPoint = null;
    let bestBox = null;
    let bestEnemyId = null;
    let bestIsHeadshot = false;

    // 地图碰撞体
    for (const box of colliders) {
        const pt = new THREE.Vector3();
        if (raycaster.ray.intersectBox(box, pt)) {
            const dist = origin.distanceTo(pt);
            if (dist < bestDist && dist <= (cfg.maxRange || 200)) {
                bestDist = dist; bestPoint = pt.clone(); bestBox = box;
                bestEnemyId = null; bestIsHeadshot = false;
            }
        }
    }

    // 敌人 hitbox
    if (enemyTargets && enemyTargets.colliders) {
        for (const box of enemyTargets.colliders) {
            const pt = new THREE.Vector3();
            if (raycaster.ray.intersectBox(box, pt)) {
                const dist = origin.distanceTo(pt);
                if (dist < bestDist && dist <= (cfg.maxRange || 200)) {
                    bestDist = dist; bestPoint = pt.clone(); bestBox = null;
                    if (enemyTargets.headMap && enemyTargets.headMap.has(box)) {
                        bestEnemyId = enemyTargets.headMap.get(box);
                        bestIsHeadshot = true;
                    } else if (enemyTargets.bodyMap && enemyTargets.bodyMap.has(box)) {
                        bestEnemyId = enemyTargets.bodyMap.get(box);
                        bestIsHeadshot = false;
                    }
                }
            }
        }
    }

    if (bestPoint && bestBox) {
        spawnBulletHole(scene, bestPoint, bestBox);
    }

    return {
        hitConfirmed: bestPoint !== null,
        enemyHit: bestEnemyId !== null ? { enemyId: bestEnemyId, isHeadshot: bestIsHeadshot } : null,
    };
}

// ============================================================
// 近战攻击
// ============================================================

function meleeAttack(camera, enemyTargets) {
    const origin = camera.getWorldPosition(new THREE.Vector3());
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

    let closestDist = Infinity;
    let closestEnemyId = null;
    let closestIsHeadshot = false;

    if (!enemyTargets || !enemyTargets.colliders) return { hitConfirmed: false, enemyHit: null };

    for (const box of enemyTargets.colliders) {
        const center = new THREE.Vector3();
        box.getCenter(center);
        const dist = origin.distanceTo(center);

        if (dist <= MELEE.RANGE) {
            const toEnemy = center.clone().sub(origin).normalize();
            const dot = forward.dot(toEnemy);
            if (dot > 0.3 && dist < closestDist) {
                closestDist = dist;
                var isHead = enemyTargets.headMap && enemyTargets.headMap.has(box);
                closestIsHeadshot = isHead;
                if (isHead) {
                    closestEnemyId = enemyTargets.headMap.get(box);
                } else if (enemyTargets.bodyMap && enemyTargets.bodyMap.has(box)) {
                    closestEnemyId = enemyTargets.bodyMap.get(box);
                }
            }
        }
    }

    if (closestEnemyId !== null) {
        return { hitConfirmed: true, enemyHit: { enemyId: closestEnemyId, isHeadshot: closestIsHeadshot } };
    }
    return { hitConfirmed: false, enemyHit: null };
}

function updateMeleeAnimation() {
    // 近战动画全部内联在 updateGunPosition() 中（三段式：前摇→爆发→后摇）
}

// ============================================================
// 弹孔
// ============================================================

function spawnBulletHole(scene, point, box) {
    const geo = new THREE.CircleGeometry(0.1, 8);
    const mat = new THREE.MeshBasicMaterial({
        color: COLORS.BULLET_HOLE, side: THREE.DoubleSide, depthTest: true,
    });
    const hole = new THREE.Mesh(geo, mat);
    const normal = getBoxNormal(point, box);
    hole.position.copy(point).addScaledVector(normal, 0.05);
    hole.lookAt(hole.position.clone().add(normal));
    scene.add(hole);
    bulletHoles.push(hole);
    if (bulletHoles.length > MAX_HOLES) {
        const old = bulletHoles.shift();
        scene.remove(old);
        old.geometry.dispose();
        old.material.dispose();
    }
}

function getBoxNormal(point, box) {
    const dxMin = Math.abs(point.x - box.min.x);
    const dxMax = Math.abs(point.x - box.max.x);
    const dzMin = Math.abs(point.z - box.min.z);
    const dzMax = Math.abs(point.z - box.max.z);
    const dyMin = Math.abs(point.y - box.min.y);
    const dyMax = Math.abs(point.y - box.max.y);
    const min = Math.min(dxMin, dxMax, dzMin, dzMax, dyMin, dyMax);
    if (min === dxMin) return new THREE.Vector3(-1, 0, 0);
    if (min === dxMax) return new THREE.Vector3(1, 0, 0);
    if (min === dzMin) return new THREE.Vector3(0, 0, -1);
    if (min === dzMax) return new THREE.Vector3(0, 0, 1);
    if (min === dyMin) return new THREE.Vector3(0, -1, 0);
    return new THREE.Vector3(0, 1, 0);
}

// ============================================================
// 枪模晃动 + 火焰纹理 + 第一人称渲染
// ============================================================

function updateSway(dt) {
    const cfg = getCurrentConfig();
    const t = performance.now() / 1000;
    const amount = cfg.swayAmount;
    const targetX = Math.sin(t * 2.5) * amount;
    const targetY = Math.cos(t * 1.8) * amount * 0.7;
    swayX += (targetX - swayX) * 10 * dt;
    swayY += (targetY - swayY) * 10 * dt;
}

function createFlashTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,200,1)');
    g.addColorStop(0.2, 'rgba(255,180,50,0.9)');
    g.addColorStop(0.5, 'rgba(255,100,20,0.5)');
    g.addColorStop(0.8, 'rgba(255,50,0,0.1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

function applyFirstPersonRendering(group) {
    group.renderOrder = 999;
    group.traverse(child => {
        if (child.isMesh) {
            child.renderOrder = 999;
            child.material.depthTest = false;
            child.material.depthWrite = false;
        }
    });
}

// ============================================================
// 辅助
// ============================================================

function getCurrentConfig() { return ALL_CONFIGS[currentSlot]; }
function getCurrentState() { return weaponStates[currentSlot]; }

/**
 * 重置所有武器状态（死亡后重生时调用）
 */
export function resetWeaponManager(scene, camera) {
    for (var i = 0; i < weaponStates.length; i++) {
        var s = weaponStates[i];
        var cfg = ALL_CONFIGS[i];
        s.currentAmmo = cfg.magSize;
        s.reserveAmmo = cfg.reserve;
        s.fireTimer = 0;
        s.reloadTimer = 0;
        s.shotCount = 0;
        s.spreadRecovery = 0;
    }
    currentSlot = 2;
    switchTimer = 0;
    isSwitching = false;
    switchYOffset = 0;
    meleeAnimTimer = 0;
    recoilOffset = 0;
    shakeIntensity = 0;
    lastReloadStage = '';
    swapModel(currentSlot);
    updateGunPosition(camera);
}

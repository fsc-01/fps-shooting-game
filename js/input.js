// ============================================================
// input.js — 键盘鼠标输入管理器
// 第五批：C键设置面板 / V键开镜
// ============================================================

import { KEYS, PLAYER } from './constants.js?v=700';

/** 当前帧按键按下状态 */
const keyDown = {};
/** 本帧刚按下的键（只持续一帧） */
const keyJust = {};
/** 鼠标 X/Y 累积增量（每帧读取后清零） */
let mouseDX = 0;
let mouseDY = 0;
/** 左键是否刚按下（只持续一帧） */
let fireJust = false;
/** 左键是否按住（连续射击用） */
let fireHeld = false;

// --- 滚轮武器切换 ---
let weaponScroll = 0;

// --- 双击 W 奔跑 ---
let lastWPressTime = 0;
let lastWReleaseTime = 0;
let sprintDoubleTap = false;

// --- C键设置面板 ---
let settingsToggle = false;

// --- V键开镜 ---
let scopeHeld = false;

export function initInput(canvas) {
    // --- 键盘 ---
    window.addEventListener('keydown', (e) => {
        // C键 — 设置面板开关
        if (e.code === 'KeyC') {
            settingsToggle = true;
            return;
        }

        // V键 — 开镜切换
        if (e.code === 'KeyV' && isLocked()) {
            e.preventDefault();
            scopeHeld = !scopeHeld;
            return;
        }

        // 避免输入框打字时触发游戏按键
        if (e.target !== document.body && e.target !== canvas) return;
        if (!keyDown[e.code]) keyJust[e.code] = true;
        keyDown[e.code] = true;

        // 双击W奔跑检测
        if (e.code === KEYS.FORWARD) {
            var now = performance.now() / 1000;
            if (now - lastWPressTime < KEYS.SPRINT_DOUBLETAP_TIME && lastWReleaseTime > lastWPressTime) {
                sprintDoubleTap = true;
            }
            lastWPressTime = now;
        }
    });

    window.addEventListener('keyup', (e) => {
        keyDown[e.code] = false;
        if (e.code === KEYS.FORWARD) {
            lastWReleaseTime = performance.now() / 1000;
            sprintDoubleTap = false;
        }
    });

    // --- 鼠标移动 ---
    document.addEventListener('mousemove', (e) => {
        if (!isLocked()) return;
        mouseDX += e.movementX;
        mouseDY += e.movementY;
    });

    // --- 滚轮 ---
    window.addEventListener('wheel', (e) => {
        if (!isLocked()) return;
        e.preventDefault();
        weaponScroll += e.deltaY > 0 ? -1 : 1;
    }, { passive: false });

    // --- 鼠标左键 ---
    document.addEventListener('mousedown', (e) => {
        if (!isLocked()) return;
        if (e.button === 0) { fireJust = true; fireHeld = true; }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button === 0) fireHeld = false;
    });

    // --- Pointer Lock 切换 ---
    document.addEventListener('pointerlockchange', () => {
        var blocker = document.getElementById('blocker');
        if (isLocked()) {
            if (blocker) blocker.style.display = 'none';
        } else {
            if (blocker) blocker.style.display = 'flex';
            fireHeld = false;
        }
    });
}

/** Pointer Lock 是否激活 */
export function isLocked() {
    return document.pointerLockElement != null;
}

/** 请求锁定鼠标 */
export function requestLock() {
    document.body.requestPointerLock();
}

// --- 状态查询 ---
export function isDown(code) { return keyDown[code] === true; }
export function isJust(code) { return keyJust[code] === true; }
export function getMouseX() { var v = mouseDX; mouseDX = 0; return v; }
export function getMouseY() { var v = mouseDY; mouseDY = 0; return v; }
export function isFireJust() { var v = fireJust; fireJust = false; return v; }
export function isFireHeld() { return fireHeld; }
export function releaseFire() { fireHeld = false; fireJust = false; }
export function isSprinting() { return sprintDoubleTap && isDown(KEYS.FORWARD); }
export function getWeaponScroll() { var v = weaponScroll; weaponScroll = 0; return v; }
export function forceKeyJust(code) { keyJust[code] = true; }

/** C键是否刚按下（设置面板开关） */
export function isSettingsToggle() { var v = settingsToggle; settingsToggle = false; return v; }

/** V键切换开镜状态 */
export function isScoping() { return scopeHeld; }

/** 强制取消开镜（死亡/重生/波次过渡时调用） */
export function resetScope() { scopeHeld = false; }

/**
 * 每帧末尾调用，清除单帧状态
 */
export function endFrame() {
    for (var k in keyJust) keyJust[k] = false;
    mouseDX = 0;
    mouseDY = 0;
    fireJust = false;
    settingsToggle = false;
}

// ============================================================
// hud.js — HUD 系统
// 动态准星（4线段CSS）、血量条、命中标记、受伤闪红
// 第三批新增：得分显示、伤害方向指示器、击杀信息
// 第四批新增：连杀卡片 / 击杀确认 / 武器名 / 手雷数
// 第五批新增：击杀计数 / 波次显示
// ============================================================

import { HUD, UI_IDS } from './constants.js?v=700';
import * as THREE from 'three';

/** 当前准星缩放 */
let crosshairScale = 1.0;
/** 准星颜色 */
let crosshairColor = '#ffffff';
/** 准星形状 */
let crosshairShape = 'cross';
/** 命中标记计时器 */
let hitMarkerTimer = 0;
/** DOM 缓存 */
let elHealthFill, elHitMarker, elDamageOverlay, elCrosshair, elChCircle;
let elLines = {};

// --- 第三批新增 DOM ---
let elScore, elDamageDir, elDamageArrow, elKillFeed;

// --- 第四批新增 DOM ---
let elKillStreakCard, elKillConfirm, elWeaponName, elGrenadeCount;

// --- 第五批新增 DOM ---
let elWaveDisplay, elWaveRemain, elWaveTransition;

/** 当前得分 */
let score = 0;
/** 击杀计数 */
let totalKills = 0;
/** 伤害方向指示器计时器 */
let damageDirTimer = 0;

/**
 * 初始化 HUD — 缓存所有 DOM 元素
 */
export function initHUD() {
    elCrosshair = document.getElementById(UI_IDS.CROSSHAIR);
    elHealthFill = document.getElementById(UI_IDS.HEALTH_FILL);
    elHitMarker = document.getElementById(UI_IDS.HIT_MARKER);
    elDamageOverlay = document.getElementById(UI_IDS.DAMAGE_OVERLAY);

    // 缓存准星元素
    elLines.top = document.getElementById('ch-top');
    elLines.bottom = document.getElementById('ch-bottom');
    elLines.left = document.getElementById('ch-left');
    elLines.right = document.getElementById('ch-right');
    elChCircle = document.getElementById('ch-circle');

    // 初始隐藏命中标记
    if (elHitMarker) elHitMarker.style.opacity = '0';

    // --- 第三批新增 DOM ---
    elScore = document.getElementById(UI_IDS.SCORE_DISPLAY);
    elDamageDir = document.getElementById(UI_IDS.DAMAGE_DIRECTION);
    elDamageArrow = document.getElementById('damage-arrow');
    elKillFeed = document.getElementById(UI_IDS.KILL_FEED);

    if (elDamageDir) elDamageDir.style.opacity = '0';

    // --- 第四批新增 DOM ---
    elKillStreakCard = document.getElementById(UI_IDS.KILL_STREAK_CARD);
    elKillConfirm = document.getElementById(UI_IDS.KILL_CONFIRM);
    elWeaponName = document.getElementById(UI_IDS.WEAPON_NAME);
    elGrenadeCount = document.getElementById(UI_IDS.GRENADE_COUNT);

    // --- 第五批新增 DOM ---
    elWaveDisplay = document.getElementById(UI_IDS.WAVE_DISPLAY);
    elWaveRemain = document.getElementById(UI_IDS.WAVE_REMAIN);
    elWaveTransition = document.getElementById(UI_IDS.WAVE_TRANSITION);
    if (elWaveTransition) elWaveTransition.style.opacity = '0';

    console.log('[hud] HUD 初始化完成（含第五批元素）');
}

/**
 * 每帧更新 HUD
 * @param {number} dt — 帧间隔
 * @param {{ health: number, ammo: number, reserve: number, reloadTimer: number,
 *            isMoving: boolean, isJumping: boolean, isFiring: boolean, hitConfirmed: boolean,
 *            wave: number, aliveCount: number, waveTransition: boolean }} state
 */
export function updateHUD(dt, state) {
    updateCrosshair(dt, state);
    updateHealthBar(state.health);
    updateHitMarker(dt, state.hitConfirmed);
    updateAmmo(state);
    updateScoreDisplay();
    updateDamageDirection(dt);
    updateWaveDisplay(state.wave, state.aliveCount, state.portalActive, state.victory, state.nextWave);
}

// ============================================================
// 动态准星
// ============================================================

function updateCrosshair(dt, state) {
    let targetScale = HUD.CROSSHAIR_STANDING;
    if (state.isFiring)       targetScale = HUD.CROSSHAIR_FIRING;
    else if (state.isJumping) targetScale = HUD.CROSSHAIR_JUMPING;
    else if (state.isMoving)  targetScale = HUD.CROSSHAIR_MOVING;

    crosshairScale += (targetScale - crosshairScale) * HUD.CROSSHAIR_RECOVERY * dt;

    // --- 颜色 ---
    var color = crosshairColor || '#ffffff';
    var lines = [elLines.top, elLines.bottom, elLines.left, elLines.right];

    // --- 根据形状设置可见性和样式 ---
    var showLines = (crosshairShape === 'cross');
    var showCircle = (crosshairShape === 'circle');
    var showDot = (crosshairShape === 'dot');

    lines.forEach(function (l) { if (l) l.style.display = showLines ? '' : 'none'; });
    if (elChCircle) elChCircle.style.display = showCircle ? '' : 'none';

    // 圆点：隐藏四线，显示一个中心点
    if (showDot) {
        lines.forEach(function (l) { if (l) l.style.display = 'none'; });
        if (elChCircle) elChCircle.style.display = 'none';
        // 用 top 线做圆点
        if (elLines.top) {
            elLines.top.style.display = '';
            elLines.top.style.width = '6px'; elLines.top.style.height = '6px';
            elLines.top.style.borderRadius = '50%';
            elLines.top.style.left = '-3px'; elLines.top.style.bottom = '0px';
            elLines.top.style.top = 'auto';
        }
    } else {
        if (elLines.top) {
            elLines.top.style.borderRadius = '';
            elLines.top.style.width = ''; elLines.top.style.height = '';
            elLines.top.style.left = ''; elLines.top.style.bottom = '';
            elLines.top.style.top = '';
        }
    }

    // 圆环
    if (showCircle && elChCircle) {
        var r = 6 * crosshairScale;
        elChCircle.style.width  = (r * 2) + 'px';
        elChCircle.style.height = (r * 2) + 'px';
        elChCircle.style.border = '2px solid ' + color;
    }

    // --- 四线段准星 ---
    var len = HUD.CROSSHAIR_LINE_LEN * crosshairScale;
    var gap = HUD.CROSSHAIR_GAP * crosshairScale;
    var w   = HUD.CROSSHAIR_LINE_WIDTH;

    function setVLine(el) {
        if (!el) return;
        el.style.background = color;
        el.style.height = len + 'px';
        el.style.width = w + 'px';
    }
    function setHLine(el) {
        if (!el) return;
        el.style.background = color;
        el.style.width = len + 'px';
        el.style.height = w + 'px';
    }
    setVLine(elLines.top);    if (elLines.top)    { elLines.top.style.bottom = gap + 'px'; elLines.top.style.left = (-w / 2) + 'px'; }
    setVLine(elLines.bottom); if (elLines.bottom) { elLines.bottom.style.top = gap + 'px'; elLines.bottom.style.left = (-w / 2) + 'px'; }
    setHLine(elLines.left);   if (elLines.left)   { elLines.left.style.right = gap + 'px'; elLines.left.style.top = (-w / 2) + 'px'; }
    setHLine(elLines.right);  if (elLines.right)  { elLines.right.style.left = gap + 'px'; elLines.right.style.top = (-w / 2) + 'px'; }
}

/** 设置准星颜色（由 settings.js 调用） */
export function setCrosshairColor(hex) {
    crosshairColor = hex;
}
/** 设置准星形状（由 settings.js 调用） */
export function setCrosshairShape(shape) {
    crosshairShape = shape;
}
export function getCrosshairColor() { return crosshairColor; }
export function getCrosshairShape() { return crosshairShape; }

// ============================================================
// 血量条
// ============================================================

function updateHealthBar(health) {
    if (!elHealthFill) return;
    const pct = Math.max(0, Math.min(100, health));
    elHealthFill.style.width = pct + '%';

    if (pct > 50) {
        elHealthFill.style.background = '#4caf50';
    } else if (pct > 25) {
        elHealthFill.style.background = '#ff9800';
    } else {
        elHealthFill.style.background = '#f44336';
    }
}

// ============================================================
// 命中标记
// ============================================================

function updateHitMarker(dt, hitConfirmed) {
    if (hitConfirmed) {
        hitMarkerTimer = HUD.HIT_MARKER_DURATION;
        if (elHitMarker) elHitMarker.style.opacity = '1';
    }
    if (hitMarkerTimer > 0) {
        hitMarkerTimer -= dt;
        if (hitMarkerTimer <= 0) {
            if (elHitMarker) elHitMarker.style.opacity = '0';
            hitMarkerTimer = 0;
        }
    }
}

// ============================================================
// 受伤闪红
// ============================================================

let damageFlashTimer = 0;

/** 触发受伤红色覆盖层 */
export function triggerDamageFlash() {
    damageFlashTimer = 0.15;
    if (elDamageOverlay) {
        elDamageOverlay.style.opacity = '1';
    }
}

export function updateDamageFlash(dt) {
    if (damageFlashTimer > 0) {
        damageFlashTimer -= dt;
        if (damageFlashTimer <= 0) {
            if (elDamageOverlay) elDamageOverlay.style.opacity = '0';
            damageFlashTimer = 0;
        }
    }
}

// ============================================================
// 弹药 HUD
// ============================================================

function updateAmmo(state) {
    const ammoEl = document.getElementById(UI_IDS.AMMO_DISPLAY);
    if (!ammoEl) return;
    if (state.reloadTimer > 0) {
        ammoEl.textContent = '换弹中...';
        ammoEl.style.color = '#ffaa00';
    } else {
        ammoEl.textContent = state.ammo + ' / ' + state.reserve;
        ammoEl.style.color = state.ammo === 0 ? '#ff4444' : '#ffffff';
    }
}

/** 获取准星扩散倍数 */
export function getCrosshairSpread() {
    return crosshairScale;
}

// ============================================================
// 得分
// ============================================================

export function addScore(points) {
    score += points;
    updateScoreDisplay();
}

export function getScore() { return score; }

export function resetScore() {
    score = 0;
    updateScoreDisplay();
}

function updateScoreDisplay() {
    if (elScore) elScore.textContent = 'Score: ' + score;
}

// ============================================================
// 击杀计数
// ============================================================

export function addKill() { totalKills++; }
export function getTotalKills() { return totalKills; }
export function resetKills() { totalKills = 0; }

// ============================================================
// 伤害方向指示器
// ============================================================

export function triggerDamageDirection(camera, damageSource) {
    if (!elDamageDir || !elDamageArrow) return;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const toSource = damageSource.clone().sub(camera.position);
    toSource.y = 0;
    toSource.normalize();

    const angle = Math.atan2(toSource.x, toSource.z) - Math.atan2(forward.x, forward.z);
    const degrees = angle * (180 / Math.PI);
    elDamageArrow.style.transform = 'translate(-50%, -50%) rotate(' + degrees + 'deg) translateY(-40px)';

    damageDirTimer = HUD.DAMAGE_DIR_DURATION;
    elDamageDir.style.opacity = '1';
}

function updateDamageDirection(dt) {
    if (damageDirTimer > 0) {
        damageDirTimer -= dt;
        if (damageDirTimer <= 0) {
            if (elDamageDir) elDamageDir.style.opacity = '0';
            damageDirTimer = 0;
        }
    }
}

// ============================================================
// 击杀信息栏
// ============================================================

export function addKillMessage(text, isHeadshot) {
    if (!elKillFeed) return;

    var msg = document.createElement('div');
    // 解析 text 格式: "武器名 +分数" 或 "爆头! +分数" 等
    var display = text;
    var cssClass = 'normal';
    if (isHeadshot) cssClass = 'headshot';
    if (text.indexOf('刀') >= 0) cssClass = 'knife';
    if (text.indexOf('手雷') >= 0) cssClass = 'grenade';

    msg.className = 'kill-msg ' + cssClass;
    // 格式: 击杀者 武器 受害者
    msg.innerHTML = '<span class="klr">▶ 你</span> ' +
        '<span class="wpn">[' + display.replace(/[+]\d+$/, '').trim() + ']</span> ' +
        '<span class="vic">击杀</span>' +
        (isHeadshot ? '<span class="hs">💀爆头</span>' : '');

    elKillFeed.insertBefore(msg, elKillFeed.firstChild);

    // 超过6条就删最旧的
    while (elKillFeed.children.length > 6) {
        elKillFeed.removeChild(elKillFeed.lastChild);
    }

    setTimeout(function () {
        if (msg.parentNode) msg.parentNode.removeChild(msg);
    }, HUD.KILL_MSG_DURATION * 1000);
}

// ============================================================
// 连杀卡片 / 击杀确认 / 武器名 / 手雷数
// ============================================================

export function updateKillStreakHUD(streak, isConfirm, weaponName, grenadeCount) {
    if (elKillStreakCard) {
        if (streak) {
            elKillStreakCard.style.opacity = '1';
            elKillStreakCard.textContent = streak.label;
            elKillStreakCard.style.color = streak.color;
        } else {
            elKillStreakCard.style.opacity = '0';
        }
    }

    if (elKillConfirm) {
        elKillConfirm.style.opacity = isConfirm ? '1' : '0';
    }

    if (elGrenadeCount) {
        elGrenadeCount.textContent = 'Gx' + grenadeCount;
    }
}

export function showWeaponName(name) {
    if (elWeaponName) {
        elWeaponName.textContent = name;
        elWeaponName.style.opacity = '1';
        setTimeout(function () {
            if (elWeaponName) elWeaponName.style.opacity = '0';
        }, 800);
    }
}

// ============================================================
// 第五批新增 — 波次显示
// ============================================================

/**
 * 更新波次 HUD
 * @param {number} wave — 当前波次数
 * @param {number} aliveCount — 剩余敌人数
 * @param {boolean} portalActive — 传送门是否激活
 * @param {boolean} victory — 是否通关
 * @param {number} nextWave — 下一波波次号
 */
function updateWaveDisplay(wave, aliveCount, portalActive, victory, nextWave) {
    if (victory) {
        if (elWaveDisplay) {
            elWaveDisplay.textContent = '🎉 通关！全部 10 波已完成 🎉';
            elWaveDisplay.style.color = '#ffd700';
            elWaveDisplay.style.fontSize = '32px';
        }
        if (elWaveTransition) {
            elWaveTransition.style.opacity = '1';
            elWaveTransition.textContent = '胜利！';
            elWaveTransition.style.color = '#ffd700';
            elWaveTransition.style.fontSize = '60px';
        }
        return;
    }
    if (elWaveDisplay && wave > 0) {
        if (portalActive) {
            elWaveDisplay.textContent = '传送门已开启 — 走近进入第 ' + nextWave + ' 波';
            elWaveDisplay.style.color = '#ffaa00';
        } else {
            elWaveDisplay.textContent = '第 ' + wave + ' / 10 波  |  剩余: ' + aliveCount;
            elWaveDisplay.style.color = '#ffffff';
        }
    }
    // 传送门模式下不再使用倒计时覆盖层
    if (elWaveTransition && !victory) {
        elWaveTransition.style.opacity = '0';
    }
}

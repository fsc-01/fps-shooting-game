// ============================================================
// waves.js — 波次系统
// 第六批更新：传送门替代自动倒计时
// ============================================================

// --- 内部状态 ---
var currentWave = 0;
var portalActive = false;
var nextWaveNumber = 0;
var minIntervalTimer = 0;
var victory = false;
var MAX_WAVES = 10;
var MIN_WAVE_INTERVAL = 0.5;

// 波次配置: [敌人数量, 血量倍率, 速度倍率, 伤害倍率]
var WAVE_TABLE = [
    null,
    [8,  1.0,  1.0,  1.0 ],       // Wave 1
    [10, 1.2,  1.05, 1.1 ],       // Wave 2
    [12, 1.4,  1.10, 1.2 ],       // Wave 3
    [14, 1.6,  1.15, 1.3 ],       // Wave 4
    [16, 1.8,  1.20, 1.4 ],       // Wave 5
];

function getWaveConfig(wave) {
    if (wave > MAX_WAVES) return null;
    if (wave <= 5) return WAVE_TABLE[wave];
    // 6-10波：线性递增
    var count = 16 + (wave - 5) * 2;
    var hp = 1.8 + (wave - 5) * 0.2;
    var spd = 1.20 + (wave - 5) * 0.05;
    var dmg = 1.4 + (wave - 5) * 0.1;
    return [count, hp, spd, dmg];
}

// ============================================================
// 公开 API
// ============================================================

export function initWaves() {
    currentWave = 0;
    portalActive = false;
    nextWaveNumber = 0;
    minIntervalTimer = 0;
    victory = false;
}

export function startWave1() {
    currentWave = 1;
    return getWaveConfig(1);
}

/**
 * 每帧更新波次状态
 * @param {number} dt
 * @param {number} aliveCount — 剩余敌人数
 * @returns {{ portalShouldActivate: boolean }}
 */
export function updateWaves(dt, aliveCount) {
    var result = { portalShouldActivate: false };

    if (minIntervalTimer > 0) {
        minIntervalTimer -= dt;
    }

    // 所有敌人死亡 → 判定
    if (aliveCount <= 0 && currentWave > 0 && minIntervalTimer <= 0) {
        // 已通关第10波 → 胜利
        if (currentWave >= MAX_WAVES) {
            victory = true;
            console.log('[waves] ★★★ 通关！第' + MAX_WAVES + '波全部消灭 ★★★');
            return result;
        }

        // 激活传送门
        if (!portalActive) {
            portalActive = true;
            nextWaveNumber = currentWave + 1;
            result.portalShouldActivate = true;
            console.log('[waves] 传送门激活！当前波次=' + currentWave + ', 下一波=' + nextWaveNumber);
        }
    }

    return result;
}

/**
 * 玩家走进传送门 — 触发下一波
 * @returns {Array|null} 波次配置 [count, hpMult, speedMult, dmgMult]，或 null
 */
export function enterPortal() {
    if (!portalActive) return null;
    portalActive = false;
    currentWave = nextWaveNumber;
    minIntervalTimer = MIN_WAVE_INTERVAL;
    return getWaveConfig(currentWave);
}

export function isPortalActive() { return portalActive; }
export function getCurrentWave() { return currentWave; }
export function getNextWaveNumber() { return nextWaveNumber; }

export function getWavePhase() {
    return {
        wave: currentWave,
        nextWave: nextWaveNumber,
        portalActive: portalActive,
        victory: victory,
        transition: false,
    };
}

export function isVictory() { return victory; }

export function resetWaves() {
    currentWave = 0;
    portalActive = false;
    nextWaveNumber = 0;
    minIntervalTimer = 0;
    victory = false;
}

// ============================================================
// killstreak.js — 连杀追踪系统
// 3秒窗口内连续击杀 → 双杀/三杀/多杀
// ============================================================

import { KILLSTREAK } from './constants.js?v=700';

const killTimestamps = [];
/** @type {{ count: number, label: string, color: string, timer: number } | null} */
let activeStreak = null;
let lastKillTime = 0;

// ============================================================
// 公开 API
// ============================================================

export function initKillStreak() {
    killTimestamps.length = 0;
    activeStreak = null;
    lastKillTime = 0;
}

/**
 * 记录一次击杀
 * @param {number} now — performance.now() / 1000
 * @returns {{ count: number, isStreak: boolean }}
 */
export function recordKill(now) {
    killTimestamps.push(now);

    // 清除3秒窗口外的
    const cutoff = now - KILLSTREAK.WINDOW;
    while (killTimestamps.length > 0 && killTimestamps[0] < cutoff) {
        killTimestamps.shift();
    }

    const count = killTimestamps.length;
    if (count >= 2) {
        let label, color;
        if (count === 2)      { label = '双杀'; color = '#ffffff'; }
        else if (count === 3) { label = '三杀'; color = '#ffd700'; }
        else                  { label = '多杀'; color = '#ff3333'; }
        activeStreak = { count, label, color, timer: KILLSTREAK.DISPLAY_DURATION };
    }

    return { count, isStreak: count >= 2 };
}

/**
 * 触发击杀确认（显示"击杀"文字）
 */
export function triggerKillConfirm(now) {
    lastKillTime = now;
}

/**
 * 击杀确认是否还在显示
 * @param {number} now
 */
export function isKillConfirmActive(now) {
    return (now - lastKillTime) < KILLSTREAK.KILL_CONFIRM_DURATION;
}

export function updateKillStreak(dt) {
    if (activeStreak) {
        activeStreak.timer -= dt;
        if (activeStreak.timer <= 0) activeStreak = null;
    }
}

export function getActiveStreak() { return activeStreak; }
export function hasKillStreak() { return activeStreak !== null; }

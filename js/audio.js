// ============================================================
// audio.js — Web Audio API 音效系统
// 程序化合成所有音效，不依赖外部音频文件
// ============================================================

import { AUDIO } from './constants.js?v=700';

/** @type {AudioContext} */
let ctx;
/** @type {GainNode} */
let masterGain;

/**
 * 初始化音频系统。
 * 必须在用户交互（点击）之后调用，否则浏览器会阻止 AudioContext。
 */
export function initAudio() {
    if (ctx) return; // 已初始化

    try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = AUDIO.MASTER_VOLUME;
        masterGain.connect(ctx.destination);
        console.log('[audio] AudioContext 初始化完成, 采样率:', ctx.sampleRate);
    } catch (e) {
        console.warn('[audio] AudioContext 不可用:', e.message);
        ctx = null;
        masterGain = null;
    }
}

/** 确保 AudioContext 被唤醒（浏览器暂停策略） */
export function resumeAudio() {
    if (ctx && ctx.state === 'suspended') {
        ctx.resume();
    }
}

/** 设置主音量（0.0 ~ 1.0） */
export function setMasterVolume(value) {
    if (masterGain) {
        masterGain.gain.value = value;
    }
}

// ============================================================
// 枪声 — AK47 特征
// ============================================================

export function playGunshot() {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;

    // 第一层：白噪声爆破（主体）
    const noiseLen = 0.15;
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    // Bandpass 滤波器 — 200Hz 中心（AK47特征低频）
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 200;
    bandpass.Q.value = 0.3;

    // 音量包络
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + noiseLen);

    noise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(now);
    noise.stop(now + noiseLen);

    // 第二层：低频方波（"咚咚"感）
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 80;
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
}

// ============================================================
// 脚步声
// ============================================================

export function playFootstep(isRunning) {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    const len = 0.06;

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    // Lowpass — 走路600Hz / 奔跑800Hz
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = isRunning ? 800 : 600;

    const gain = ctx.createGain();
    const vol = isRunning ? 0.4 : 0.25;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + len);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start(now);
    noise.stop(now + len);
}

// ============================================================
// 换弹音效 — 3阶段
// ============================================================

export function playReloadStage(stage) {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;

    if (stage === 'magOut') {
        // 弹匣弹出 — 高频click
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 1200;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.03);
    } else if (stage === 'magIn') {
        // 弹匣插入 — 略长click
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 800;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.05);
    } else if (stage === 'boltSlide') {
        // 拉栓 — 噪声 + 高频共振
        const len = 0.08;
        const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buf;

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 3000;
        bp.Q.value = 2;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + len);

        noise.connect(bp);
        bp.connect(gain);
        gain.connect(masterGain);
        noise.start(now);
        noise.stop(now + len);
    }
}

// ============================================================
// 命中标记音效
// ============================================================

export function playHitMarker() {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
}

// ============================================================
// 第三批新增音效
// ============================================================

/**
 * 敌人死亡音效 — 低沉的方波衰减
 */
export function playEnemyDeath() {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    const dur = 0.3;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + dur);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + dur);
}

/**
 * 拾取弹药音效 — 短促"叮"声
 */
export function playPickupAmmo() {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.08);

    // 第二声：稍低
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 900;
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.15, now + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.12);
}

/**
 * 拾取血量音效 — 柔和上扬音
 */
export function playPickupHealth() {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
}

// ============================================================
// 第四批新增音效
// ============================================================

/** 刀砍音效 — 高频whoosh */
export function playKnifeSwing() {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    const dur = 0.15;

    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2500;
    bp.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + dur);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(masterGain);
    noise.start(now);
    noise.stop(now + dur);
}

/** 拔手雷插销音效 — 高频金属click */
export function playGrenadePin() {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(3000, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.04);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.06);
}

/** 爆炸音效 — 低频隆隆声 */
export function playExplosion() {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    const dur = 0.6;

    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.2));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 150;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + dur);

    noise.connect(lp);
    lp.connect(gain);
    gain.connect(masterGain);
    noise.start(now);
    noise.stop(now + dur);
}

// ============================================================
// 第六批新增音效 — 敌人脚步 / 子弹呼啸
// ============================================================

/**
 * 敌人脚步声 — 比玩家脚步更低沉、更轻
 */
export function playEnemyFootstep() {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    const len = 0.04;

    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.01));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + len);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start(now);
    noise.stop(now + len);
}

/**
 * 子弹擦过呼啸声 — 高频短促噪声
 */
export function playBulletWhiz() {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    const len = 0.08;

    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.01));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 4000;
    bp.Q.value = 3;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + len);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(masterGain);
    noise.start(now);
    noise.stop(now + len);
}

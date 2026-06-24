// ============================================================
// settings.js — 设置面板（C键打开 / localStorage持久化）
// 第五批新增：难度选择（普通/困难）
// ============================================================

import { PLAYER, SETTINGS, STORAGE_KEYS, UI_IDS, HUD } from './constants.js?v=700';
import { setMasterVolume } from './audio.js?v=700';
import { requestLock } from './input.js?v=700';
import { setCrosshairColor, setCrosshairShape } from './hud.js?v=700';

// --- 内部状态 ---
var isOpen = false;
var fromMenu = false; // 从菜单打开设置 vs 游戏中打开
var mouseSensitivity = SETTINGS.DEFAULT_SENSITIVITY;
var masterVolume = SETTINGS.DEFAULT_VOLUME;
var hardMode = false;
var chColor = HUD.CROSSHAIR_COLOR || '#ffffff';
var chShape = 'cross';
var elSettings, elSensSlider, elVolSlider, elSensVal, elVolVal, elResume, elHardCheck, elChColor, elChShape;

// ============================================================
// 公开 API
// ============================================================

export function loadSettings() {
    try {
        var s = localStorage.getItem(STORAGE_KEYS.SENSITIVITY);
        if (s !== null) mouseSensitivity = parseFloat(s);
        var v = localStorage.getItem(STORAGE_KEYS.VOLUME);
        if (v !== null) masterVolume = parseFloat(v);
        var d = localStorage.getItem(STORAGE_KEYS.DIFFICULTY);
        if (d !== null) hardMode = (d === 'hard');
        var c = localStorage.getItem(STORAGE_KEYS.CROSSHAIR_COLOR);
        if (c !== null) chColor = c;
        var sh = localStorage.getItem(STORAGE_KEYS.CROSSHAIR_SHAPE);
        if (sh !== null) chShape = sh;
    } catch (e) { /* ignore */ }
    PLAYER.MOUSE_SENSITIVITY = mouseSensitivity;
    setMasterVolume(masterVolume);
    setCrosshairColor(chColor);
    setCrosshairShape(chShape);
}

export function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEYS.SENSITIVITY, mouseSensitivity.toString());
        localStorage.setItem(STORAGE_KEYS.VOLUME, masterVolume.toString());
        localStorage.setItem(STORAGE_KEYS.DIFFICULTY, hardMode ? 'hard' : 'normal');
        localStorage.setItem(STORAGE_KEYS.CROSSHAIR_COLOR, chColor);
        localStorage.setItem(STORAGE_KEYS.CROSSHAIR_SHAPE, chShape);
    } catch (e) { /* ignore */ }
}

export function initSettings() {
    elSettings = document.getElementById(UI_IDS.SETTINGS_OVERLAY);
    elSensSlider = document.getElementById(UI_IDS.SENSITIVITY_SLIDER);
    elVolSlider = document.getElementById(UI_IDS.VOLUME_SLIDER);
    elSensVal = document.getElementById(UI_IDS.SENS_VALUE);
    elVolVal = document.getElementById(UI_IDS.VOL_VALUE);
    elResume = document.getElementById(UI_IDS.SETTINGS_RESUME);
    elHardCheck = document.getElementById('hard-mode-check');
    elChColor = document.getElementById('ch-color');
    elChShape = document.getElementById('ch-shape');

    if (elSensSlider) {
        elSensSlider.addEventListener('input', function () {
            mouseSensitivity = parseFloat(this.value);
            PLAYER.MOUSE_SENSITIVITY = mouseSensitivity;
            if (elSensVal) elSensVal.textContent = mouseSensitivity.toFixed(4);
            saveSettings();
        });
    }
    if (elVolSlider) {
        elVolSlider.addEventListener('input', function () {
            masterVolume = parseFloat(this.value);
            setMasterVolume(masterVolume);
            if (elVolVal) elVolVal.textContent = Math.round(masterVolume * 100) + '%';
            saveSettings();
        });
    }
    if (elHardCheck) {
        elHardCheck.addEventListener('change', function () {
            hardMode = this.checked;
            saveSettings();
        });
    }
    if (elChColor) {
        elChColor.addEventListener('input', function () {
            chColor = this.value;
            setCrosshairColor(chColor);
            saveSettings();
        });
    }
    if (elChShape) {
        elChShape.addEventListener('change', function () {
            chShape = this.value;
            setCrosshairShape(chShape);
            saveSettings();
        });
    }
    if (elResume) {
        elResume.addEventListener('click', closeSettings);
    }

    loadSettings();
}

export function openSettings(menuMode) {
    if (isOpen || !elSettings) return;
    fromMenu = !!menuMode;
    isOpen = true;
    if (fromMenu) {
        var menu = document.getElementById('main-menu');
        if (menu) menu.style.display = 'none';
    }
    elSettings.style.display = 'flex';
    if (elSensSlider) elSensSlider.value = mouseSensitivity;
    if (elVolSlider) elVolSlider.value = masterVolume;
    if (elSensVal) elSensVal.textContent = mouseSensitivity.toFixed(4);
    if (elVolVal) elVolVal.textContent = Math.round(masterVolume * 100) + '%';
    if (elHardCheck) elHardCheck.checked = hardMode;
    if (elChColor) elChColor.value = chColor;
    if (elChShape) elChShape.value = chShape;
    // 退出指针锁定以便鼠标操作设置面板
    if (document.pointerLockElement) document.exitPointerLock();
}

export function closeSettings() {
    if (!isOpen) return;
    isOpen = false;
    if (elSettings) elSettings.style.display = 'none';
    if (fromMenu) {
        fromMenu = false;
        // 回到主菜单
        var menu = document.getElementById('main-menu');
        if (menu) menu.style.display = 'flex';
    } else {
        requestLock();
    }
}

export function isSettingsOpen() { return isOpen; }
export function isHardMode() { return hardMode; }

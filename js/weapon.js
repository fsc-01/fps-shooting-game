// ============================================================
// weapon.js — 薄壳代理
// 全部逻辑委托给 weapon-manager.js，保持旧API不变
// ============================================================

import {
    initWeaponManager,
    updateWeaponManager,
    resetWeaponManager,
    getAmmoStatus as getAmmoStatusWM,
    getScreenShakeOffset as getScreenShakeOffsetWM,
    addReserveAmmo as addReserveAmmoWM,
    getCurrentWeaponName as getCurrentWeaponNameWM,
    getCurrentSlot as getCurrentSlotWM,
    isCurrentWeaponKnife as isCurrentWeaponKnifeWM,
} from './weapon-manager.js?v=700';

export function initWeapon(scene, camera) { return initWeaponManager(scene, camera); }
export function updateWeapon(scene, camera, colliders, dt, enemyTargets) {
    return updateWeaponManager(scene, camera, colliders, dt, enemyTargets);
}
export function resetWeapon(scene, camera) { resetWeaponManager(scene, camera); }
export function getAmmoStatus() { return getAmmoStatusWM(); }
export function getScreenShakeOffset() { return getScreenShakeOffsetWM(); }
export function addReserveAmmo(amount) { return addReserveAmmoWM(amount); }
export function getCurrentWeaponName() { return getCurrentWeaponNameWM(); }
export function getCurrentSlot() { return getCurrentSlotWM(); }
export function isCurrentWeaponKnife() { return isCurrentWeaponKnifeWM(); }

// ============================================================
// main.js — 第六批 传送门+音效+匕首爆头+平衡调整
// ============================================================

import * as THREE from 'three';
import { initScene, getCamera, getRenderer, onResize } from './scene.js?v=700';
import { initInput, requestLock, endFrame, isLocked, getWeaponScroll, forceKeyJust, isSettingsToggle, isScoping, resetScope } from './input.js?v=700';
import { buildMap } from './map.js?v=700';
import { initPlayer, updatePlayer, getDamageFlash, takeDamage, healPlayer, getIsDead, respawnPlayer, resetPlayerPosition } from './player.js?v=700';
import { initWeapon, updateWeapon, getAmmoStatus, getScreenShakeOffset, addReserveAmmo, getCurrentWeaponName, getCurrentSlot, isCurrentWeaponKnife, resetWeapon, setInfiniteAmmo, isInfiniteAmmo } from './weapon.js?v=700';
import { initAudio, resumeAudio, playFootstep, playEnemyDeath, playPickupAmmo, playPickupHealth, playEnemyFootstep, playBulletWhiz } from './audio.js?v=700';
import { initHUD, updateHUD, triggerDamageFlash, updateDamageFlash, addScore, getScore, resetScore, triggerDamageDirection, addKillMessage, updateKillStreakHUD, showWeaponName, addKill, getTotalKills, resetKills } from './hud.js?v=700';
import { initEnemies, updateEnemies, getEnemyHitTargets, applyDamage, getEnemyPositionsWithIds, getAliveCount, spawnWaveEnemies, flushTracers, getLastDeathPosition, getAndClearEnemyShotFired, getMovingEnemiesNearPlayer } from './enemy.js?v=700';
import { initPickups, updatePickups } from './pickup.js?v=700';
import { initGrenades, updateGrenades, getGrenadeCount, resetGrenadeCount, setEnemyPositionProvider } from './grenade.js?v=700';
import { initKillStreak, recordKill, updateKillStreak, getActiveStreak, triggerKillConfirm, isKillConfirmActive } from './killstreak.js?v=700';
import { initWaves, startWave1, updateWaves, getWavePhase, resetWaves, isPortalActive, enterPortal, isVictory } from './waves.js?v=700';
import { loadSettings, initSettings, isSettingsOpen, openSettings, closeSettings } from './settings.js?v=700';
import { AUDIO, WEAPON, PICKUP, SCORE, MELEE, PORTAL } from './constants.js?v=700';

function main() {
    var canvas = document.getElementById('gameCanvas');
    var sceneData = initScene(canvas);
    var scene = sceneData.scene;
    var camera = getCamera();

    var mapData = buildMap(scene);
    var colliders = mapData.colliders;
    var spawnPoint = mapData.spawnPoint;
    var enemySpawns = mapData.enemySpawns;
    var pickupSpawns = mapData.pickupSpawns;

    // --- 初始化子系统 ---
    initPlayer(camera, spawnPoint);
    initWeapon(scene, camera);

    // ── 管理员无限火力绑定 ──
    if (window.__adminBindSetInfiniteAmmo) {
        window.__adminBindSetInfiniteAmmo(setInfiniteAmmo);
    }
    initHUD();
    initAudio();
    initKillStreak();
    setEnemyPositionProvider(getEnemyPositionsWithIds);
    initGrenades();
    initWaves();
    initInput(canvas);
    loadSettings();
    initSettings();

    // 第一波初始生成
    var wave1Cfg = startWave1();
    initPickups(scene, pickupSpawns);
    initEnemies(scene, enemySpawns);

    var blocker = document.getElementById('blocker');

    // ── 主菜单 ──
    var mainMenu = document.getElementById('main-menu');
    var btnStart = document.getElementById('btn-start');
    var btnSettings = document.getElementById('btn-settings');
    var btnControls = document.getElementById('btn-controls');
    var controlsPanel = document.getElementById('controls-panel');
    var btnControlsBack = document.getElementById('btn-controls-back');

    function showMenu() {
        if (mainMenu) mainMenu.style.display = 'flex';
        if (controlsPanel) controlsPanel.style.display = 'none';
        if (blocker) blocker.style.display = 'none';
    }
    function hideMenu() {
        if (mainMenu) mainMenu.style.display = 'none';
        if (controlsPanel) controlsPanel.style.display = 'none';
    }

    var needReInit = false; // 死亡返回菜单后标记

    showMenu();

    if (btnStart) btnStart.addEventListener('click', function () {
        hideMenu();
        if (needReInit) {
            // 死亡后回菜单 → 重新生成敌人和拾取物
            initEnemies(scene, enemySpawns);
            initPickups(scene, pickupSpawns);
            startWave1();
            needReInit = false;
        }
        if (blocker) blocker.style.display = 'flex';
        resumeAudio();
        requestLock();
    });
    if (btnSettings) btnSettings.addEventListener('click', function () { openSettings(true); });
    if (btnControls) btnControls.addEventListener('click', function () {
        if (mainMenu) mainMenu.style.display = 'none';
        if (controlsPanel) controlsPanel.style.display = 'flex';
    });
    if (btnControlsBack) btnControlsBack.addEventListener('click', function () {
        if (controlsPanel) controlsPanel.style.display = 'none';
        if (mainMenu) mainMenu.style.display = 'flex';
    });

    if (blocker) {
        blocker.addEventListener('click', function () {
            resumeAudio();
            requestLock();
        });
    }

    window.addEventListener('resize', onResize);

    var footstepTimer = 0;
    var enemyFootstepTimer = 0;
    var prevSlot = getCurrentSlot();
    var lastTime = performance.now();
    var scopeFov = 75;
    var SCOPE_FOV = 30;
    var SCOPE_SPEED = 15;

    // 滚轮
    var wheelIndex = 2;
    var WHEEL_SLOTS = ['Digit1', 'Digit2', 'Digit3', 'KeyG'];

    // 死亡状态
    var deathOverlayActive = false;
    var deathOverlay = null;

    // --- 传送门 ---
    var portalGroup = null;
    var portalParticles = [];
    var portalLight = null;
    var portalParticleAngle = 0;

    function createPortal(scene, position) {
        if (portalGroup) removePortal(scene);
        var baseY = Math.max(position.y, 0);
        portalGroup = new THREE.Group();
        portalGroup.position.set(position.x, baseY, position.z);

        // 光柱
        var beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 20, 16, 1, true);
        var beamMat = new THREE.MeshBasicMaterial({ color: PORTAL.GLOW_COLOR, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
        var beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.y = 10 + PORTAL.HEIGHT;
        beam.name = 'portalBeam';
        portalGroup.add(beam);

        // 地面光圆
        var discGeo = new THREE.CircleGeometry(PORTAL.RADIUS + 0.5, 32);
        var discMat = new THREE.MeshBasicMaterial({ color: PORTAL.COLOR, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
        var disc = new THREE.Mesh(discGeo, discMat);
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = 0.02;
        disc.name = 'portalDisc';
        portalGroup.add(disc);

        // 主环
        var ringGeo = new THREE.TorusGeometry(PORTAL.RADIUS, PORTAL.TUBE_RADIUS, 16, 48);
        var ringMat = new THREE.MeshStandardMaterial({ color: PORTAL.COLOR, emissive: PORTAL.COLOR, emissiveIntensity: 3.0, roughness: 0.15, metalness: 0.95 });
        var ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = PORTAL.HEIGHT;
        ring.name = 'portalRing';
        portalGroup.add(ring);

        // 光晕环
        var glowGeo = new THREE.TorusGeometry(PORTAL.RADIUS + 0.3, PORTAL.TUBE_RADIUS * 2, 16, 48);
        var glowMat = new THREE.MeshBasicMaterial({ color: PORTAL.GLOW_COLOR, transparent: true, opacity: 0.55, depthWrite: false });
        var glowRing = new THREE.Mesh(glowGeo, glowMat);
        glowRing.rotation.x = Math.PI / 2;
        glowRing.position.y = PORTAL.HEIGHT;
        glowRing.name = 'portalGlow';
        portalGroup.add(glowRing);

        // 白色内环
        var innerGeo = new THREE.TorusGeometry(PORTAL.RADIUS * 0.7, PORTAL.TUBE_RADIUS * 0.6, 12, 32);
        var innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false });
        var innerRing = new THREE.Mesh(innerGeo, innerMat);
        innerRing.rotation.x = Math.PI / 2;
        innerRing.position.y = PORTAL.HEIGHT;
        innerRing.name = 'portalInner';
        portalGroup.add(innerRing);

        // 粒子
        portalParticles = [];
        portalParticleAngle = 0;
        for (var i = 0; i < PORTAL.PARTICLE_COUNT; i++) {
            var pGeo = new THREE.SphereGeometry(PORTAL.PARTICLE_SIZE, 8, 8);
            var pMat = new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xffffff : (i % 3 === 1 ? PORTAL.COLOR : PORTAL.GLOW_COLOR), transparent: true, opacity: 0.9, depthWrite: false });
            var particle = new THREE.Mesh(pGeo, pMat);
            particle.name = 'portalParticle';
            portalParticles.push(particle);
            portalGroup.add(particle);
        }

        // 灯光
        portalLight = new THREE.PointLight(PORTAL.COLOR, PORTAL.LIGHT_INTENSITY, PORTAL.LIGHT_RANGE);
        portalLight.position.y = PORTAL.HEIGHT;
        portalGroup.add(portalLight);
        scene.add(portalGroup);

        console.log('[portal] 传送门生成于 (' + position.x.toFixed(1) + ', ' + position.y.toFixed(1) + ', ' + position.z.toFixed(1) + ')');
    }

    function removePortal(scene) {
        if (!portalGroup) return;
        scene.remove(portalGroup);
        portalGroup.traverse(function (c) {
            if (c.geometry) c.geometry.dispose();
            if (c.material) { if (Array.isArray(c.material)) c.material.forEach(function (m) { m.dispose(); }); else c.material.dispose(); }
        });
        portalGroup = null; portalParticles = []; portalLight = null;
    }

    var deathHandled = false;

    function showDeathOverlay() {
        deathOverlay = document.getElementById('death-overlay');
        if (!deathOverlay) return;
        deathHandled = false;
        // 退出指针锁定，否则 DOM 点击事件无效
        if (document.pointerLockElement) document.exitPointerLock();
        var blockerEl = document.getElementById('blocker');
        if (blockerEl) blockerEl.style.display = 'none';
        var elScore = document.getElementById('death-score');
        var elKills = document.getElementById('death-kills');
        var elWave = document.getElementById('death-wave');
        if (elScore) elScore.textContent = getScore();
        if (elKills) elKills.textContent = getTotalKills();
        if (elWave) elWave.textContent = getWavePhase().wave;
        deathOverlay.style.display = 'flex';
        deathOverlayActive = true;
    }

    function hideDeathOverlay() {
        if (deathOverlay) deathOverlay.style.display = 'none';
        deathOverlayActive = false;
    }

    function goToMenu() {
        if (deathHandled) return;
        deathHandled = true;
        hideDeathOverlay();
        respawnPlayer(camera, spawnPoint);
        resetScope(); scopeFov = 75;
        resetScore(); resetKills();
        resetWeapon(scene, camera);
        initGrenades(); initKillStreak(); resetWaves();
        removePortal(scene);
        needReInit = true;
        showMenu();
    }

    // 死亡覆盖层事件 — 防止重复触发
    var deathOverlayEl = document.getElementById('death-overlay');
    if (deathOverlayEl) {
        deathOverlayEl.addEventListener('click', function (e) {
            e.stopPropagation();
            if (deathOverlayActive) goToMenu();
        });
    }
    window.addEventListener('keydown', function (e) {
        if (!deathOverlayActive) return;
        if (!deathOverlay || deathOverlay.style.display === 'none') return;
        e.preventDefault();
        e.stopPropagation();
        goToMenu();
    });

    function animate() {
        requestAnimationFrame(animate);
        var loopNow = performance.now();
        var dt = Math.min((loopNow - lastTime) / 1000, 0.1);
        lastTime = loopNow;
        var nowSec = loopNow / 1000;
        var gameStarted = isLocked();

        try {
            // --- 0. 设置面板 ---
            if (isSettingsToggle()) { if (isSettingsOpen()) closeSettings(); else openSettings(); }
            if (isSettingsOpen()) { getRenderer().render(scene, camera); endFrame(); return; }

            // --- 0.5 死亡闸门 ---
            var isDeadNow = getIsDead();
            if (isDeadNow && !deathOverlayActive) showDeathOverlay();
            if (isDeadNow) { getRenderer().render(scene, camera); endFrame(); return; }

            // --- 1. 玩家 ---
            var playerState = updatePlayer(camera, colliders, dt);

            // --- 1.5 开镜 ---
            var targetFov = isScoping() ? SCOPE_FOV : 75;
            scopeFov += (targetFov - scopeFov) * SCOPE_SPEED * dt;
            camera.fov = scopeFov;
            camera.updateProjectionMatrix();

            // --- 2. 震动 ---
            var shake = getScreenShakeOffset();
            camera.position.x += shake.x; camera.position.y += shake.y;

            // --- 3. 敌人 ---
            if (gameStarted) {
                updateEnemies(dt, scene, camera.position, colliders, function (amount, sourcePos) {
                    takeDamage(amount);
                    if (sourcePos) triggerDamageDirection(camera, sourcePos);
                    else {
                        var pl = getEnemyPositionsWithIds();
                        if (pl.length > 0) triggerDamageDirection(camera, pl[0].position);
                    }
                });
                flushTracers(scene);
                if (getAndClearEnemyShotFired()) playBulletWhiz();
            }

            // --- 3.2 波次（传送门模式） ---
            if (gameStarted && !isDeadNow) {
                var aliveNow = getAliveCount();
                var waveResult = updateWaves(dt, aliveNow);
                if (waveResult.portalShouldActivate) {
                    var deathPos = getLastDeathPosition();
                    createPortal(scene, deathPos);
                }
                if (isPortalActive() && portalGroup) {
                    var pw = new THREE.Vector3();
                    portalGroup.getWorldPosition(pw);
                    if (camera.position.distanceTo(pw) <= PORTAL.TRIGGER_RANGE) {
                        var cfg = enterPortal();
                        if (cfg) { spawnWaveEnemies(scene, cfg, enemySpawns); resetGrenadeCount(); }
                        removePortal(scene);
                    }
                }
            }

            // --- 3.3 传送门动画 ---
            if (portalGroup) {
                var ring = portalGroup.getObjectByName('portalRing');
                if (ring) ring.rotation.z += PORTAL.SPIN_SPEED * dt;
                var glow = portalGroup.getObjectByName('portalGlow');
                if (glow) glow.rotation.z -= PORTAL.SPIN_SPEED * 0.55 * dt;
                var inner = portalGroup.getObjectByName('portalInner');
                if (inner) inner.rotation.z += PORTAL.SPIN_SPEED * 1.8 * dt;
                var beam = portalGroup.getObjectByName('portalBeam');
                if (beam) beam.material.opacity = 0.2 + 0.15 * Math.sin(performance.now() * 0.003);
                var disc = portalGroup.getObjectByName('portalDisc');
                if (disc) disc.material.opacity = 0.25 + 0.15 * Math.sin(performance.now() * 0.005);
                portalParticleAngle += PORTAL.SPIN_SPEED * 0.5 * dt;
                for (var pi = 0; pi < portalParticles.length; pi++) {
                    var angle = portalParticleAngle + (pi / portalParticles.length) * Math.PI * 2;
                    var orbitR = PORTAL.PARTICLE_ORBIT * (0.8 + 0.2 * Math.sin(portalParticleAngle * 3 + pi));
                    portalParticles[pi].position.x = Math.cos(angle) * orbitR;
                    portalParticles[pi].position.y = PORTAL.HEIGHT + Math.sin(angle) * orbitR * 0.15;
                    portalParticles[pi].position.z = Math.sin(angle) * orbitR * 0.08;
                }
            }

            // --- 3.5 滚轮 ---
            var scrollVal = getWeaponScroll();
            if (gameStarted && scrollVal !== 0) {
                var count = WHEEL_SLOTS.length;
                var target = wheelIndex;
                for (var ch = 0; ch < count; ch++) { target += scrollVal; target = ((target % count) + count) % count; if (target === 3 && getGrenadeCount() <= 0) continue; break; }
                wheelIndex = target;
                forceKeyJust(WHEEL_SLOTS[wheelIndex]);
            }

            // --- 4. 武器 ---
            var enemyTargets = gameStarted ? getEnemyHitTargets() : null;
            var weaponResult = updateWeapon(scene, camera, colliders, dt, enemyTargets);
            var curSlot = getCurrentSlot();
            if (curSlot !== prevSlot) { showWeaponName(getCurrentWeaponName()); prevSlot = curSlot; wheelIndex = curSlot; }

            // --- 5. 伤害 ---
            if (weaponResult && weaponResult.enemyHit) {
                var eh = weaponResult.enemyHit;
                var damage = MELEE.DAMAGE;
                var isKnifeHead = false;
                if (!isCurrentWeaponKnife()) {
                    damage = eh.isHeadshot ? WEAPON.DAMAGE * WEAPON.HEADSHOT_MULTIPLIER : WEAPON.DAMAGE;
                } else if (eh.isHeadshot) {
                    damage = 9999; isKnifeHead = true;
                }
                var hr = applyDamage(eh.enemyId, damage, eh.isHeadshot);
                if (hr && hr.killed) {
                    var pts = isCurrentWeaponKnife() ? (isKnifeHead ? SCORE.KILL + SCORE.HEADSHOT_BONUS * 2 : SCORE.KILL) : (SCORE.KILL + (eh.isHeadshot ? SCORE.HEADSHOT_BONUS : 0));
                    addScore(pts); addKill(); playEnemyDeath();
                    var kt = '击杀敌人 +' + pts;
                    if (isKnifeHead) kt = '刀杀爆头! +' + pts;
                    else if (isCurrentWeaponKnife()) kt = '刀杀 +' + pts;
                    else if (eh.isHeadshot) kt = '爆头! +' + pts;
                    addKillMessage(kt, eh.isHeadshot || isKnifeHead);
                    recordKill(nowSec); triggerKillConfirm(nowSec);
                }
            }

            // --- 6. 手雷 ---
            if (gameStarted) {
                updateGrenades(dt, scene, colliders, getEnemyPositionsWithIds(), function (epid, gdmg) {
                    var gr = applyDamage(epid, gdmg, false);
                    if (gr && gr.killed) { addScore(SCORE.KILL); addKill(); playEnemyDeath(); addKillMessage('手雷 +' + SCORE.KILL, false); recordKill(nowSec); triggerKillConfirm(nowSec); }
                }, function () { return nowSec; });
            }

            // --- 8. 拾取 ---
            updatePickups(dt, camera.position, 0.4, function (type) {
                if (type === 'ammo') { addReserveAmmo(PICKUP.AMMO_AMOUNT); playPickupAmmo(); }
                else if (type === 'health') { healPlayer(PICKUP.HEALTH_AMOUNT); playPickupHealth(); }
            });

            // --- 9. 玩家脚步 ---
            if (playerState && playerState.isMoving && playerState.grounded) {
                footstepTimer -= dt;
                if (footstepTimer <= 0) { footstepTimer = playerState.isRunning ? AUDIO.FOOTSTEP_RUN : AUDIO.FOOTSTEP_WALK; playFootstep(playerState.isRunning); }
            } else footstepTimer = 0;

            // --- 9.5 敌人脚步 ---
            if (gameStarted && !isDeadNow && getAliveCount() > 0) {
                var mc = getMovingEnemiesNearPlayer(camera.position, 25);
                if (mc > 0) { enemyFootstepTimer -= dt; var si = 0.45 / Math.min(mc, 4); if (enemyFootstepTimer <= 0) { playEnemyFootstep(); enemyFootstepTimer = si * (0.85 + Math.random() * 0.3); } }
                else enemyFootstepTimer = 0.05;
            } else enemyFootstepTimer = 0;

            // --- 10. 受伤 ---
            if (getDamageFlash()) triggerDamageFlash();
            updateDamageFlash(dt);

            // --- 11. 连杀 ---
            updateKillStreak(dt);

            // --- 12. HUD ---
            var ammo = getAmmoStatus();
            var wavePhase = getWavePhase();
            var infAmmo = isInfiniteAmmo();
            updateHUD(dt, {
                health: playerState ? playerState.health : 100,
                ammo: infAmmo ? 999 : (ammo ? ammo.currentAmmo : 30),
                reserve: infAmmo ? 999 : (ammo ? ammo.reserveAmmo : 90),
                reloadTimer: ammo ? ammo.reloadTimer : 0,
                isMoving: playerState ? playerState.isMoving : false,
                isJumping: playerState ? playerState.isJumping : false,
                isFiring: weaponResult ? weaponResult.isFiring : false,
                hitConfirmed: weaponResult ? weaponResult.hitConfirmed : false,
                wave: wavePhase.wave,
                aliveCount: getAliveCount(),
                portalActive: wavePhase.portalActive,
                victory: wavePhase.victory,
                nextWave: wavePhase.nextWave,
            });

            // --- 13. 连杀HUD ---
            updateKillStreakHUD(getActiveStreak(), isKillConfirmActive(nowSec), getCurrentWeaponName(), getGrenadeCount());

            // --- 14. 渲染 ---
            getRenderer().render(scene, camera);

            // --- 15. 恢复震动 ---
            camera.position.x -= shake.x; camera.position.y -= shake.y;

            // --- 16. 收尾 ---
            endFrame();
        } catch (err) {
            console.error('[FPS] 帧错误:', err.message);
            try { camera.position.x -= shake.x; camera.position.y -= shake.y; } catch (e2) {}
            endFrame();
        }
    }

    animate();
}

main();

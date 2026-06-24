// ============================================================
// scene.js — Three.js 场景初始化
// 创建渲染器、相机、场景、灯光、天空色、雾效
// ============================================================

import * as THREE from 'three';
import { RENDER, COLORS, PLAYER } from './constants.js?v=700';

/** @type {THREE.WebGLRenderer} */
let renderer;
/** @type {THREE.PerspectiveCamera} */
let camera;
/** @type {THREE.Scene} */
let scene;

/**
 * 初始化整个渲染环境
 * @param {HTMLCanvasElement} canvas — index.html 中的 canvas 元素
 * @returns {{ renderer, camera, scene }}
 */
export function initScene(canvas) {
    // --- 渲染器 ---
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 天空颜色（与雾效统一）
    renderer.setClearColor(COLORS.SKY_TOP);

    // --- 场景 ---
    scene = new THREE.Scene();

    // --- 相机 ---
    camera = new THREE.PerspectiveCamera(
        RENDER.FOV,
        window.innerWidth / window.innerHeight,
        RENDER.NEAR,
        RENDER.FAR,
    );
    // 初始位置（出生点）
    camera.position.set(0, PLAYER.HEIGHT, 0);

    // --- 环境光（最低亮度保证暗面不全黑） ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambient);

    // --- 方向光（太阳，投射阴影） ---
    const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
    sun.position.set(50, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    scene.add(sun);

    // --- 半球光（天空/地面反射） ---
    const hemi = new THREE.HemisphereLight(COLORS.SKY_TOP, COLORS.GROUND, 0.4);
    scene.add(hemi);

    return { renderer, camera, scene };
}

/** 获取渲染器 */
export function getRenderer() { return renderer; }
/** 获取相机 */
export function getCamera() { return camera; }
/** 获取场景 */
export function getScene() { return scene; }

/**
 * 窗口缩放时调用
 */
export function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

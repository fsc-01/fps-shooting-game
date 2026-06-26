// weapon-models.js — GLB 匕首 + OBJ AK47 + GLB 手枪 + GLB 手雷（压缩纹理嵌入版）

import * as THREE from 'three';

// ============================================================
// 材质预设（仅匕首和AK47需程序化材质）
// ============================================================
var BLADE_SILVER = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.2, metalness: 0.95, side: THREE.DoubleSide, flatShading: true });
var AK_METAL     = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.35, metalness: 0.85, flatShading: true });

// ============================================================
// 路径（pistol.glb/grenade.glb 包含压缩嵌入纹理，GLTFLoader 原生材质）
// ============================================================
var daggerPath  = './textures/dagger/dagger.glb';
var akObjPath   = './textures/AK47/AK_OBJ.obj';
var pistolPath  = './textures/pistol.glb';
var grenadePath = './textures/grenade.glb';

// 缓存
var daggerRoot  = null, daggerReady  = false;
var akRoot      = null, akReady      = false;
var pistolRoot  = null, pistolReady  = false;
var grenadeRoot = null, grenadeReady = false;

var onModelReady = null;
export function setModelReadyCallback(cb) { onModelReady = cb; }

// ============================================================
// 动态加载（不阻塞游戏启动）
// ============================================================
setTimeout(function () {
    // --- 匕首 (GLTFLoader) ---
    import('./loaders/GLTFLoader.js?v=708').then(function (mod) {
        var loader = new mod.GLTFLoader();
        loader.load(daggerPath,
            function (gltf) {
                var rm = [];
                gltf.scene.traverse(function (c) {
                    var n = (c.name || '').toLowerCase();
                    if (n.indexOf('scabbard') >= 0 || n === 'plane.013') rm.push(c);
                    if (c.isMesh && c.geometry) {
                        c.geometry = c.geometry.toNonIndexed();
                        c.geometry.computeVertexNormals();
                        c.material = BLADE_SILVER.clone();
                    }
                });
                rm.forEach(function (c) { if (c.parent) c.parent.remove(c); });
                daggerRoot = gltf.scene;
                daggerReady = true;
                if (onModelReady) onModelReady(0);
                console.log('[model] 匕首 GLB 就绪');
            },
            undefined,
            function (err) { console.warn('[model] 匕首加载失败', err); }
        );

        // --- 手枪 GLB (嵌入压缩纹理，GLTFLoader 原生材质) ---
        loader.load(pistolPath,
            function (gltf) {
                var scene = gltf.scene;
                // 枪管GLTF+X → 游戏-Z
                scene.position.set(0, 0, 0);
                scene.rotation.y = Math.PI / 2;
                // 仅修正纹理 colorSpace，不动材质
                scene.traverse(function (c) {
                    if (c.isMesh && c.material) {
                        var mats = Array.isArray(c.material) ? c.material : [c.material];
                        mats.forEach(function (m) {
                            if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
                            if (m.roughnessMap) m.roughnessMap.colorSpace = THREE.NoColorSpace;
                            if (m.metalnessMap) m.metalnessMap.colorSpace = THREE.NoColorSpace;
                            if (m.normalMap) m.normalMap.colorSpace = THREE.NoColorSpace;
                        });
                    }
                });
                pistolRoot = scene;
                pistolReady = true;
                if (onModelReady) onModelReady(1);
                console.log('[model] 手枪 GLB 就绪');
            },
            function (p) { if (p && p.total > 0) console.log('[model] 手枪:', Math.round(p.loaded/p.total*100) + '%'); },
            function (err) { console.error('[model] 手枪 GLB 加载失败!', err); }
        );

        // --- 手雷 GLB (嵌入压缩纹理，GLTFLoader 原生材质) ---
        loader.load(grenadePath,
            function (gltf) {
                var scene = gltf.scene;
                scene.rotation.x = 0;
                scene.scale.set(1.0, 1.0, 1.0);
                scene.traverse(function (c) {
                    if (c.isMesh && c.material) {
                        var mats = Array.isArray(c.material) ? c.material : [c.material];
                        mats.forEach(function (m) {
                            if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
                            if (m.roughnessMap) m.roughnessMap.colorSpace = THREE.NoColorSpace;
                            if (m.metalnessMap) m.metalnessMap.colorSpace = THREE.NoColorSpace;
                            if (m.normalMap) m.normalMap.colorSpace = THREE.NoColorSpace;
                        });
                    }
                });
                grenadeRoot = scene;
                grenadeReady = true;
                // 注入 grenade.js
                setTimeout(function () {
                    import('./grenade.js?v=700').then(function (gm) {
                        if (gm.setGrenadeGLB) gm.setGrenadeGLB(grenadeRoot, true);
                    });
                }, 100);
                if (onModelReady) onModelReady(3);
                console.log('[model] 手雷 GLB 就绪');
            },
            undefined,
            function (err) { console.error('[model] 手雷 GLB 加载失败!', err); }
        );

    }).catch(function (e) { console.warn('[model] GLTFLoader import失败:', e.message); });

    // --- AK47 (OBJLoader) ---
    import('./loaders/OBJLoader.js?v=708').then(function (mod) {
        var loader = new mod.OBJLoader();
        loader.load(akObjPath,
            function (obj) {
                var scale = 0.88 / 192.353;
                var mc = 0;
                obj.traverse(function (c) {
                    if (c.isMesh && c.geometry) {
                        mc++;
                        c.geometry.computeVertexNormals();
                        c.material = AK_METAL.clone();
                    }
                });
                obj.scale.set(scale, scale, scale);
                obj.rotation.y = Math.PI;
                obj.position.set(0, 0, 0);
                akRoot = obj;
                akReady = true;
                if (onModelReady) onModelReady(2);
                console.log('[model] AK47 OBJ 就绪, mesh:', mc);
            },
            function (p) { if (p && p.total > 0) console.log('[model] AK:', Math.round(p.loaded/p.total*100) + '%'); },
            function (err) { console.error('[model] AK47 OBJ 加载失败!', err); }
        );
    }).catch(function (e) { console.error('[model] OBJLoader import失败:', e.message); });
}, 500);

// ============================================================
// 匕首模型（优先GLB → 程序化fallback）
// ============================================================
export function buildKnifeModel() {
    if (daggerReady && daggerRoot) {
        var clone = daggerRoot.clone(true);
        clone.traverse(function (c) {
            if (c.isMesh && c.geometry) {
                c.material = BLADE_SILVER.clone();
            }
        });
        return clone;
    }
    var g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.20), BLADE_SILVER.clone()));
    return g;
}

// ============================================================
// AK47 模型（优先OBJ → 程序化fallback）
// ============================================================
export function buildAK47Model() {
    if (akReady && akRoot) {
        var clone = akRoot.clone(true);
        clone.traverse(function (c) {
            if (c.isMesh && c.geometry) {
                c.geometry.computeVertexNormals();
            }
        });
        return clone;
    }
    var g = new THREE.Group();
    var w = new THREE.MeshStandardMaterial({ color: 0x6b3a2e, roughness: 0.6 });
    var mt = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.3, metalness: 0.8 });
    var gy = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.4, metalness: 0.6 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.55), mt));
    var br = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.35, 8), gy); br.rotation.x = Math.PI / 2; br.position.set(0, 0.03, -0.42); g.add(br);
    var hg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.2), w); hg.position.set(0, -0.01, -0.1); g.add(hg);
    var mg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.06), mt); mg.position.set(0, -0.15, 0.05); mg.rotation.x = 0.25; g.add(mg);
    var st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.2), w); st.position.set(0, 0, 0.25); g.add(st);
    var gr = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), w); gr.position.set(0, -0.12, 0.15); gr.rotation.x = 0.3; g.add(gr);
    var sg = new THREE.CylinderGeometry(0.005, 0.005, 0.05, 4); var sf = new THREE.Mesh(sg, gy); sf.position.set(0, 0.06, -0.45); g.add(sf); var sr = new THREE.Mesh(sg, gy); sr.position.set(0, 0.06, 0.05); g.add(sr);
    var mz = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.01, 4, 8), gy); mz.position.set(0, 0.03, -0.59); g.add(mz);
    return g;
}

// ============================================================
// USP 手枪（优先GLB → 程序化fallback）
// ============================================================
export function buildUSPModel() {
    if (pistolReady && pistolRoot) {
        return pistolRoot.clone(true);
    }
    var g = new THREE.Group();
    var md = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.25, metalness: 0.85 });
    var mg = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.35, metalness: 0.65 });
    var gm = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.65 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.05, 0.22), md)); g.children[0].position.set(0, 0.028, -0.03);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.06, 8), mg)); g.children[1].rotation.x = Math.PI / 2; g.children[1].position.set(0, 0.028, -0.16);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.09, 0.04), gm)); g.children[2].position.set(0, -0.045, 0.04);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.012, 0.03), md)); g.children[3].position.set(0, -0.09, 0.04);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.018, 0.028), md)); g.children[4].position.set(0, -0.028, 0.065);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.01, 0.008), mg)); g.children[5].position.set(0, 0.058, -0.12);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.006, 0.008), mg)); g.children[6].position.set(0, 0.05, 0.04);
    return g;
}

// ============================================================
// 手雷（优先GLB → 程序化fallback）
// ============================================================
export function buildHandGrenadeModel() {
    if (grenadeReady && grenadeRoot) {
        return grenadeRoot.clone(true);
    }
    var g = new THREE.Group();
    var bm = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 0.4, metalness: 0.2 });
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.09, 8), bm)); g.children[0].position.set(0, 0.02, -0.28);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 4, 8), new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.3, metalness: 0.8 })));
    g.children[1].position.set(0, 0.07, -0.28); g.children[1].rotation.x = Math.PI / 2;
    return g;
}

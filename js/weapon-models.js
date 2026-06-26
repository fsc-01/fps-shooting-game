// weapon-models.js — GLB 匕首 + OBJ AK47 + GLB 手枪 + 程序化 Grenade

import * as THREE from 'three';

var texLoader = new THREE.TextureLoader();

// ============================================================
// 预加载压缩后的 diffuse 贴图（从原GLB提取，512px JPEG ~30-35KB）
// ============================================================
var pistolTex = texLoader.load('./textures/pistol_diff.jpg');
pistolTex.colorSpace = THREE.SRGBColorSpace;
var grenadeTex = texLoader.load('./textures/grenade_diff.jpg');
grenadeTex.colorSpace = THREE.SRGBColorSpace;

// ============================================================
// 材质预设
// ============================================================
var BLADE_SILVER  = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.2, metalness: 0.95, side: THREE.DoubleSide });
var AK_METAL      = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.35, metalness: 0.85 });
// 非金属PBR：metalness=0 让贴图颜色直接显示，不需要环境贴图
// color乘数提亮(0xdddddd)补偿纹理本身的暗色调
var PISTOL_METAL  = new THREE.MeshStandardMaterial({ map: pistolTex, color: 0xcccccc, roughness: 0.5, metalness: 0.05 });
var GRENADE_BODY  = new THREE.MeshStandardMaterial({ map: grenadeTex, color: 0xdddddd, roughness: 0.6, metalness: 0.0 });
var GRENADE_RING  = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.8 });

// ============================================================
// 路径
// ============================================================
var daggerPath  = './textures/dagger/dagger.glb';
var akObjPath   = './textures/AK47/AK_OBJ.obj';
var pistolPath  = './textures/pistol_geo.glb';
var grenadePath = './textures/grenade_geo.glb';

// 缓存
var daggerRoot  = null, daggerReady  = false;
var akRoot      = null, akReady      = false;
var pistolRoot  = null, pistolReady  = false;
var grenadeRoot = null, grenadeReady = false;

// 异步加载完成后的回调（weapon-manager 注入）
var onModelReady = null;
export function setModelReadyCallback(cb) { onModelReady = cb; }

// ============================================================
// 动态加载（不阻塞游戏启动）
// ============================================================
setTimeout(function () {
    // --- 匕首 (GLTFLoader) ---
    import('./loaders/GLTFLoader.js?v=703').then(function (mod) {
        var loader = new mod.GLTFLoader();
        loader.load(daggerPath,
            function (gltf) {
                var rm = [];
                gltf.scene.traverse(function (c) {
                    var n = (c.name || '').toLowerCase();
                    if (n.indexOf('scabbard') >= 0 || n === 'plane.013') rm.push(c);
                    if (c.isMesh && c.geometry) {
                        c.geometry.computeVertexNormals();
                        c.material = BLADE_SILVER.clone();
                    }
                });
                rm.forEach(function (c) { if (c.parent) c.parent.remove(c); });
                daggerRoot = gltf.scene;
                daggerReady = true;
                if (onModelReady) onModelReady(0);
                console.log('[model] 匕首 GLB 就绪, 通知刷新');
            },
            undefined,
            function (err) { console.warn('[model] 匕首加载失败, fallback方块刀', err); }
        );
        // --- 手枪 GLB (已剥离纹理，纯几何+代码PBR材质) ---
        loader.load(pistolPath,
            function (gltf) {
                var scene = gltf.scene;
                console.log('[model] 手枪 GLB 加载成功, 节点:', scene.children.length, '贴图:', pistolTex.image ? pistolTex.image.src : 'loading');
                // 居中 + 朝向修正：枪管GLTF+X → 游戏-Z
                scene.position.set(0, 0, 0);
                scene.rotation.y = Math.PI / 2;
                scene.traverse(function (c) {
                    if (c.isMesh && c.geometry) {
                        c.geometry.computeVertexNormals();
                        c.material = PISTOL_METAL.clone();
                    }
                });
                pistolRoot = scene;
                pistolReady = true;
                if (onModelReady) onModelReady(1);
                console.log('[model] 手枪 GLB 就绪, 通知刷新');
            },
            function (p) { if (p && p.total > 0) console.log('[model] 手枪加载:', Math.round(p.loaded/p.total*100) + '%'); },
            function (err) { console.error('[model] 手枪 GLB 加载失败!', err); }
        );

        // --- 手雷 GLB (已剥离纹理，纯几何+代码PBR材质) ---
        loader.load(grenadePath,
            function (gltf) {
                var scene = gltf.scene;
                console.log('[model] 手雷 GLB 加载成功');
                // 不旋转: 竖直柄上(NE)头下(SW), 自然握持, 完整可见
                scene.rotation.x = 0;
                scene.scale.set(1.0, 1.0, 1.0);
                scene.traverse(function (c) {
                    if (c.isMesh && c.geometry) {
                        c.geometry.computeVertexNormals();
                        // 根据mesh名区分身体/金属环（Blender导出保留原始名称）
                        var n = (c.name || '').toLowerCase();
                        if (n.indexOf('ring') >= 0 || n.indexOf('pin') >= 0 || n.indexOf('metal') >= 0) {
                            c.material = GRENADE_RING.clone();
                        } else {
                            c.material = GRENADE_BODY.clone();
                        }
                    }
                });
                grenadeRoot = scene;
                grenadeReady = true;
                // 注入 grenade.js
                setTimeout(function () {
                    import('./grenade.js?v=703').then(function (gm) {
                        if (gm.setGrenadeGLB) gm.setGrenadeGLB(grenadeRoot, true);
                    });
                }, 100);
                if (onModelReady) onModelReady(3);
                console.log('[model] 手雷 GLB 就绪, 通知刷新');
            },
            undefined,
            function (err) { console.error('[model] 手雷 GLB 加载失败!', err); }
        );

    }).catch(function (e) { console.warn('[model] GLTFLoader import失败:', e.message); });

    // --- AK47 (OBJLoader — 直接加载OBJ，不转GLB) ---
    import('./loaders/OBJLoader.js?v=703').then(function (mod) {
        var loader = new mod.OBJLoader();
        loader.load(akObjPath,
            function (obj) {
                console.log('[model] AK47 OBJ 加载成功, 子节点:', obj.children.length);
                // OBJ 原始尺寸: 最长轴(Z)≈192m → 缩放到0.88m
                var scale = 0.88 / 192.353;
                var mc = 0;
                obj.traverse(function (c) {
                    if (c.isMesh && c.geometry) {
                        mc++;
                        c.geometry.computeVertexNormals();
                        // 根据材质名分色（AK_OBJ.mtl 只有 Material01，全用金属）
                        c.material = AK_METAL.clone();
                    }
                });
                console.log('[model] AK47 mesh数:', mc, '缩放:', scale.toFixed(4));
                obj.scale.set(scale, scale, scale);
                // 枪管原朝+Z，游戏向前是-Z → 转180°
                obj.rotation.y = Math.PI;
                // 居中
                obj.position.set(0, 0, 0);
                akRoot = obj;
                akReady = true;
                if (onModelReady) onModelReady(2);
                console.log('[model] AK47 OBJ 就绪, 通知刷新');
            },
            function (p) { if (p && p.total > 0) console.log('[model] AK OBJ加载:', Math.round(p.loaded/p.total*100) + '%'); },
            function (err) { console.error('[model] AK47 OBJ 加载失败!', err); }
        );
    }).catch(function (e) { console.error('[model] OBJLoader import失败:', e.message, e.stack); });
}, 500);

// ============================================================
// 匕首模型（优先GLB → 程序化fallback）
// ============================================================
export function buildKnifeModel() {
    if (daggerReady && daggerRoot) {
        var clone = daggerRoot.clone(true);
        clone.traverse(function (c) {
            if (c.isMesh && c.geometry) {
                c.geometry.computeVertexNormals();
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
    // -- fallback: 程序化拼装 AK --
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
// USP 手枪（纯程序化）
// ============================================================
export function buildUSPModel() {
    if (pistolReady && pistolRoot) {
        // pistolRoot 已预制 rotation.y=-PI/2 + scale=1.6，直接 clone
        return pistolRoot.clone(true);
    }
    // fallback: 程序化方块手枪
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
    // fallback: 程序化
    var g = new THREE.Group();
    var bm = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 0.4, metalness: 0.2 });
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.09, 8), bm)); g.children[0].position.set(0, 0.02, -0.28);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 4, 8), new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.3, metalness: 0.8 })));
    g.children[1].position.set(0, 0.07, -0.28); g.children[1].rotation.x = Math.PI / 2;
    return g;
}

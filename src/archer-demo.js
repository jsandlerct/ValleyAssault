import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const ARCHER_PATH = '/assets/cubeworld/Characters/glTF/Character_Male_1.gltf';
const BOW_PATH    = '/assets/cubeworld/Tools/glTF/Pickaxe_Wood.gltf';
const ARCHER_H    = 1.5;
const BOW_LEN     = 1.1;  // total pickaxe length in world units after scaling (2× original)

// Pickaxe_Wood model bounds (from GLTF):
//   Y: -0.316 (handle tip) → 1.398 (head tip), total 1.714
//   X: ±0.608 (head lateral spread = bow limbs)
//   Z: ±0.158 (thin depth)
//
// Crossbow orientation — limbs spread left/right, stock points backward.
// Rx(π/2) alone does the job:
//   model X → world X  (bow limbs extend left/right ✓)
//   model Y → world +Z (stock backward at −Y, head/limbs forward at +Y ✓)
//   model Z → world −Y (thin dimension faces slightly downward, stock lies flat ✓)
const BOW_WORLD_QUAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));

// Pickaxe_Wood model: head spans roughly y=0.75→1.40, midpoint ≈ y=1.075.
// After scaling to BOW_LEN, headMidOffset = 1.075 / 1.714 * BOW_LEN ≈ 0.69.
// We slide the bow origin backward by this amount so the hand lands at the
// midpoint of the curved head piece.
const HEAD_MID_MODEL_Y = 1.075;  // model-space Y of head midpoint (unscaled)

// ── Renderer ──────────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ── Scene ─────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x4a6070);
scene.fog = new THREE.Fog(0x4a6070, 12, 35);

// ── Camera + Controls ─────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(1.8, 1.4, 2.8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.75, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.0;
controls.maxDistance = 10;
controls.update();

// ── Lighting ──────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xfff4e0, 0.55));

const hemi = new THREE.HemisphereLight(0x88aaff, 0x443322, 0.35);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.position.set(6, 12, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far  = 30;
sun.shadow.camera.left = sun.shadow.camera.bottom = -6;
sun.shadow.camera.right = sun.shadow.camera.top  =  6;
scene.add(sun);

const rim = new THREE.DirectionalLight(0xaabbff, 0.4);
rim.position.set(-4, 3, -5);
scene.add(rim);

// ── Ground ────────────────────────────────────────────────────────────────────
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshLambertMaterial({ color: 0x3d6640 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(20, 20, 0x000000, 0x000000);
grid.position.y = 0.002;
grid.material.opacity = 0.08;
grid.material.transparent = true;
scene.add(grid);

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeModel(model, targetH) {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);

    const box = new THREE.Box3();
    model.traverse(c => {
        if (c.isMesh && c.geometry) {
            c.geometry.computeBoundingBox();
            box.union(c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld));
        }
    });
    if (box.isEmpty()) box.setFromObject(model);

    const sy = box.getSize(new THREE.Vector3()).y;
    if (sy === 0) return;
    model.scale.setScalar(targetH / sy);
    model.updateMatrixWorld(true);

    const box2 = new THREE.Box3();
    model.traverse(c => {
        if (c.isMesh && c.geometry) {
            box2.union(c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld));
        }
    });
    if (!box2.isEmpty()) model.position.y = -box2.min.y;
    model.updateMatrixWorld(true);
}

// ── Animation UI ──────────────────────────────────────────────────────────────
function buildAnimButtons(containerId, mixer, clips, defaultName) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    if (clips.length === 0) {
        container.innerHTML = '<em style="font-size:11px;opacity:.4">no clips</em>';
        return;
    }

    let activeBtn = null;

    const playClip = (clip, btn) => {
        mixer.stopAllAction();
        mixer.clipAction(clip).reset().setLoop(THREE.LoopRepeat).play();
        if (activeBtn) activeBtn.classList.remove('active');
        btn.classList.add('active');
        activeBtn = btn;
    };

    clips.forEach(clip => {
        const btn = document.createElement('button');
        btn.textContent = clip.name || 'Anim';
        btn.title = `Duration: ${clip.duration.toFixed(2)}s`;
        btn.onclick = () => playClip(clip, btn);
        container.appendChild(btn);
    });

    const target = clips.find(c => c.name.toLowerCase() === defaultName.toLowerCase())
                ?? clips[0];
    const targetBtn = [...container.querySelectorAll('button')]
        .find(b => b.textContent === target.name) ?? container.querySelector('button');
    if (targetBtn) targetBtn.click();
}

// ── State ─────────────────────────────────────────────────────────────────────
const mixers = [];
let bowBone  = null;
let bowMesh  = null;
let bowScale = 1;       // world units per model Y unit after scaling

// headMidOffset: how far along the bow's local +Z (model Y mapped to world Z)
// the head midpoint sits from the model origin, in world units.
// We slide the bow mesh backward by this amount so the hand lands at the midpoint.
let headMidOffset = 0;

const _bonePos  = new THREE.Vector3();
const _boneQuat = new THREE.Quaternion();

// ── Load & assemble ────────────────────────────────────────────────────────────
const loader = new GLTFLoader();

async function loadArcher() {
    const [archerGltf, bowGltf] = await Promise.all([
        new Promise((res, rej) => loader.load(ARCHER_PATH, res, undefined, rej)),
        new Promise((res, rej) => loader.load(BOW_PATH,    res, undefined, rej)),
    ]);

    // ── Archer ────────────────────────────────────────────────────────────────
    const archer = SkeletonUtils.clone(archerGltf.scene);
    archer.traverse(c => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
            // Steel-blue tint for the wall defender look
            const applyArmor = mat => {
                const m = mat.clone();
                m.color.set(0x8898b0);
                if (m.emissive) m.emissive.set(0x1e2a38);
                if (m.metalness !== undefined) { m.metalness = 0.8; m.roughness = 0.3; }
                return m;
            };
            c.material = Array.isArray(c.material) ? c.material.map(applyArmor) : applyArmor(c.material);
        }
    });
    normalizeModel(archer, ARCHER_H);
    scene.add(archer);

    // ── Bow (Pickaxe_Wood) ────────────────────────────────────────────────────
    const bow = bowGltf.scene.clone();

    // Scale so total pickaxe length (model Y extent = 1.714) equals BOW_LEN
    const MODEL_Y_EXTENT = 1.714;
    bowScale = BOW_LEN / MODEL_Y_EXTENT;
    bow.scale.setScalar(bowScale);

    // Compute head-midpoint offset in world units
    headMidOffset = HEAD_MID_MODEL_Y * bowScale;

    bow.traverse(c => {
        if (!c.isMesh) return;
        c.castShadow = true;
        // Warm wood tone
        c.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x8b5e3c),
            roughness: 0.75,
            metalness: 0.05,
        });
    });

    bowMesh = bow;
    scene.add(bow);

    // Archers hold the crossbow in their RIGHT hand.
    // Character_Male_1 uses "FistR"/"FistL" (GLTFLoader strips dots from "Fist.R"/"Fist.L").
    const preferredOrder = ['FistR', 'Fist.R', 'HandR', 'Hand.R', 'FistL', 'Fist.L', 'HandL', 'Hand.L'];
    for (const name of preferredOrder) {
        archer.traverse(obj => { if (obj.name === name && !bowBone) bowBone = obj; });
        if (bowBone) break;
    }

    // Build hand-selector buttons so the user can switch grip bone
    buildHandButtons(archer);

    // Apply orientation regardless of whether bone tracking works
    bow.quaternion.copy(BOW_WORLD_QUAT);

    if (!bowBone) {
        console.warn('No hand bone found — bow placed at fixed position');
        bow.position.set(0.35, ARCHER_H * 0.60, -0.3);
    }

    // ── Animations ────────────────────────────────────────────────────────────
    const archerMixer = new THREE.AnimationMixer(archer);
    mixers.push(archerMixer);

    buildAnimButtons('archer-anims', archerMixer, archerGltf.animations ?? [], 'Idle_Hold');

    const clipNames = (archerGltf.animations ?? []).map(c => c.name).join(', ') || 'none';
    setStatus(`Loaded · ${(archerGltf.animations ?? []).length} clips: ${clipNames} · Bone: ${bowBone?.name ?? 'fixed'}`);
}

function buildHandButtons(archer) {
    const container = document.getElementById('hand-buttons');
    container.innerHTML = '';

    const candidates = [];
    archer.traverse(obj => {
        if (/fist|hand/i.test(obj.name)) candidates.push(obj);
    });

    if (candidates.length === 0) {
        container.innerHTML = '<em style="font-size:11px;opacity:.4">no hand bones</em>';
        return;
    }

    let activeBtn = null;
    candidates.forEach(bone => {
        const btn = document.createElement('button');
        btn.textContent = bone.name;
        btn.onclick = () => {
            bowBone = bone;
            if (activeBtn) activeBtn.classList.remove('active');
            btn.classList.add('active');
            activeBtn = btn;
        };
        container.appendChild(btn);
        if (bone === bowBone) { btn.classList.add('active'); activeBtn = btn; }
    });
}

function setStatus(msg) {
    document.getElementById('status').textContent = msg;
}

loadArcher().catch(err => {
    console.error(err);
    setStatus('Error: ' + err.message);
});

// ── Resize ────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

// ── Render loop ───────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

(function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    for (const m of mixers) m.update(dt);

    if (bowBone && bowMesh) {
        bowBone.getWorldPosition(_bonePos);

        // Fixed world orientation: bow always aims forward (+Z = toward enemy wall).
        // After BOW_WORLD_QUAT, model +Y → world +Z, so bowFwd = (0,0,1).
        bowMesh.quaternion.copy(BOW_WORLD_QUAT);

        // Slide origin backward so the hand sits at the head midpoint.
        // bowFwd = (0,0,1) after the fixed rotation, so we shift -headMidOffset in Z.
        bowMesh.position.copy(_bonePos);
        bowMesh.position.z -= headMidOffset;
    }

    controls.update();
    renderer.render(scene, camera);
})();

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const HORSE_PATH  = '/assets/cubeworld/Animals/glTF/Horse.gltf';
const RIDER_PATH  = '/assets/cubeworld/Characters/glTF/Character_Male_2.gltf';
const SWORD_PATH  = '/assets/cubeworld/Tools/glTF/Sword_Stone.gltf';
const HORSE_H     = 1.4;   // normalized horse height (world units)
const RIDER_H     = 0.82;  // normalized rider height
const SILVER      = new THREE.Color(0xd8e0ec);
const SADDLE_FRAC = 0.50;  // rider feet embed at ~50% horse height so legs are inside the horse

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
camera.position.set(3.5, 2.2, 4.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.5;
controls.maxDistance = 12;
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

// Rim light to make the silver pop
const rim = new THREE.DirectionalLight(0xaabbff, 0.5);
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

// subtle grid overlay
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
    if (sy === 0) return box;
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
    return box2;
}

function getMeshBox(model) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    model.traverse(c => {
        if (c.isMesh && c.geometry) {
            box.union(c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld));
        }
    });
    return box;
}

function applySilver(model) {
    // Replace materials with a flat MeshStandardMaterial in silver so the tint
    // is unmistakable regardless of the source material type.
    model.traverse(c => {
        if (!c.isMesh) return;
        c.castShadow = true;
        c.receiveShadow = true;
        const makeSilver = () => new THREE.MeshStandardMaterial({
            color: SILVER,
            metalness: 0.6,
            roughness: 0.3,
        });
        c.material = Array.isArray(c.material) ? c.material.map(makeSilver) : makeSilver();
    });
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

    clips.forEach((clip) => {
        const btn = document.createElement('button');
        btn.textContent = clip.name || 'Anim';
        btn.title = `Duration: ${clip.duration.toFixed(2)}s`;
        btn.onclick = () => playClip(clip, btn);
        container.appendChild(btn);
    });

    // Auto-play the requested default, falling back to the first clip
    const target = clips.find(c => c.name.toLowerCase() === defaultName.toLowerCase())
                ?? clips[0];
    const targetBtn = [...container.querySelectorAll('button')]
        .find(b => b.textContent === target.name) ?? container.querySelector('button');
    if (targetBtn) targetBtn.click();
}

// ── Load & assemble the knight ────────────────────────────────────────────────
const loader    = new GLTFLoader();
const mixers    = [];
let   swordBone = null;   // bone whose world transform the sword tracks each frame
let   swordMesh = null;   // the sword object (scene child, not bone child)
// Rotation applied on top of the bone's world quaternion — blade along bone's local -Z
const SWORD_ROT = new THREE.Quaternion(); // identity — blade follows forearm direction

async function loadKnight() {
    const [horseGltf, riderGltf, swordGltf] = await Promise.all([
        new Promise((res, rej) => loader.load(HORSE_PATH, res, undefined, rej)),
        new Promise((res, rej) => loader.load(RIDER_PATH, res, undefined, rej)),
        new Promise((res, rej) => loader.load(SWORD_PATH, res, undefined, rej)),
    ]);

    // ── Horse ─────────────────────────────────────────────────────────────────
    const horse = SkeletonUtils.clone(horseGltf.scene);
    horse.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    normalizeModel(horse, HORSE_H);
    scene.add(horse);

    const horseBounds = getMeshBox(horse);
    const saddleY     = horseBounds.min.y + (horseBounds.max.y - horseBounds.min.y) * SADDLE_FRAC;

    // ── Rider (knight) ────────────────────────────────────────────────────────
    const rider = SkeletonUtils.clone(riderGltf.scene);
    normalizeModel(rider, RIDER_H);
    applySilver(rider);

    // Feet start at y=0 after normalize; lift to saddle height
    rider.position.y += saddleY;

    // Small forward Z nudge so rider is centered in the saddle area
    rider.position.z += 0.02;

    scene.add(rider);

    // ── Sword — attach to rider's right hand bone ─────────────────────────────
    const sword = swordGltf.scene.clone();

    // Normalize sword to ~0.38 world units length
    {
        const box = new THREE.Box3().setFromObject(sword);
        const len = box.getSize(new THREE.Vector3()).y || 1;
        sword.scale.setScalar(0.38 / len);
    }
    // Silver/steel material to match knight
    sword.traverse(c => {
        if (!c.isMesh) return;
        c.castShadow = true;
        c.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xe8eef8), metalness: 0.85, roughness: 0.15 });
    });

    // Find the right-fist bone and track its world transform each frame.
    // NOTE: GLTFLoader sanitizes node names via PropertyBinding.sanitizeNodeName,
    // which STRIPS dots — so Blender's "Fist.R" becomes "FistR" in the scene graph.
    rider.traverse(obj => {
        const n = obj.name.toLowerCase().replace(/[^a-z]/g, ''); // "fist.r" -> "fistr"
        if (!swordBone && (n === 'fistr' || n === 'handr')) swordBone = obj;
    });
    swordMesh = sword;
    scene.add(sword);
    if (swordBone) {
        console.log('Sword tracking bone:', swordBone.name);
    } else {
        console.warn('Right-fist bone not found — sword placed at fixed position');
        sword.position.set(0.2, saddleY + RIDER_H * 0.65, 0);
    }

    // ── Animations ────────────────────────────────────────────────────────────
    const horseMixer = new THREE.AnimationMixer(horse);
    const riderMixer = new THREE.AnimationMixer(rider);
    mixers.push(horseMixer, riderMixer);

    buildAnimButtons('horse-anims', horseMixer, horseGltf.animations ?? [], 'Run');
    buildAnimButtons('rider-anims', riderMixer, riderGltf.animations ?? [], 'Idle_Attack');

    setStatus(`Loaded · Horse: ${(horseGltf.animations ?? []).length} clips · Rider: ${(riderGltf.animations ?? []).length} clips`);
}

function setStatus(msg) {
    document.getElementById('status').textContent = msg;
}

loadKnight().catch(err => {
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
const _bonePos = new THREE.Vector3();
const _boneQuat = new THREE.Quaternion();
(function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    for (const m of mixers) m.update(dt);

    // Snap sword to fist bone world transform each frame
    if (swordBone && swordMesh) {
        swordBone.getWorldPosition(_bonePos);
        swordBone.getWorldQuaternion(_boneQuat);
        swordMesh.quaternion.copy(_boneQuat).multiply(SWORD_ROT);
        // Offset sword along blade axis so the grip sits closer in the fist
        const fwd = new THREE.Vector3(0, 0.04, 0).applyQuaternion(swordMesh.quaternion);
        swordMesh.position.copy(_bonePos).add(fwd);
    }

    controls.update();
    renderer.render(scene, camera);
})();

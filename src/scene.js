import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { CONFIG, SCENE } from './constants.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(SCENE.SKY_COLOR);
scene.fog = new THREE.Fog(SCENE.SKY_COLOR, SCENE.FOG_NEAR, SCENE.FOG_FAR);

export const camera = new THREE.PerspectiveCamera(
    SCENE.CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    SCENE.CAMERA_NEAR,
    SCENE.CAMERA_FAR
);
camera.position.set(CONFIG.CAMERA_POS.x, CONFIG.CAMERA_POS.y, CONFIG.CAMERA_POS.z);
camera.lookAt(CONFIG.CAMERA_TARGET.x, CONFIG.CAMERA_TARGET.y, CONFIG.CAMERA_TARGET.z);

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.insertBefore(renderer.domElement, document.body.firstChild);

export const css2dRenderer = new CSS2DRenderer();
css2dRenderer.setSize(window.innerWidth, window.innerHeight);
css2dRenderer.domElement.style.position = 'absolute';
css2dRenderer.domElement.style.top = '0';
css2dRenderer.domElement.style.left = '0';
css2dRenderer.domElement.style.pointerEvents = 'none';
css2dRenderer.domElement.id = 'css2d-layer';
document.body.insertBefore(css2dRenderer.domElement, document.getElementById('hud'));

export const mixers = new Set();

// ── Lighting ──────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(SCENE.AMBIENT_COLOR, SCENE.AMBIENT_INTENSITY);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(SCENE.SUN_COLOR, SCENE.SUN_INTENSITY);
sunLight.position.set(SCENE.SUN_POS.x, SCENE.SUN_POS.y, SCENE.SUN_POS.z);
sunLight.castShadow = true;
sunLight.shadow.camera.left   = -SCENE.SHADOW_EXTENT_H;
sunLight.shadow.camera.right  =  SCENE.SHADOW_EXTENT_H;
sunLight.shadow.camera.top    =  SCENE.SHADOW_EXTENT_V;
sunLight.shadow.camera.bottom = -SCENE.SHADOW_EXTENT_V;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.bias = -0.001;
scene.add(sunLight);

const hemiLight = new THREE.HemisphereLight(SCENE.HEMI_SKY, SCENE.HEMI_GROUND, SCENE.HEMI_INTENSITY);
scene.add(hemiLight);

// ── Ground ────────────────────────────────────────────────────────────────────
function makePixelTexture(palette, repeatX, repeatY) {
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = Math.abs((x * 7 + y * 13) ^ (x * 3 + y * 5)) % palette.length;
            ctx.fillStyle = palette[idx];
            ctx.fillRect(x, y, 1, 1);
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    return tex;
}

const grassPalette = [
    '#5a9e30', '#4e8a28', '#3d7220', '#68aa3c',
    '#50922e', '#427820', '#62a438', '#3a6a1c',
    '#5c9c32', '#467228', '#72b040', '#3e6e22',
    '#488028', '#5e9e34', '#406820', '#6aac3e',
];

const dirtPalette = [
    '#7a5230', '#6b4525', '#8a5e38', '#5e3a1c',
    '#7c5535', '#6e4828', '#845a32', '#60401e',
    '#785028', '#8c6040', '#644020', '#7e5535',
    '#6a4a28', '#865e3a', '#5c3c1c', '#7a5030',
];

// Front (player side): Z from -25 to +35, depth=60, center at Z=+5
const frontGeo = new THREE.PlaneGeometry(SCENE.GROUND_W, 60);
const frontMat = new THREE.MeshStandardMaterial({ map: makePixelTexture(grassPalette, 16, 10), roughness: 0.9, metalness: 0 });
const frontGround = new THREE.Mesh(frontGeo, frontMat);
frontGround.rotation.x = -Math.PI / 2;
frontGround.position.z = 5;
frontGround.receiveShadow = true;
scene.add(frontGround);

// Back (beyond wall): Z from -35 to -25, depth=10, center at Z=-30
const backGeo = new THREE.PlaneGeometry(SCENE.GROUND_W, 10);
const backMat = new THREE.MeshStandardMaterial({ map: makePixelTexture(dirtPalette, 16, 2), roughness: 1.0, metalness: 0 });
const backGround = new THREE.Mesh(backGeo, backMat);
backGround.rotation.x = -Math.PI / 2;
backGround.position.z = -30;
backGround.receiveShadow = true;
scene.add(backGround);

// ── Resize handler ────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    css2dRenderer.setSize(window.innerWidth, window.innerHeight);
});

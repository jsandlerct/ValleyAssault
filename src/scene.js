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
const groundGeo = new THREE.PlaneGeometry(SCENE.GROUND_W, SCENE.GROUND_D);
const groundMat = new THREE.MeshStandardMaterial({ color: SCENE.GROUND_COLOR, roughness: 0.9, metalness: 0 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ── Resize handler ────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    css2dRenderer.setSize(window.innerWidth, window.innerHeight);
});

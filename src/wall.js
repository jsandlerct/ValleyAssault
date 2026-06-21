import * as THREE from 'three';
import { CONFIG, WALL, PATHS } from './constants.js';
import { scene } from './scene.js';
import { createSectionLabel } from './ui-3d.js';
import { game } from './game.js';

// Procedural stone brick texture baked into a canvas.
function makeStoneTexture() {
    const sz = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = sz;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#92897C';
    ctx.fillRect(0, 0, sz, sz);

    const img = ctx.getImageData(0, 0, sz, sz);
    const d   = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 38;
        d[i]   = Math.max(0, Math.min(255, d[i]   + n));
        d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
        d[i+2] = Math.max(0, Math.min(255, d[i+2] + n * 0.8));
    }
    ctx.putImageData(img, 0, 0);

    const bH = 32, bW = 64;
    ctx.strokeStyle = 'rgba(40,35,30,0.55)';
    ctx.lineWidth   = 3;
    for (let row = 0; row <= sz / bH; row++) {
        const y      = row * bH;
        const offset = (row % 2) * (bW / 2);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sz, y); ctx.stroke();
        for (let col = -1; col <= sz / bW + 1; col++) {
            const x = col * bW + offset;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + bH); ctx.stroke();
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 3);
    return tex;
}

const stoneTex = makeStoneTexture();
const stoneMat = new THREE.MeshStandardMaterial({
    map:       stoneTex,
    roughness: 0.92,
    metalness: 0.02,
});

function applyStone(model) {
    model.traverse(c => {
        if (c.isMesh) {
            c.material      = stoneMat;
            c.castShadow    = true;
            c.receiveShadow = true;
        }
    });
}

function cloneWall(cache, path, rx = WALL.SX, ry = WALL.SY, rz = WALL.SZ) {
    const model = cache.clone(path);
    model.scale.set(rx, ry, rz);
    model.updateMatrixWorld(true);

    const box = new THREE.Box3();
    model.traverse(c => {
        if (c.isMesh && c.geometry) {
            c.geometry.computeBoundingBox();
            const mb = c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld);
            box.union(mb);
        }
    });
    if (!box.isEmpty()) model.position.y = -box.min.y;
    applyStone(model);
    return model;
}

function scaledWidth(cache, path, scaleX = WALL.SX) {
    const model = cache.clone(path);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    return box.getSize(new THREE.Vector3()).x * scaleX || 2.0;
}

function makeRubble(group) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x7A7060, roughness: 0.95, metalness: 0 });
    for (let i = 0; i < 22; i++) {
        const w = 0.25 + Math.random() * 0.7;
        const h = 0.15 + Math.random() * 0.5;
        const d = 0.2  + Math.random() * 0.6;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(
            (Math.random() - 0.5) * 7,
            h / 2 + Math.random() * 0.2,
            Math.random() * 3.5 - 0.5
        );
        mesh.rotation.set(
            (Math.random() - 0.5) * 1.0,
            Math.random() * Math.PI * 2,
            (Math.random() - 0.5) * 1.0
        );
        mesh.castShadow = true;
        group.add(mesh);
    }
}

export class WallSection {
    #hp           = CONFIG.SECTION_HP;
    maxHp         = CONFIG.SECTION_HP;
    labelDirty    = true;
    breached      = false;
    engagedSquads = [];
    label         = null;
    group         = null;
    closedGate    = null;
    openGate      = null;

    get hp()  { return this.#hp; }
    set hp(v) { this.#hp = v; this.labelDirty = true; }

    constructor(id) {
        this.id    = id;
        this.group = new THREE.Group();
        scene.add(this.group);
    }

    breach() {
        if (this.breached) return;
        this.breached = true;
        this.hp       = 0;

        if (this.closedGate) this.closedGate.visible = false;
        if (this.openGate)   this.openGate.visible   = false;

        makeRubble(this.group);

        if (this.label) this.label.element.classList.add('breached');

        for (const squad of this.engagedSquads) {
            if (squad.order === 'engaged') squad.order = 'idle';
        }

        game.checkBreach();
    }
}

export function buildWall(cache, wallSections) {
    const segW   = scaledWidth(cache, PATHS.WALL,        WALL.SX);
    const towerW = scaledWidth(cache, PATHS.TOWER,       WALL.SX);
    const gateW  = scaledWidth(cache, PATHS.DOOR_CLOSED, WALL.SX);

    const halfSpan  = 10;
    const fillWidth = halfSpan - towerW - gateW / 2;
    const numSegs   = Math.max(1, Math.round(fillWidth / segW));
    const actualSeg = numSegs > 0 ? fillWidth / numSegs : segW;

    for (const section of wallSections) {
        const group = section.group;
        group.position.set(CONFIG.SECTION_X[section.id], 0, CONFIG.WALL_Z);

        // ── Left corner tower ──
        const lt = cloneWall(cache, PATHS.TOWER);
        lt.position.x = -halfSpan + towerW / 2;
        group.add(lt);

        // ── Right corner tower ──
        const rt = cloneWall(cache, PATHS.TOWER);
        rt.position.x = halfSpan - towerW / 2;
        rt.rotation.y = Math.PI;
        group.add(rt);

        // ── Wall segments left side ──
        if (numSegs > 0 && fillWidth > 0) {
            const leftStart = -halfSpan + towerW;
            for (let i = 0; i < numSegs; i++) {
                const seg = cloneWall(cache, PATHS.WALL);
                seg.position.x = leftStart + (i + 0.5) * actualSeg;
                group.add(seg);
            }

            // ── Wall segments right side ──
            const rightStart = halfSpan - towerW;
            for (let i = 0; i < numSegs; i++) {
                const seg = cloneWall(cache, PATHS.WALL);
                seg.position.x = rightStart - (i + 0.5) * actualSeg;
                group.add(seg);
            }
        }

        // ── Backing fill — solid boxes behind segment tiles to seal any gaps ──
        const wallH  = WALL.SY * 0.526 + 0.5;
        const fillW  = halfSpan - gateW / 2;
        const fillCX = (halfSpan + gateW / 2) / 2;
        const backGeo = new THREE.BoxGeometry(fillW, wallH, 0.3);
        const backL   = new THREE.Mesh(backGeo, stoneMat);
        backL.position.set(-fillCX, wallH / 2, -0.15);
        backL.receiveShadow = true;
        group.add(backL);
        const backR = new THREE.Mesh(backGeo, stoneMat);
        backR.position.set( fillCX, wallH / 2, -0.15);
        backR.receiveShadow = true;
        group.add(backR);

        // ── Gate — closed/open pair at center ──
        const closedGate = cloneWall(cache, PATHS.DOOR_CLOSED);
        closedGate.position.x = 0;
        closedGate.visible    = true;
        group.add(closedGate);
        section.closedGate = closedGate;

        const openGate = cloneWall(cache, PATHS.DOOR_OPEN);
        openGate.position.x = 0;
        openGate.visible    = false;
        group.add(openGate);
        section.openGate = openGate;

        // ── CSS2D health label ──
        createSectionLabel(section);
    }
}

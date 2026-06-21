import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { SETUP, TOTAL_UNITS } from './constants.js';
import { mixers } from './scene.js';


const ZONE_IDS     = ['autoL', 'autoC', 'autoR', 'resL', 'resC', 'resR', 'pool'];
const AUTO_IDS     = ['autoL', 'autoC', 'autoR'];
const RESERVE_IDS  = ['resL', 'resC', 'resR'];
const BATTLE_IDS   = ['autoL', 'autoC', 'autoR', 'resL', 'resC', 'resR'];

const PAD_Y       = 0.02;   // just above ground
const GRID_SPACE  = 1.2;

export class SetupScreen {
    // Called when player confirms; receives (zoneUnits, autoTargets)
    onConfirm = null;

    #scene;
    #camera;
    #controls;
    #renderer;
    #pools;       // { orc, goblin, ogre }

    // zone id → Set<unit>
    #zones = new Map();

    // unit → zone id
    #unitZone = new Map();

    // zone pads: zone id → THREE.Mesh
    #pads = new Map();

    // zone labels: zone id → CSS2DObject
    #labels = new Map();

    // drag state
    #dragging    = null;
    #dragOrigin  = null;
    #hoveredZone = null;
    #groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    #ray         = new THREE.Raycaster();
    #mouse       = new THREE.Vector2();
    #intersectPt = new THREE.Vector3();

    // bound handlers stored so we can remove them
    #onMouseDown;
    #onMouseMove;
    #onMouseUp;
    #onAssignAll;
    #onStartBattle;

    // DOM
    #overlay;
    #unassignedNum;
    #startBtn;
    #warning;
    #warnTimer  = null;
    #unitCounts;

    constructor(scene, camera, controls, renderer, pools, unitCounts = TOTAL_UNITS) {
        this.#scene      = scene;
        this.#camera     = camera;
        this.#controls   = controls;
        this.#renderer   = renderer;
        this.#pools      = pools;
        this.#unitCounts = unitCounts;

        // Initialize zone sets
        for (const id of ZONE_IDS) this.#zones.set(id, new Set());

        this.#buildPads();
        this.#spawnUnits();
        this.#setupDOM();
        this.#bindEvents();
        this.#updateCamera();
    }

    // ── Camera ────────────────────────────────────────────────────────────────

    #updateCamera() {
        const p = SETUP.SETUP_CAMERA_POS;
        const t = SETUP.SETUP_CAMERA_TARGET;
        this.#camera.position.set(p.x, p.y, p.z);
        this.#controls.target.set(t.x, t.y, t.z);
        this.#controls.update();
    }

    // ── Zone pads ─────────────────────────────────────────────────────────────

    #buildPads() {
        for (const [id, def] of Object.entries(SETUP.ZONES)) {
            const color = def.isAuto ? SETUP.PAD_COLORS.auto
                        : id === 'pool' ? SETUP.PAD_COLORS.pool
                        : SETUP.PAD_COLORS.reserve;

            const geo  = new THREE.PlaneGeometry(def.padW, def.padD);
            const mat  = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.35,
                depthWrite: false,
                side: THREE.DoubleSide,
            });
            const pad = new THREE.Mesh(geo, mat);
            pad.rotation.x = -Math.PI / 2;
            pad.position.set(def.x, PAD_Y, def.z);
            pad.userData.zoneId = id;
            this.#scene.add(pad);
            this.#pads.set(id, pad);

            // CSS2D label above the pad
            const div  = document.createElement('div');
            div.className   = 'zone-label';
            div.textContent = def.label;
            const label = new CSS2DObject(div);
            label.position.set(def.x, 0.1, def.z - def.padD / 2 - 0.3);
            this.#scene.add(label);
            this.#labels.set(id, label);
        }
    }

    // ── Spawn units into the pool zone ────────────────────────────────────────

    #spawnUnits() {
        const poolDef = SETUP.ZONES.pool;

        // Build a flat list ordered by type then index
        const toSpawn = [];
        for (const [unitType, count] of Object.entries(this.#unitCounts)) {
            for (let i = 0; i < count; i++) toSpawn.push(unitType);
        }

        const cols = Math.ceil(Math.sqrt(toSpawn.length));
        for (let i = 0; i < toSpawn.length; i++) {
            const unitType = toSpawn[i];
            const pool     = this.#pools[unitType];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x   = poolDef.x + (col - (cols - 1) / 2) * GRID_SPACE;
            const z   = poolDef.z + (row - (Math.ceil(toSpawn.length / cols) - 1) / 2) * GRID_SPACE;

            const unit = pool.spawn(1, new THREE.Vector3());
            if (!unit) continue;
            unit.unitType = unitType;
            unit.pool     = pool;
            unit.model.position.set(x, unit.yOffset, z);
            pool.playIdle(unit);

            this.#zones.get('pool').add(unit);
            this.#unitZone.set(unit, 'pool');
        }
    }

    // ── DOM wiring ────────────────────────────────────────────────────────────

    #setupDOM() {
        this.#overlay      = document.getElementById('setup-overlay');
        this.#unassignedNum = document.getElementById('unassigned-num');
        this.#startBtn     = document.getElementById('start-battle-btn');
        this.#warning      = document.getElementById('setup-warning');

        this.#overlay.style.display = 'block';
        this.#updateCounter();

        this.#onAssignAll  = () => this.#assignAll();
        this.#onStartBattle = () => this.#startBattle();
        document.getElementById('assign-all-btn').addEventListener('click', this.#onAssignAll);
        this.#startBtn.addEventListener('click', this.#onStartBattle);
    }

    #updateCounter() {
        const n = this.#zones.get('pool').size;
        this.#unassignedNum.textContent = n;
        this.#startBtn.disabled = n > 0;
        this.#startBtn.classList.toggle('ready', n === 0);
    }

    #showWarning(msg) {
        this.#warning.textContent = msg;
        this.#warning.style.display = 'block';
        clearTimeout(this.#warnTimer);
        this.#warnTimer = setTimeout(() => {
            this.#warning.style.display = 'none';
        }, 2200);
    }

    // ── Assign All ────────────────────────────────────────────────────────────

    #assignAll() {
        const pool   = this.#zones.get('pool');
        const units  = [...pool];
        if (units.length === 0) return;

        // Separate by type
        const ogres   = units.filter(u => u.unitType === 'ogre');
        const others  = units.filter(u => u.unitType !== 'ogre');

        // Distribute ogres round-robin across auto squads only
        for (let i = 0; i < ogres.length; i++) {
            const target = AUTO_IDS[i % AUTO_IDS.length];
            this.#moveUnit(ogres[i], target);
        }

        // Distribute orcs/goblins round-robin across all 6 battle zones
        for (let i = 0; i < others.length; i++) {
            const target = BATTLE_IDS[i % BATTLE_IDS.length];
            this.#moveUnit(others[i], target);
        }

        // Repack all zones
        for (const id of ZONE_IDS) this.#packZone(id);
        this.#updateCounter();
    }

    // ── Move a unit between zones (no repack — caller must repack) ────────────

    #moveUnit(unit, targetZoneId) {
        const from = this.#unitZone.get(unit);
        if (from === targetZoneId) return;
        this.#zones.get(from)?.delete(unit);
        this.#zones.get(targetZoneId).add(unit);
        this.#unitZone.set(unit, targetZoneId);
    }

    // ── Formation packing ────────────────────────────────────────────────────

    #packZone(id) {
        const def   = SETUP.ZONES[id];
        const units = [...this.#zones.get(id)];
        if (units.length === 0) return;

        const cols = Math.max(1, Math.ceil(Math.sqrt(units.length)));
        const rows = Math.ceil(units.length / cols);
        for (let i = 0; i < units.length; i++) {
            const unit = units[i];
            if (unit === this.#dragging) continue;  // don't move the dragged unit
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = def.x + (col - (cols - 1) / 2) * GRID_SPACE;
            const z = def.z + (row - (rows - 1) / 2) * GRID_SPACE;
            unit.model.position.set(x, unit.yOffset, z);
        }
    }

    // ── Drag-and-drop ─────────────────────────────────────────────────────────

    #bindEvents() {
        const canvas = this.#renderer.domElement;
        this.#onMouseDown = (e) => this.#handleMouseDown(e);
        this.#onMouseMove = (e) => this.#handleMouseMove(e);
        this.#onMouseUp   = (e) => this.#handleMouseUp(e);
        canvas.addEventListener('mousedown', this.#onMouseDown);
        canvas.addEventListener('mousemove', this.#onMouseMove);
        canvas.addEventListener('mouseup',   this.#onMouseUp);
    }

    #removeEvents() {
        const canvas = this.#renderer.domElement;
        canvas.removeEventListener('mousedown', this.#onMouseDown);
        canvas.removeEventListener('mousemove', this.#onMouseMove);
        canvas.removeEventListener('mouseup',   this.#onMouseUp);
    }

    #toNDC(event) {
        const rect = this.#renderer.domElement.getBoundingClientRect();
        this.#mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
        this.#mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
    }

    #handleMouseDown(event) {
        if (event.button !== 0) return;
        this.#toNDC(event);
        this.#ray.setFromCamera(this.#mouse, this.#camera);

        // Collect all unit models
        const allUnits = [...this.#unitZone.keys()];
        const meshes   = allUnits.map(u => u.model);
        const hits = this.#ray.intersectObjects(meshes, true);
        if (!hits.length) return;

        // Walk up to find the unit whose model was hit
        let hitObj = hits[0].object;
        let unit   = null;
        while (hitObj) {
            unit = allUnits.find(u => u.model === hitObj);
            if (unit) break;
            hitObj = hitObj.parent;
        }
        if (!unit) return;

        event.stopPropagation();
        this.#dragging   = unit;
        this.#dragOrigin = this.#unitZone.get(unit);
        this.#controls.enabled = false;

        // Lift the unit
        unit.model.position.y = unit.yOffset + SETUP.LIFT_Y;
    }

    #handleMouseMove(event) {
        if (!this.#dragging) return;
        this.#toNDC(event);
        this.#ray.setFromCamera(this.#mouse, this.#camera);

        // Move dragged unit to follow cursor on ground plane
        this.#ray.ray.intersectPlane(this.#groundPlane, this.#intersectPt);
        if (this.#intersectPt) {
            this.#dragging.model.position.set(
                this.#intersectPt.x,
                this.#dragging.yOffset + SETUP.LIFT_Y,
                this.#intersectPt.z
            );
        }

        // Determine hovered zone via pad raycasting
        const padMeshes   = [...this.#pads.values()];
        const padHits     = this.#ray.intersectObjects(padMeshes);
        const prevHovered = this.#hoveredZone;

        if (padHits.length) {
            this.#hoveredZone = padHits[0].object.userData.zoneId;
        } else {
            this.#hoveredZone = null;
        }

        // Update pad highlight colors
        if (prevHovered !== this.#hoveredZone) {
            if (prevHovered) this.#resetPadColor(prevHovered);
            if (this.#hoveredZone) this.#highlightPad(this.#hoveredZone);
        }
    }

    #handleMouseUp(event) {
        if (!this.#dragging) return;

        const unit   = this.#dragging;
        const origin = this.#dragOrigin;
        let   target = this.#hoveredZone;

        this.#dragging   = null;
        this.#dragOrigin = null;
        if (this.#hoveredZone) this.#resetPadColor(this.#hoveredZone);
        this.#hoveredZone = null;
        this.#controls.enabled = true;

        // Validate drop
        const isOgreInReserve = unit.unitType === 'ogre'
            && target
            && SETUP.ZONES[target]?.isReserve;

        if (!target || isOgreInReserve) {
            if (isOgreInReserve) this.#showWarning('Ogres cannot join Reserve squads!');
            // Return to origin
            this.#moveUnit(unit, origin);
            this.#packZone(origin);
            this.#updateCounter();
            return;
        }

        this.#moveUnit(unit, target);
        this.#packZone(origin);
        this.#packZone(target);
        this.#updateCounter();
    }

    #highlightPad(zoneId) {
        const pad  = this.#pads.get(zoneId);
        const unit = this.#dragging;
        if (!pad) return;
        const isInvalid = unit?.unitType === 'ogre' && SETUP.ZONES[zoneId]?.isReserve;
        pad.material.color.setHex(isInvalid ? SETUP.PAD_COLORS.invalid : SETUP.PAD_COLORS.hover);
        pad.material.opacity = 0.55;
    }

    #resetPadColor(zoneId) {
        const pad = this.#pads.get(zoneId);
        const def = SETUP.ZONES[zoneId];
        if (!pad || !def) return;
        const color = def.isAuto ? SETUP.PAD_COLORS.auto
                    : zoneId === 'pool' ? SETUP.PAD_COLORS.pool
                    : SETUP.PAD_COLORS.reserve;
        pad.material.color.setHex(color);
        pad.material.opacity = 0.35;
    }

    // ── Start Battle ──────────────────────────────────────────────────────────

    #startBattle() {
        if (this.#zones.get('pool').size > 0) return;

        const autoTargets = {
            autoL: document.getElementById('target-autoL').value,
            autoC: document.getElementById('target-autoC').value,
            autoR: document.getElementById('target-autoR').value,
        };

        // Build zoneUnits map (zone id → unit array) for the 6 battle zones
        const zoneUnits = {};
        for (const id of BATTLE_IDS) {
            zoneUnits[id] = [...this.#zones.get(id)];
        }

        if (this.onConfirm) this.onConfirm(zoneUnits, autoTargets);
    }

    // ── Zone unit access ──────────────────────────────────────────────────────

    getZoneUnits(id) { return [...this.#zones.get(id)]; }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    destroy() {
        this.#removeEvents();

        // Remove DOM button listeners so they don't accumulate across years
        document.getElementById('assign-all-btn')?.removeEventListener('click', this.#onAssignAll);
        this.#startBtn?.removeEventListener('click', this.#onStartBattle);

        // Remove pads and labels from scene
        for (const pad of this.#pads.values()) {
            this.#scene.remove(pad);
            pad.geometry.dispose();
            pad.material.dispose();
        }
        for (const label of this.#labels.values()) {
            this.#scene.remove(label);
        }
        this.#pads.clear();
        this.#labels.clear();

        this.#overlay.style.display = 'none';
    }

    // ── Per-frame update (reserved for future animations) ─────────────────────
    update(_dt) {}
}

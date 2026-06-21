import * as THREE from 'three';
import { scene, mixers } from './scene.js';
import { CONFIG, DEFENDERS, PATHS, REINFORCEMENT } from './constants.js';
import { normalizeModel } from './loader.js';

// Crossbow orientation: limbs left/right, stock backward. Rx(π/2) only.
const BOW_WORLD_QUAT  = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
const BOW_LEN         = 1.1;   // world units after scaling
const MODEL_Y_EXTENT  = 1.714; // Pickaxe_Wood Y extent (unscaled)
const HEAD_MID_Y      = 1.075; // model-space Y of curved-head midpoint (unscaled)
const BOW_GRIP_OFFSET = HEAD_MID_Y * (BOW_LEN / MODEL_Y_EXTENT); // ~0.69 wu

const _bp = new THREE.Vector3();

export class WallDefenders {
    #defenders    = [];   // { model, mixer, hp, idleAction, attackAction, bowMesh, fistBone }
    #aliveCount   = 0;
    #combatActive = false;

    // Stored for deferred reinforcement spawns
    #cache;
    #archerPath;
    #magePath;
    #sectionX;
    #sectionZ;

    constructor(section, cache, archerPath, magePath) {
        this.#cache      = cache;
        this.#archerPath = archerPath;
        this.#magePath   = magePath;
        this.#sectionX   = CONFIG.SECTION_X[section.id];
        this.#sectionZ   = CONFIG.WALL_Z + DEFENDERS.FIRE_Z_OFF;

        for (let i = 0; i < DEFENDERS.X_POSITIONS.length; i++) {
            const isMage = DEFENDERS.MAGE_INDICES.has(i);
            const record = this.#createDefender(isMage, this.#sectionX + DEFENDERS.X_POSITIONS[i]);
            if (record) {
                this.#defenders.push(record);
                this.#aliveCount++;
            }
        }
    }

    // ── Shared model-creation logic ───────────────────────────────────────────
    #createDefender(isMage, worldX) {
        const path = isMage ? this.#magePath : this.#archerPath;
        try {
            const model = this.#cache.clone(path);
            normalizeModel(model, DEFENDERS.HEIGHT);
            const yOff = model.position.y;
            model.position.set(worldX, DEFENDERS.WALL_TOP_Y + yOff, this.#sectionZ);
            model.rotation.y = 0;
            model.traverse(c => {
                if (!c.isMesh) return;
                c.castShadow = false;
                if (!isMage) {
                    const applyArmor = m => {
                        const mat = m.clone();
                        mat.color.set(0x8898b0);
                        if (mat.emissive) mat.emissive.set(0x1e2a38);
                        if (mat.metalness !== undefined) { mat.metalness = 0.85; mat.roughness = 0.25; }
                        return mat;
                    };
                    if (Array.isArray(c.material)) {
                        c.material = c.material.map(applyArmor);
                    } else {
                        c.material = applyArmor(c.material);
                    }
                }
            });
            scene.add(model);

            const clips = this.#cache.getAnimations(path);
            const mixer = new THREE.AnimationMixer(model);
            mixers.add(mixer);

            const idleClip   = clips.find(c => c.name.toLowerCase().includes('idle'))   ||
                               clips.find(c => c.name.toLowerCase().includes('stand'))  ||
                               clips.find(c => !c.name.toLowerCase().includes('attack')) ||
                               clips[0];
            const attackClip = clips.find(c => c.name === 'Idle_Hold') ||
                               clips.find(c => c.name.toLowerCase().includes('attack')) ||
                               idleClip;

            const idleAction   = idleClip   ? mixer.clipAction(idleClip).setLoop(THREE.LoopRepeat)   : null;
            const attackAction = attackClip  ? mixer.clipAction(attackClip).setLoop(THREE.LoopRepeat) : null;

            if (this.#combatActive && attackAction && attackAction !== idleAction) {
                attackAction.reset().play();
            } else if (idleAction) {
                idleAction.play();
            }

            let bowMesh  = null;
            let fistBone = null;
            if (!isMage) {
                try {
                    bowMesh = this.#cache.clone(PATHS.BOW);
                    bowMesh.scale.setScalar(BOW_LEN / MODEL_Y_EXTENT);
                    bowMesh.traverse(c => {
                        if (!c.isMesh) return;
                        c.castShadow = false;
                        c.material = new THREE.MeshStandardMaterial({
                            color: 0x8b5e3c, roughness: 0.75, metalness: 0.05,
                        });
                    });
                    scene.add(bowMesh);

                    // Character_Male_1 uses "FistR" (GLTFLoader strips the dot from "Fist.R")
                    for (const name of ['FistR', 'Fist.R', 'HandR', 'Hand.R', 'FistL', 'Fist.L']) {
                        model.traverse(obj => { if (obj.name === name && !fistBone) fistBone = obj; });
                        if (fistBone) break;
                    }
                } catch (e) { /* bow model unavailable */ }
            }

            return { model, mixer, hp: DEFENDERS.DEFENDER_HP, idleAction, attackAction, bowMesh, fistBone };
        } catch (e) {
            return null;
        }
    }

    update() {
        for (const d of this.#defenders) {
            if (!d.bowMesh || !d.fistBone) continue;
            d.fistBone.getWorldPosition(_bp);
            d.bowMesh.quaternion.copy(BOW_WORLD_QUAT);
            d.bowMesh.position.copy(_bp);
            d.bowMesh.position.z -= BOW_GRIP_OFFSET;
        }
    }

    get aliveCount() { return this.#aliveCount; }

    activateCombat() {
        if (this.#combatActive) return;
        this.#combatActive = true;
        for (const d of this.#defenders) {
            if (d.hp <= 0 || !d.attackAction || d.attackAction === d.idleAction) continue;
            d.idleAction?.stop();
            d.attackAction.reset().play();
        }
    }

    getAliveDefenders() {
        return this.#defenders.filter(d => d.hp > 0);
    }

    damageSpecific(defender, dmg) {
        if (defender.hp <= 0) return;
        defender.hp -= dmg;
        if (defender.hp <= 0) {
            defender.hp = 0;
            this.#aliveCount--;
            mixers.delete(defender.mixer);
            scene.remove(defender.model);
            if (defender.bowMesh) { scene.remove(defender.bowMesh); defender.bowMesh = null; }
        }
    }

    takeDamage(totalDmg) {
        const alive = this.getAliveDefenders();
        if (alive.length === 0) return;
        this.damageSpecific(alive[Math.floor(Math.random() * alive.length)], totalDmg);
    }

    // ── Reinforcement spawning ─────────────────────────────────────────────────

    spawnArcher() {
        if (this.#aliveCount >= REINFORCEMENT.DEFENDER_CAP) return;
        const xOff  = (Math.random() * 2 - 1) * 8;
        const record = this.#createDefender(false, this.#sectionX + xOff);
        if (record) { this.#defenders.push(record); this.#aliveCount++; }
    }

    spawnReinforcements(archerCount, mageCount) {
        for (let i = 0; i < archerCount; i++) {
            if (this.#aliveCount >= REINFORCEMENT.DEFENDER_CAP) break;
            const xOff  = (Math.random() * 2 - 1) * 8;
            const record = this.#createDefender(false, this.#sectionX + xOff);
            if (record) { this.#defenders.push(record); this.#aliveCount++; }
        }
        for (let i = 0; i < mageCount; i++) {
            if (this.#aliveCount >= REINFORCEMENT.DEFENDER_CAP) break;
            const xOff  = (Math.random() * 2 - 1) * 8;
            const record = this.#createDefender(true, this.#sectionX + xOff);
            if (record) { this.#defenders.push(record); this.#aliveCount++; }
        }
    }

    remove() {
        for (const d of this.#defenders) {
            mixers.delete(d.mixer);
            scene.remove(d.model);
            if (d.bowMesh) scene.remove(d.bowMesh);
        }
        this.#defenders  = [];
        this.#aliveCount = 0;
    }

    rebuildForNewYear() {
        this.remove();
        this.#combatActive = false;
        for (let i = 0; i < DEFENDERS.X_POSITIONS.length; i++) {
            const isMage = DEFENDERS.MAGE_INDICES.has(i);
            const record = this.#createDefender(isMage, this.#sectionX + DEFENDERS.X_POSITIONS[i]);
            if (record) {
                this.#defenders.push(record);
                this.#aliveCount++;
            }
        }
    }
}

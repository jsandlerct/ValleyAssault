import * as THREE from 'three';
import { CONFIG, FORMATION, UNIT_FX } from './constants.js';
import { mixers } from './scene.js';
import { game } from './game.js';
import { normalizeModel } from './loader.js';

// ── Animation helpers ─────────────────────────────────────────────────────────
function findClip(clips, ...keywords) {
    for (const kw of keywords) {
        const clip = clips.find(c => c.name.toLowerCase().includes(kw));
        if (clip) return clip;
    }
    return null;
}

function playClip(mixer, clips, loop, ...keywords) {
    const clip = findClip(clips, ...keywords);
    if (!clip) return null;
    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
    action.clampWhenFinished = !loop;
    action.play();
    return action;
}

// ── UnitPool ──────────────────────────────────────────────────────────────────
export class UnitPool {
    #path;
    #cache;
    #clips;
    #pool  = [];
    active = [];

    constructor(cache, path, count, scene, targetHeight = null) {
        this.#path  = path;
        this.#cache = cache;
        this.#clips = cache.getAnimations(path);

        for (let i = 0; i < count; i++) {
            const model = cache.clone(path);
            if (targetHeight) normalizeModel(model, targetHeight);
            const yOffset = model.position.y;
            const emissiveMeshes = [];
            model.traverse(c => {
                if (c.isMesh) {
                    c.material = c.material.clone();
                    if (c.material?.emissive) emissiveMeshes.push(c);
                }
            });
            model.visible = false;
            scene.add(model);

            const mixer = new THREE.AnimationMixer(model);
            this.#pool.push({ model, mixer, emissiveMeshes, alive: false, hp: 0, maxHp: 0, marchOffset: new THREE.Vector3(), yOffset, attacking: false, marchDelay: 0, defenderTarget: null, throughRecorded: false });
        }
    }

    spawn(hp, marchOffset) {
        const unit = this.#pool.pop();
        if (!unit) return null;
        unit.model.visible    = true;
        unit.alive            = true;
        unit.hp               = hp;
        unit.maxHp            = hp;
        unit.marchOffset      = marchOffset.clone();
        unit.model.rotation.x = 0;
        unit.model.rotation.y = 0;  // face toward camera (+Z) — these models face +Z at rotation.y=0
        unit.throughRecorded  = false;
        unit.model.rotation.z = 0;
        unit.attacking      = false;
        unit.marchDelay     = 0;
        unit.defenderTarget = null;
        unit.mixer.stopAllAction();
        mixers.add(unit.mixer);
        this.active.push(unit);
        return unit;
    }

    despawn(unit) {
        unit.model.visible = false;
        unit.alive         = false;
        unit.mixer.stopAllAction();
        mixers.delete(unit.mixer);
        const idx = this.active.indexOf(unit);
        if (idx !== -1) this.active.splice(idx, 1);
        this.#pool.push(unit);
    }

    playIdle(unit)   { playClip(unit.mixer, this.#clips, true,  'idle', 'stand'); }
    playWalk(unit)   { playClip(unit.mixer, this.#clips, true,  'walk', 'run'); }
    playAttack(unit) { playClip(unit.mixer, this.#clips, true,  'attack'); }
    playDeath(unit)  {
        const action = playClip(unit.mixer, this.#clips, false, 'death', 'die');
        if (!action) {
            unit.mixer.stopAllAction();
            unit.model.rotation.x = -Math.PI / 2;
        }
    }

    flashHit(unit) {
        for (const c of unit.emissiveMeshes) {
            c.material.emissive.setHex(UNIT_FX.HIT_EMISSIVE);
            c.material.emissiveIntensity = UNIT_FX.HIT_EMISSIVE_INTENSITY;
        }
        setTimeout(() => {
            for (const c of unit.emissiveMeshes) {
                c.material.emissive.setHex(0x000000);
                c.material.emissiveIntensity = 0;
            }
        }, UNIT_FX.HIT_FLASH_MS);
    }
}

// ── Squad ─────────────────────────────────────────────────────────────────────
// unitGroups: [{ pool, unitType, count, columns? }, ...]
// Ogres (or frontmost group) should come first — they get the lowest z offset.
const SEP_RADIUS   = 0.85;   // units: distance within which separation force applies
const SEP_STRENGTH = 3.0;    // how strongly units push each other apart

const OBS_CLEARANCE = 1.5;   // extra clearance beyond obstacle radius before avoidance kicks in
const OBS_STRENGTH  = 6.0;   // avoidance steering strength (higher than separation, obstacles are solid)

export class Squad {
    units         = [];
    order         = 'idle';
    targetSection = null;
    maxHP         = 0;
    label         = '';
    isAuto        = false;
    isReserve     = false;

    #wallSections;
    #allSquads  = [];
    #obstacles  = [];
    #breachX = null;
    #_target = new THREE.Vector3();
    #_dir    = new THREE.Vector3();

    constructor(id, label, unitGroups, stagingPos) {
        this.id    = id;
        this.label = label;
        if (!unitGroups) return;  // bare construction for fromUnits()

        let currentRow = 0;
        for (const { pool, unitType, count, columns = 6 } of unitGroups) {
            const stats = CONFIG.UNITS[unitType];
            this.maxHP += stats.hp * count;

            for (let i = 0; i < count; i++) {
                const col = i % columns;
                const row = Math.floor(i / columns);
                const marchOffset = new THREE.Vector3(
                    (col - (columns - 1) / 2) * FORMATION.SPACING,
                    0,
                    (currentRow + row) * FORMATION.SPACING
                );

                const unit = pool.spawn(stats.hp, marchOffset);
                if (!unit) continue;
                unit.unitType = unitType;
                unit.pool     = pool;
                unit.squad    = this;
                unit.model.position.set(
                    stagingPos.x + marchOffset.x,
                    unit.yOffset,
                    stagingPos.z + marchOffset.z
                );
                pool.playIdle(unit);
                this.units.push(unit);
            }

            currentRow += Math.ceil(count / columns);
        }
    }

    // Construct a squad from already-spawned units (used after setup screen).
    // Units must already have unitType, pool, model, yOffset set.
    static fromUnits(id, label, units, stagingPos) {
        const squad = new Squad(id, label, null, stagingPos);

        // Sort: ogres first, then orcs, then goblins
        const typeOrder = { ogre: 0, orc: 1, goblin: 2 };
        const sorted = [...units].sort((a, b) => (typeOrder[a.unitType] ?? 3) - (typeOrder[b.unitType] ?? 3));

        const columns = Math.max(1, Math.ceil(Math.sqrt(sorted.length)));
        for (let i = 0; i < sorted.length; i++) {
            const unit = sorted[i];
            const col  = i % columns;
            const row  = Math.floor(i / columns);
            const marchOffset = new THREE.Vector3(
                (col - (columns - 1) / 2) * FORMATION.SPACING,
                0,
                row * FORMATION.SPACING
            );
            unit.marchOffset    = marchOffset;
            unit.squad          = squad;
            unit.attacking      = false;
            unit.marchDelay     = 0;
            unit.defenderTarget = null;
            unit.throughRecorded = false;
            squad.maxHP += CONFIG.UNITS[unit.unitType].hp;
            unit.model.position.set(
                stagingPos.x + marchOffset.x,
                unit.yOffset,
                stagingPos.z + marchOffset.z
            );
            unit.model.rotation.y = 0;
            unit.pool.playIdle(unit);
            squad.units.push(unit);
        }
        return squad;
    }

    get totalHP() { return this.units.reduce((s, u) => s + u.hp, 0); }

    setWallSections(ws)  { this.#wallSections = ws; }
    setAllSquads(squads) { this.#allSquads    = squads; }
    setObstacles(obs)    { this.#obstacles    = obs; }

    setOrder(section) {
        this.#leaveCurrentSection();
        this.targetSection = section;
        this.order = 'marching';
        const wallX = CONFIG.SECTION_X[section];
        for (const unit of this.units) {
            unit.attacking      = false;
            unit.defenderTarget = null;
            // Immediately face the target wall section
            const dx = wallX - unit.model.position.x;
            const dz = CONFIG.WALL_Z - unit.model.position.z;
            if (dx * dx + dz * dz > 0.001) unit.model.rotation.y = Math.atan2(dx, dz);
            unit.marchDelay = unit.unitType === 'ogre'   ? 0
                            : unit.unitType === 'goblin' ? CONFIG.MARCH_HEADSTART_S * 2
                            : CONFIG.MARCH_HEADSTART_S;
            if (unit.marchDelay === 0) unit.pool.playWalk(unit);
            else                       unit.pool.playIdle(unit);
        }
    }

    marchThroughBreach(breachX) {
        this.#leaveCurrentSection();
        this.#breachX = breachX;
        this.order    = 'through';
        for (const unit of this.units) {
            if (!unit.alive) continue;
            unit.attacking      = false;
            unit.marchDelay     = 0;
            unit.throughRecorded = false;
            unit.pool.playWalk(unit);
        }
    }

    #leaveCurrentSection() {
        const section = this.#wallSections?.find(s => s.id === this.targetSection);
        if (!section) return;
        const idx = section.engagedSquads.indexOf(this);
        if (idx !== -1) section.engagedSquads.splice(idx, 1);
    }

    update(dt) {
        if (this.order === 'through') {
            this.#updateThrough(dt);
            return;
        }

        // Keep attacking units facing their target every frame
        if (this.order === 'marching' || this.order === 'engaged') {
            for (const unit of this.units) {
                if (unit.alive && unit.attacking) this.#faceTarget(unit);
            }
        }

        if (this.order !== 'marching') return;

        let allArrived = true;
        for (const unit of this.units) {
            if (!unit.alive || unit.attacking) continue;

            if (unit.marchDelay > 0) {
                unit.marchDelay -= dt;
                if (unit.marchDelay <= 0) {
                    unit.marchDelay = 0;
                    unit.pool.playWalk(unit);
                }
                allArrived = false;
                continue;
            }

            this.#targetWorldPos(unit);
            this.#_target.y = unit.yOffset;

            this.#_dir.subVectors(this.#_target, unit.model.position);
            this.#_dir.y = 0;
            const dist = this.#_dir.length();

            if (dist <= FORMATION.ARRIVE_THRESHOLD) {
                unit.attacking = true;
                unit.pool.playAttack(unit);
                this.#registerEngaged();
            } else {
                allArrived = false;
                const speed = CONFIG.UNITS[unit.unitType].speed;
                this.#_dir.normalize().multiplyScalar(speed * dt);

                // Separation: push away from nearby units across all squads
                let steerX = 0, steerZ = 0;
                for (const squad of this.#allSquads) {
                    for (const other of squad.units) {
                        if (other === unit || !other.alive) continue;
                        const ox = unit.model.position.x - other.model.position.x;
                        const oz = unit.model.position.z - other.model.position.z;
                        const d2 = ox * ox + oz * oz;
                        if (d2 < SEP_RADIUS * SEP_RADIUS && d2 > 0.0001) {
                            const d  = Math.sqrt(d2);
                            const f  = (SEP_RADIUS - d) / SEP_RADIUS * dt;
                            steerX += (ox / d) * f * SEP_STRENGTH;
                            steerZ += (oz / d) * f * SEP_STRENGTH;
                        }
                    }
                }

                // Obstacle avoidance: steer away from rocks, trees, pine groups
                for (const obs of this.#obstacles) {
                    const ox = unit.model.position.x - obs.x;
                    const oz = unit.model.position.z - obs.z;
                    const d2 = ox * ox + oz * oz;
                    const clearDist = obs.radius + OBS_CLEARANCE;
                    if (d2 < clearDist * clearDist && d2 > 0.0001) {
                        const d = Math.sqrt(d2);
                        const f = (clearDist - d) / clearDist * dt;
                        steerX += (ox / d) * f * OBS_STRENGTH;
                        steerZ += (oz / d) * f * OBS_STRENGTH;
                    }
                }

                this.#_dir.x += steerX;
                this.#_dir.z += steerZ;

                unit.model.position.add(this.#_dir);
                unit.model.rotation.y = Math.atan2(this.#_dir.x, this.#_dir.z);
            }
        }

        if (allArrived) this.order = 'engaged';
    }

    #faceTarget(unit) {
        let dx, dz;
        if (unit.unitType === 'goblin' && unit.defenderTarget?.model && unit.defenderTarget.hp > 0) {
            const tp = unit.defenderTarget.model.position;
            dx = tp.x - unit.model.position.x;
            dz = tp.z - unit.model.position.z;
        } else if (this.targetSection != null) {
            dx = CONFIG.SECTION_X[this.targetSection] - unit.model.position.x;
            dz = CONFIG.WALL_Z - unit.model.position.z;
        } else {
            return;
        }
        if (dx * dx + dz * dz > 0.001) {
            unit.model.rotation.y = Math.atan2(dx, dz);
        }
    }

    #updateThrough(dt) {
        // Funnel through the breach opening (cap X spread to ±4 units around breach center)
        const targetZ = CONFIG.WALL_Z - 12;
        for (const unit of [...this.units]) {
            if (!unit.alive) continue;

            const clampedX = Math.max(-4, Math.min(4, unit.marchOffset.x));
            const targetX  = this.#breachX + clampedX;
            this.#_target.set(targetX, unit.yOffset, targetZ);
            this.#_dir.subVectors(this.#_target, unit.model.position);
            this.#_dir.y = 0;
            const dist = this.#_dir.length();

            // Count unit 0.5s after it crosses the wall plane
            if (!unit.throughRecorded && unit.model.position.z < CONFIG.WALL_Z) {
                unit.throughRecorded = true;
                setTimeout(() => game.recordUnitThrough(), 500);
            }

            if (dist < 0.5) {
                unit.pool.despawn(unit);
                const idx = this.units.indexOf(unit);
                if (idx !== -1) this.units.splice(idx, 1);
                if (this.units.length === 0) {
                    this.order = 'idle';
                    game.checkDefeat();
                }
            } else {
                const speed = CONFIG.UNITS[unit.unitType].speed * 1.2;
                this.#_dir.normalize().multiplyScalar(speed * dt);
                unit.model.position.add(this.#_dir);
                unit.model.rotation.y = Math.atan2(this.#_dir.x, this.#_dir.z);
            }
        }
    }

    #targetWorldPos(unit) {
        const arrive = unit.unitType === 'goblin' ? CONFIG.GOBLIN_RANGE : CONFIG.MARCH_ARRIVE_DIST;
        this.#_target.set(
            CONFIG.SECTION_X[this.targetSection] + unit.marchOffset.x,
            0,
            CONFIG.WALL_Z + arrive + Math.abs(unit.marchOffset.z) * 0.5
        );
    }

    #registerEngaged() {
        if (!this.#wallSections) return;
        const section = this.#wallSections.find(s => s.id === this.targetSection);
        if (!section || section.breached || section.engagedSquads.includes(this)) return;
        section.engagedSquads.push(this);
    }

    flashHit(unit) { unit.pool.flashHit(unit); }

    killUnit(unit) {
        unit.alive = false;
        unit.hp    = 0;
        unit.pool.playDeath(unit);

        setTimeout(() => {
            unit.pool.despawn(unit);
            const idx = this.units.indexOf(unit);
            if (idx !== -1) this.units.splice(idx, 1);

            if (this.units.length === 0) {
                this.order = 'idle';
                game.checkDefeat();
            }
        }, UNIT_FX.DEATH_LINGER_MS);
    }
}

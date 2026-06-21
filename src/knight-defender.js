import * as THREE from 'three';
import { scene, mixers } from './scene.js';
import { PATHS, KNIGHT, CONFIG } from './constants.js';
import { normalizeModel } from './loader.js';
import { game, State } from './game.js';

const SILVER = new THREE.Color(KNIGHT.SILVER);

// ── KnightDefender ────────────────────────────────────────────────────────────
// A single mounted knight: composite model (horse + silver rider), dual mixers,
// hit-flash, and animation helpers used by KnightSystem.
export class KnightDefender {
    model   = null;   // THREE.Group placed in the scene
    hp      = KNIGHT.HP;
    alive   = true;
    speed   = KNIGHT.SPEED;
    attack  = KNIGHT.ATTACK;
    attackSpeed = KNIGHT.ATTACK_SPEED;

    #horseMixer = null;
    #riderMixer = null;
    #horseClips = [];
    #riderClips = [];
    #emissiveMeshes = [];

    constructor(cache, spawnPos) {
        const horse = cache.clone(PATHS.KNIGHT_HORSE);
        const rider = cache.clone(PATHS.KNIGHT_RIDER);

        normalizeModel(horse, KNIGHT.HORSE_H);
        normalizeModel(rider, KNIGHT.RIDER_H);

        const saddleY = KNIGHT.HORSE_H * KNIGHT.SADDLE_FRAC;
        rider.position.y += saddleY;

        // Silver tint on rider; track emissive meshes for hit-flash
        rider.traverse(c => {
            if (!c.isMesh) return;
            c.castShadow = true;
            c.material = new THREE.MeshStandardMaterial({
                color:             SILVER,
                metalness:         0.6,
                roughness:         0.3,
                emissive:          new THREE.Color(0x000000),
                emissiveIntensity: 0,
            });
            this.#emissiveMeshes.push(c);
        });

        // Clone horse materials so hit-flash doesn't bleed into the cache
        horse.traverse(c => {
            if (!c.isMesh) return;
            c.castShadow    = true;
            c.receiveShadow = true;
            c.material = c.material.clone();
            if (c.material.emissive) this.#emissiveMeshes.push(c);
        });

        this.model = new THREE.Group();
        this.model.add(horse);
        this.model.add(rider);
        this.model.position.copy(spawnPos);
        scene.add(this.model);

        this.#horseClips = cache.getAnimations(PATHS.KNIGHT_HORSE);
        this.#riderClips = cache.getAnimations(PATHS.KNIGHT_RIDER);

        this.#horseMixer = new THREE.AnimationMixer(horse);
        this.#riderMixer = new THREE.AnimationMixer(rider);
        mixers.add(this.#horseMixer);
        mixers.add(this.#riderMixer);

        this.playIdle();
    }

    // ── Animation helpers ────────────────────────────────────────────────────
    playIdle() {
        this.#play(this.#horseMixer, this.#horseClips, true,  'idle', 'stand');
        this.#play(this.#riderMixer, this.#riderClips, true,  'idle', 'stand');
    }

    playRun() {
        this.#play(this.#horseMixer, this.#horseClips, true,  'run', 'walk');
        this.#play(this.#riderMixer, this.#riderClips, true,  'idle_attack', 'idle', 'stand');
    }

    playAttack() {
        this.#play(this.#horseMixer, this.#horseClips, true,  'idle', 'stand');
        this.#play(this.#riderMixer, this.#riderClips, true,  'attack', 'idle_attack');
    }

    playDeath() {
        this.#play(this.#horseMixer, this.#horseClips, false, 'death', 'die');
        this.#play(this.#riderMixer, this.#riderClips, false, 'death', 'die');
    }

    die() {
        if (!this.alive) return;
        this.alive = false;
        this.playDeath();
        setTimeout(() => this.remove(), 1500);
    }

    flashHit() {
        for (const c of this.#emissiveMeshes) {
            c.material.emissive.setHex(0xff2200);
            c.material.emissiveIntensity = 0.6;
        }
        setTimeout(() => {
            for (const c of this.#emissiveMeshes) {
                c.material.emissive.setHex(0x000000);
                c.material.emissiveIntensity = 0;
            }
        }, 200);
    }

    remove() {
        mixers.delete(this.#horseMixer);
        mixers.delete(this.#riderMixer);
        scene.remove(this.model);
    }

    #play(mixer, clips, loop, ...keywords) {
        const clip = clips.find(c => keywords.some(kw => c.name.toLowerCase().includes(kw)));
        if (!clip) return;
        const action = mixer.clipAction(clip);
        action.reset();
        action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
        action.clampWhenFinished = !loop;
        action.play();
    }
}

// ── KnightSystem ──────────────────────────────────────────────────────────────
// Spawns KNIGHT_COUNT knights from the center gate 2 s after retreat is called
// (the 2-second delay is applied externally via setTimeout in game.soundRetreat).
// Knights emerge staggered, chase the nearest alive retreating unit, and kill
// those they catch before the unit crosses RETREAT_Z.
const ATTACK_RANGE        = 1.8;   // melee contact range for knight vs player unit
const ATTACK_TICK         = 1.0;   // seconds between knight damage ticks
const ROW_DELAY           = 0.25;  // seconds between row 1 and row 2 leaving the gate
const ROW_X               = [-3, 0, 3]; // x offsets for retreat/breach rows
const SORTIE_ROW_X        = [-15, -5, 5, 15]; // wider spread so all 3 wall sections are threatened
const SORTIE_DETECT_RANGE = 8;     // units face the nearest knight within this distance
const PLAYER_ATTACK_RANGE = 2.0;   // how close a melee unit must be to hit a knight
const PLAYER_COMBAT_TICK  = 1.0;   // seconds between player damage ticks

export class KnightSystem {
    #cache;
    #knights         = [];  // { knight: KnightDefender, attackTimer, target }
    #deployed        = false;
    #breachBlocking  = false; // true while sortie knights are alive and blocking the breach
    #playerAttackAcc = 0;

    constructor(cache) {
        this.#cache = cache;
    }

    get allKnightsDead() {
        return this.#deployed && this.#knights.every(e => !e.knight.alive);
    }

    deploy() {
        if (this.#deployed) return;
        this.#deployed = true;
        // During breach: block the passage until all knights are killed.
        if (game.state === State.BREACH) {
            game.breachBlocked = true;
            this.#breachBlocking = true;
        }
        // Row 1 emerges immediately; row 2 follows ROW_DELAY seconds later.
        for (const x of ROW_X) this.#spawnOne(x);
        setTimeout(() => { for (const x of ROW_X) this.#spawnOne(x); }, ROW_DELAY * 1000);
    }

    // Sortie during play — independent of the retreat/breach deploy guard.
    // Uses SORTIE_ROW_X so knights spread across all three wall sections.
    deploySortie(count = 12) {
        const rows = Math.ceil(count / SORTIE_ROW_X.length);
        for (let row = 0; row < rows; row++) {
            const rowStart = row * SORTIE_ROW_X.length;
            const rowCount = Math.min(SORTIE_ROW_X.length, count - rowStart);
            setTimeout(() => {
                for (let c = 0; c < rowCount; c++) this.#spawnOne(SORTIE_ROW_X[c]);
            }, row * ROW_DELAY * 1000);
        }
    }

    #spawnOne(x) {
        const spawnPos = new THREE.Vector3(x, 0, CONFIG.WALL_Z + 1);
        const knight = new KnightDefender(this.#cache, spawnPos);
        knight.model.rotation.y = 0;
        knight.playRun();
        this.#knights.push({ knight, attackTimer: 0, target: null });
    }

    #findNearestTarget(knightModel) {
        const candidates = [];
        for (const squad of game.squads) {
            for (const unit of squad.units) {
                if (!unit.alive) continue;
                const dx = unit.model.position.x - knightModel.position.x;
                const dz = unit.model.position.z - knightModel.position.z;
                candidates.push({ unit, d2: dx * dx + dz * dz });
            }
        }
        if (candidates.length === 0) return null;
        candidates.sort((a, b) => a.d2 - b.d2);
        const pool = candidates.slice(0, 4);
        return pool[Math.floor(Math.random() * pool.length)].unit;
    }

    #nearestAliveKnight(position) {
        let best = null;
        let bestD2 = Infinity;
        for (const entry of this.#knights) {
            if (!entry.knight.alive) continue;
            const dx = entry.knight.model.position.x - position.x;
            const dz = entry.knight.model.position.z - position.z;
            const d2 = dx * dx + dz * dz;
            if (d2 < bestD2) { bestD2 = d2; best = entry; }
        }
        return best;
    }

    #resumeBreach() {
        this.#breachBlocking = false;
        game.breachBlocked   = false;
        // Resume march for all squads still waiting to go through.
        for (const squad of game.squads) {
            if (squad.order !== 'through') continue;
            for (const unit of squad.units) {
                if (unit.alive) unit.pool.playWalk(unit);
            }
        }
    }

    // Move player units toward breach knights and deal damage while they hold the gate.
    #updateBreachFight(dt) {
        const aliveKnights = this.#knights.filter(e => e.knight.alive);
        if (aliveKnights.length === 0) {
            this.#resumeBreach();
            return;
        }

        this.#playerAttackAcc += dt;
        const doAttack = this.#playerAttackAcc >= PLAYER_COMBAT_TICK;
        if (doAttack) this.#playerAttackAcc = 0;

        for (const squad of game.squads) {
            if (squad.order !== 'through') continue;
            for (const unit of squad.units) {
                if (!unit.alive) continue;

                const entry = this.#nearestAliveKnight(unit.model.position);
                if (!entry) continue;

                const kpos = entry.knight.model.position;
                const dx   = kpos.x - unit.model.position.x;
                const dz   = kpos.z - unit.model.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                unit.model.rotation.y = Math.atan2(dx, dz);

                if (dist > PLAYER_ATTACK_RANGE) {
                    const speed = CONFIG.UNITS[unit.unitType].speed;
                    unit.model.position.x += (dx / dist) * speed * dt;
                    unit.model.position.z += (dz / dist) * speed * dt;
                }

                if (doAttack && dist <= PLAYER_ATTACK_RANGE) {
                    const stats = CONFIG.UNITS[unit.unitType];
                    entry.knight.hp -= stats.attack * stats.attackSpeed;
                    entry.knight.flashHit();
                    if (entry.knight.hp <= 0) entry.knight.die();
                }
            }
        }
    }

    // Player units counter-attack sortie knights during normal play.
    // Goblins engage from up to CONFIG.GOBLIN_RANGE away; melee within PLAYER_ATTACK_RANGE.
    // Units face the incoming knight as soon as it enters SORTIE_DETECT_RANGE.
    #updateSortieFight(dt) {
        const aliveKnights = this.#knights.filter(e => e.knight.alive);
        if (aliveKnights.length === 0) return;

        this.#playerAttackAcc += dt;
        const doAttack = this.#playerAttackAcc >= PLAYER_COMBAT_TICK;
        if (doAttack) this.#playerAttackAcc = 0;

        for (const squad of game.squads) {
            for (const unit of squad.units) {
                if (!unit.alive) continue;
                const entry = this.#nearestAliveKnight(unit.model.position);
                if (!entry) continue;
                const dx   = entry.knight.model.position.x - unit.model.position.x;
                const dz   = entry.knight.model.position.z - unit.model.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                // Face the incoming knight so the counterattack is visually obvious
                if (dist <= SORTIE_DETECT_RANGE) {
                    unit.model.rotation.y = Math.atan2(dx, dz);
                }

                if (!doAttack) continue;
                const range = unit.unitType === 'goblin' ? CONFIG.GOBLIN_RANGE : PLAYER_ATTACK_RANGE;
                if (dist > range) continue;
                const stats = CONFIG.UNITS[unit.unitType];
                entry.knight.hp -= stats.attack * stats.attackSpeed;
                entry.knight.flashHit();
                if (entry.knight.hp <= 0) entry.knight.die();
            }
        }
    }

    reset() {
        for (const entry of this.#knights) {
            entry.knight.remove();
        }
        this.#knights         = [];
        this.#deployed        = false;
        this.#breachBlocking  = false;
        this.#playerAttackAcc = 0;
        game.breachBlocked    = false;
    }

    update(dt) {
        if (this.#breachBlocking) this.#updateBreachFight(dt);
        else if (game.state === State.PLAYING) this.#updateSortieFight(dt);

        for (const entry of this.#knights) {
            if (!entry.knight.alive) continue;

            // Re-select only when current target is dead or has escaped
            if (!entry.target || !entry.target.alive || entry.target.model.position.z >= CONFIG.RETREAT_Z) {
                entry.target = this.#findNearestTarget(entry.knight.model);
                entry.attackTimer = 0;
            }
            const target = entry.target;

            if (!target) {
                entry.knight.playIdle();
                continue;
            }

            const dx   = target.model.position.x - entry.knight.model.position.x;
            const dz   = target.model.position.z - entry.knight.model.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            entry.knight.model.rotation.y = Math.atan2(dx, dz);

            if (dist > 0.4) {
                entry.knight.model.position.x += (dx / dist) * KNIGHT.SPEED * dt;
                entry.knight.model.position.z += (dz / dist) * KNIGHT.SPEED * dt;
            }

            if (dist <= ATTACK_RANGE) {
                entry.attackTimer += dt;
                if (entry.attackTimer >= ATTACK_TICK) {
                    entry.attackTimer = 0;
                    if (target.alive) {
                        target.hp -= KNIGHT.ATTACK;
                        target.pool.flashHit(target);
                        if (target.hp <= 0) target.squad.killUnit(target);
                    }
                }
            } else {
                entry.attackTimer = 0;
            }
        }
    }
}

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { scene, camera, renderer, css2dRenderer, mixers } from './scene.js';
import { ModelCache, normalizeModel } from './loader.js';
import { CONFIG, PATHS, UNIT_HEIGHTS, PROJECTILES, DEFENDERS, TOTAL_UNITS, POOL_SIZES, SETUP } from './constants.js';
import { Campaign } from './campaign.js';
import { audio } from './audio.js';
import { game, State } from './game.js';
import { Squad, UnitPool } from './squad.js';
import { WallSection, buildWall } from './wall.js';
import { CombatSystem } from './combat.js';
import { UISystem } from './ui.js';
import { updateLabel } from './ui-3d.js';
import { WallDefenders } from './defenders.js';
import { SetupScreen } from './setup.js';
import { KnightSystem } from './knight-defender.js';
import { DefenseReinforcementSystem } from './defense-reinforcements.js';

// ── Asset loading ─────────────────────────────────────────────────────────────
const ALL_PATHS = Object.values(PATHS);

const loadingScreen = document.getElementById('loading-screen');
const progressBar   = document.getElementById('progress-bar');
const loadingStatus = document.getElementById('loading-status');

async function loadAll(cache) {
    let loaded = 0;
    const total = ALL_PATHS.length;

    const promises = ALL_PATHS.map(path => {
        let failed = false;
        return cache.load(path)
            .catch(err => {
                console.warn(`Failed to load ${path}:`, err);
                failed = true;
            })
            .finally(() => {
                loaded++;
                progressBar.style.width = (loaded / total * 100) + '%';
                loadingStatus.textContent = failed
                    ? `Warning: could not load ${path.split('/').pop()}`
                    : `Loading assets… (${loaded}/${total})`;
            });
    });

    await Promise.all(promises);
}

// ── Valley dressing ───────────────────────────────────────────────────────────
function placeDressing(cache, path, x, y, z, scale, ry = 0, normalizeH = null) {
    try {
        const m = cache.clone(path);
        if (normalizeH) {
            normalizeModel(m, normalizeH);
            m.position.set(x, m.position.y, z);
        } else {
            m.position.set(x, y, z);
            m.scale.setScalar(scale);
        }
        m.rotation.y = ry;
        m.traverse(c => { if (c.isMesh) { c.castShadow = false; c.receiveShadow = false; } });
        scene.add(m);
    } catch (e) { /* model unavailable — skip */ }
}

// Returns an array of {x, z, radius} obstacle circles for unit avoidance.
// Mountains are excluded — they are far off to the sides and units won't reach them.
function addDressing(cache) {
    const obstacles = [];

    const mtnRows = [
        { xBase: -26, zList: [22, 8, -5, -18, -32, -45], scale: 3.8, path: PATHS.MOUNTAIN_LG  },
        { xBase: -38, zList: [16, 1, -12, -25, -39],     scale: 4.2, path: PATHS.MOUNTAIN_GRP },
        { xBase: -50, zList: [10, -5, -20, -35],          scale: 3.5, path: PATHS.MOUNTAIN_GRP2},
        { xBase:  26, zList: [22, 8, -5, -18, -32, -45], scale: 3.8, path: PATHS.MOUNTAIN_GRP },
        { xBase:  38, zList: [16, 1, -12, -25, -39],     scale: 4.2, path: PATHS.MOUNTAIN_LG  },
        { xBase:  50, zList: [10, -5, -20, -35],          scale: 3.5, path: PATHS.MOUNTAIN_GRP2},
    ];
    for (const { xBase, zList, scale, path } of mtnRows) {
        for (const z of zList) {
            const jitter = (Math.random() - 0.5) * 4;
            placeDressing(cache, path, xBase + jitter, 0, z, scale + Math.random() * 0.5, Math.random() * Math.PI * 2);
        }
    }

    for (const [x, z] of [
        [-22, -8], [-24, -20], [-20, 2],
        [ 22, -8], [ 24, -20], [ 20, 2],
    ]) {
        placeDressing(cache, PATHS.PINE_GRP, x, 0, z, 1.6 + Math.random() * 0.4, Math.random() * Math.PI * 2);
        obstacles.push({ x, z, radius: 3.0 });
    }

    for (const [x, z] of [
        [-14, 12], [-18, 17], [-10, 20],
        [ 14, 12], [ 18, 17], [ 10, 20],
    ]) {
        placeDressing(cache, PATHS.TREE1, x, 0, z, 1, Math.random() * Math.PI * 2, 3.0);
        obstacles.push({ x, z, radius: 0.9 });
    }

    for (const [x, z] of [[-8, -5], [6, -8], [-3, -15], [10, -3], [-12, -20]]) {
        placeDressing(cache, PATHS.ROCK, x, 0, z, 1, Math.random() * Math.PI * 2, 0.8 + Math.random() * 0.6);
        obstacles.push({ x, z, radius: 1.2 });
    }

    return obstacles;
}

// ── Projectile arrows / magic bolts ──────────────────────────────────────────
const activeProjectiles = [];

const arrowGeo = new THREE.CylinderGeometry(
    PROJECTILES.ARROW_RADIUS, PROJECTILES.ARROW_RADIUS, PROJECTILES.ARROW_LENGTH, 4
);
arrowGeo.rotateX(Math.PI / 2);  // align long axis with Z so lookAt orients correctly
const arrowMat = new THREE.MeshBasicMaterial({ color: PROJECTILES.ARROW_COLOR });
const boltGeo  = new THREE.SphereGeometry(PROJECTILES.BOLT_RADIUS, 6, 5);
const boltMat  = new THREE.MeshBasicMaterial({ color: PROJECTILES.BOLT_COLOR });
const spearGeo = new THREE.CylinderGeometry(0.03, 0.015, 0.55, 4);
spearGeo.rotateX(Math.PI / 2);  // align long axis with Z so lookAt orients correctly
const spearMat = new THREE.MeshBasicMaterial({ color: 0x8B6914 });

const projectilePools = { arrow: [], bolt: [], spear: [] };
{
    const defs = [
        { key: 'arrow', geo: arrowGeo, mat: arrowMat, size: 20 },
        { key: 'bolt',  geo: boltGeo,  mat: boltMat,  size: 20 },
        { key: 'spear', geo: spearGeo, mat: spearMat, size: 40 },
    ];
    for (const { key, geo, mat, size } of defs) {
        for (let i = 0; i < size; i++) {
            const mesh = new THREE.Mesh(geo, mat);
            mesh.visible = false;
            scene.add(mesh);
            projectilePools[key].push({ mesh, type: key, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, dur: 0 });
        }
    }
}

// type: 'arrow' | 'bolt' | 'spear'
function fireProjectile(from, to, type = 'arrow') {
    const pool = projectilePools[type];
    const p = pool.pop();
    if (!p) return;
    p.from.copy(from);
    p.to.copy(to);
    p.t = 0;
    p.dur = type === 'spear' ? PROJECTILES.SPEAR_DURATION
          : type === 'bolt'  ? PROJECTILES.BOLT_DURATION
          :                    PROJECTILES.ARROW_DURATION;
    p.mesh.position.copy(from);
    if (type !== 'bolt') p.mesh.lookAt(to);
    p.mesh.visible = true;
    activeProjectiles.push(p);
    if (type === 'arrow') audio.play('arrow');
    else if (type === 'bolt') audio.play('mage');
    else if (type === 'spear') audio.play('spear');
}

function updateProjectiles(dt) {
    for (let i = activeProjectiles.length - 1; i >= 0; i--) {
        const p = activeProjectiles[i];
        p.t += dt / p.dur;
        if (p.t >= 1) {
            p.mesh.visible = false;
            projectilePools[p.type].push(p);
            activeProjectiles.splice(i, 1);
        } else {
            p.mesh.position.lerpVectors(p.from, p.to, p.t);
            p.mesh.position.y += Math.sin(p.t * Math.PI) * PROJECTILES.ARC_HEIGHT;
        }
    }
}

let projectileTimer = 0;
function tickProjectiles(dt, wallSections, defenders) {
    projectileTimer += dt;
    if (projectileTimer < PROJECTILES.TICK_INTERVAL) return;
    projectileTimer = 0;

    const squads = game.squads;

    for (let i = 0; i < wallSections.length; i++) {
        const section  = wallSections[i];
        const defGroup = defenders[i];
        if (section.breached) continue;

        const activeSquads = section.engagedSquads.filter(
            s => s.units.some(u => u.alive)
        );
        if (activeSquads.length === 0) continue;

        const sx = CONFIG.SECTION_X[section.id];

        // Scale volley count by alive defenders
        const aliveRatio       = defGroup ? defGroup.aliveCount / DEFENDERS.X_POSITIONS.length : 1;
        const effectiveVolleys = Math.max(0, Math.round(PROJECTILES.VOLLEY_COUNT * aliveRatio));

        // Base: alive units already in engagedSquads
        const engagedUnits = [];
        for (const squad of activeSquads) {
            for (const unit of squad.units) { if (unit.alive) engagedUnits.push(unit); }
        }

        // Extend target pools with marching units within each weapon's range
        const archerTargetUnits = [...engagedUnits];
        const mageTargetUnits   = [...engagedUnits];
        for (const squad of squads) {
            if (squad.order !== 'marching' || squad.targetSection !== section.id) continue;
            for (const unit of squad.units) {
                if (!unit.alive) continue;
                const distFromWall = unit.model.position.z - CONFIG.WALL_Z;
                if (distFromWall <= PROJECTILES.ARCHER_RANGE) archerTargetUnits.push(unit);
                if (distFromWall <= PROJECTILES.MAGE_RANGE)   mageTargetUnits.push(unit);
            }
        }

        const aliveDefs = defGroup ? defGroup.getAliveDefenders() : [];
        for (let k = 0; k < effectiveVolleys; k++) {
            const isMagic = Math.random() < PROJECTILES.MAGIC_CHANCE;
            const pool    = isMagic ? mageTargetUnits : archerTargetUnits;
            if (pool.length === 0 || aliveDefs.length === 0) continue;
            const shooter = aliveDefs[Math.floor(Math.random() * aliveDefs.length)];
            const from = shooter.model.position.clone();
            from.y += DEFENDERS.HEIGHT * 0.65;
            const unit = pool[Math.floor(Math.random() * pool.length)];
            if (!unit.alive) continue;
            const to = unit.model.position.clone().add(new THREE.Vector3(0, PROJECTILES.TARGET_Y_OFFSET, 0));
            fireProjectile(from, to, isMagic ? 'bolt' : 'arrow');
            const dmg = isMagic ? DEFENDERS.MAGE_ATTACK : DEFENDERS.ARCHER_ATTACK;
            unit.hp -= dmg;
            unit.pool.flashHit(unit);
            if (unit.hp <= 0) unit.squad.killUnit(unit);
        }

        // Each attacking goblin fires a spear at its individual defender target
        for (const squad of activeSquads) {
            for (const unit of squad.units) {
                if (!unit.alive || !unit.attacking || unit.unitType !== 'goblin') continue;
                if (!unit.defenderTarget || unit.defenderTarget.hp <= 0) continue;
                const from = unit.model.position.clone()
                    .add(new THREE.Vector3(0, UNIT_HEIGHTS.goblin * 0.7, 0));
                const to = unit.defenderTarget.model.position.clone()
                    .add(new THREE.Vector3(0, 0.3, 0));
                fireProjectile(from, to, 'spear');
            }
        }
    }
}

// ── Build squads from setup screen results ────────────────────────────────────
const BATTLE_ZONE_IDS = ['autoL', 'autoC', 'autoR', 'resL', 'resC', 'resR'];

function buildSquadsFromSetup(zoneUnits, wallSections, obstacles) {
    const squads = [];
    for (const id of BATTLE_ZONE_IDS) {
        const zoneDef = SETUP.ZONES[id];
        const units   = zoneUnits[id] ?? [];
        const staging = new THREE.Vector3(zoneDef.x, 0, zoneDef.z);
        const squad   = Squad.fromUnits(id, zoneDef.label, units, staging);
        squad.isAuto    = zoneDef.isAuto;
        squad.isReserve = zoneDef.isReserve;
        squad.setWallSections(wallSections);
        squad.setAllSquads(squads);
        squad.setObstacles(obstacles);
        squads.push(squad);
    }
    return squads;
}

// ── Camera animation state ────────────────────────────────────────────────────
let cameraAnim = null;  // { fromPos, fromTarget, toPos, toTarget, t, dur }

// ── Entry point ───────────────────────────────────────────────────────────────
async function init() {
    const cache = new ModelCache();
    await Promise.all([loadAll(cache), audio.load()]);

    loadingScreen.style.display = 'none';

    await new Promise(resolve => {
        const intro = document.getElementById('intro-screen');
        intro.style.display = 'flex';
        document.getElementById('intro-continue-btn').addEventListener('click', () => {
            intro.style.display = 'none';
            resolve();
        }, { once: true });
    });

    const knightSystem    = new KnightSystem(cache);
    game.knightSystem     = knightSystem;

    const obstacles = addDressing(cache);

    // ── Wall sections ──
    const wallSections = [
        new WallSection('A'),
        new WallSection('B'),
        new WallSection('C'),
    ];
    buildWall(cache, wallSections);

    // ── Unit pools — sized by POOL_SIZES (large enough for any campaign year) ──
    const UNIT_DEFS = {
        orc:    { path: PATHS.ORC,    height: UNIT_HEIGHTS.orc    },
        goblin: { path: PATHS.GOBLIN, height: UNIT_HEIGHTS.goblin },
        ogre:   { path: PATHS.OGRE,   height: UNIT_HEIGHTS.ogre   },
    };

    const pools = {};
    for (const [unitType, count] of Object.entries(POOL_SIZES)) {
        const { path, height } = UNIT_DEFS[unitType];
        pools[unitType] = new UnitPool(cache, path, count, scene, height);
    }

    // ── Wall defenders ──
    const defenders = wallSections.map(section =>
        new WallDefenders(section, cache, PATHS.ARCHER, PATHS.MAGE)
    );

    for (let i = 0; i < wallSections.length; i++) {
        const defGroup = defenders[i];
        wallSections[i].onBreach = () => {
            defGroup.remove();
            audio.play('breach');
        };
    }

    // ── Defense reinforcements ──
    const defenseReinforcements = new DefenseReinforcementSystem(defenders, knightSystem);
    defenseReinforcements.onAnnounce = (text) => game.ui?.announce(text);
    game.defenseReinforcements = defenseReinforcements;

    // ── Camera controls ──
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(CONFIG.CAMERA_TARGET.x, CONFIG.CAMERA_TARGET.y, CONFIG.CAMERA_TARGET.z);
    controls.minDistance   = CONFIG.CAMERA_MIN_DIST;
    controls.maxDistance   = CONFIG.CAMERA_MAX_DIST;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan     = true;
    controls.update();

    // ── Campaign ──
    const campaign = new Campaign();

    // ── State ──
    game.wallSections = wallSections;

    // combat and active setup screen are replaced each year
    let combat        = null;
    let setupScreen   = null;

    // ── Year transition helper ──────────────────────────────────────────────────
    function startYear(unitCounts) {
        // Tear down previous year's UI listeners
        game.ui?.destroy();
        document.getElementById('retreat-counter')?.classList.add('hidden');
        document.getElementById('breach-counter')?.classList.add('hidden');

        // Reset game state
        game.state              = State.SETUP;
        game.squads             = [];
        game.ui                 = null;
        game.unitsThroughBreach = 0;
        game.retreatedUnits     = 0;
        game.retreatedByType    = { orc: 0, goblin: 0, ogre: 0 };
        game.breachBlocked      = false;
        game.onRetreatComplete  = null;
        combat                  = null;

        // Reset subsystems
        knightSystem.reset();
        defenseReinforcements.reset();

        // Repair walls (on year 1 walls are already full HP — no-op)
        const repairs = campaign.computeWallRepairs(wallSections);
        for (const { id, newHp } of repairs) {
            const section = wallSections.find(s => s.id === id);
            section.reset(newHp);
        }
        // Force label refresh so repaired HP shows during setup
        for (const section of wallSections) {
            updateLabel(section);
            section.labelDirty = false;
        }

        // Rebuild defenders
        for (const defGroup of defenders) defGroup.rebuildForNewYear();

        // Update year display
        document.getElementById('year-display').textContent =
            `YEAR ${campaign.year} / ${campaign.maxYears}`;

        document.getElementById('objective-banner').textContent =
            'Pick squads! Drag goblins to squads! Then click SMASH WALL NOW!';

        // Create setup screen for this year
        setupScreen = new SetupScreen(scene, camera, controls, renderer, pools, unitCounts);

        setupScreen.onConfirm = (zoneUnits, autoTargets) => {
            setupScreen.destroy();
            setupScreen = null;

            const squads = buildSquadsFromSetup(zoneUnits, wallSections, obstacles);
            combat = new CombatSystem(wallSections, squads, defenders);
            const ui = new UISystem(squads.filter(s => !s.isAuto));
            ui.setYear(campaign.year, campaign.maxYears);

            game.squads = squads;
            game.ui     = ui;

            // Wire retreat completion for campaign flow
            game.onRetreatComplete = (retreatedCount, retreatedByType) => {
                const wallHpBefore = wallSections.map(s => ({ id: s.id, hp: s.hp, maxHp: s.maxHp }));
                const nextUnits    = campaign.computeReinforcements(retreatedByType, wallSections);

                if (campaign.year >= campaign.maxYears) {
                    // Year 10 retreat — campaign lost
                    ui.showCampaignDefeatScreen('Ten years gone. Wall still stand. Zoob go cry in corner. Also you fired.');
                    return;
                }

                // Show year summary; "Begin Year N" transitions to next year
                const nextYear = campaign.year + 1;
                ui.showYearSummary({
                    year:           campaign.year,
                    retreatedByType,
                    wallHpBefore,
                    reinforcements: nextUnits,
                    nextYear,
                });

                document.getElementById('next-year-btn').onclick = () => {
                    ui.hideYearSummary();
                    campaign.advance(nextUnits);
                    startYear(campaign.startingUnits);
                };
            };

            // Animate camera back to battle position
            cameraAnim = {
                fromPos:    camera.position.clone(),
                fromTarget: controls.target.clone(),
                toPos:      new THREE.Vector3(CONFIG.CAMERA_POS.x, CONFIG.CAMERA_POS.y, CONFIG.CAMERA_POS.z),
                toTarget:   new THREE.Vector3(CONFIG.CAMERA_TARGET.x, CONFIG.CAMERA_TARGET.y, CONFIG.CAMERA_TARGET.z),
                t: 0, dur: 1.2,
            };

            game.startBattle(autoTargets);
        };
    }

    // ── Start Year 1 ──
    // Walls are already at full HP from construction — skip repair on first year
    game.state = State.SETUP;
    document.getElementById('year-display').textContent =
        `YEAR ${campaign.year} / ${campaign.maxYears}`;
    document.getElementById('objective-banner').textContent =
        'Pick squads! Drag goblins to squads! Then click SMASH WALL NOW!';
    setupScreen = new SetupScreen(scene, camera, controls, renderer, pools, campaign.startingUnits);

    setupScreen.onConfirm = (zoneUnits, autoTargets) => {
        setupScreen.destroy();
        setupScreen = null;

        const squads = buildSquadsFromSetup(zoneUnits, wallSections, obstacles);
        combat = new CombatSystem(wallSections, squads, defenders);
        const ui = new UISystem(squads.filter(s => !s.isAuto));
        ui.setYear(campaign.year, campaign.maxYears);

        game.squads = squads;
        game.ui     = ui;

        game.onRetreatComplete = (retreatedCount, retreatedByType) => {
            const wallHpBefore = wallSections.map(s => ({ id: s.id, hp: s.hp, maxHp: s.maxHp }));
            const nextUnits    = campaign.computeReinforcements(retreatedByType, wallSections);

            if (campaign.year >= campaign.maxYears) {
                ui.showCampaignDefeatScreen('Ten years gone. Wall still stand. Zoob go cry in corner. Also you fired.');
                return;
            }

            const nextYear = campaign.year + 1;
            ui.showYearSummary({
                year:           campaign.year,
                retreatedByType,
                wallHpBefore,
                reinforcements: nextUnits,
                nextYear,
            });

            document.getElementById('next-year-btn').onclick = () => {
                ui.hideYearSummary();
                campaign.advance(nextUnits);
                startYear(campaign.startingUnits);
            };
        };

        cameraAnim = {
            fromPos:    camera.position.clone(),
            fromTarget: controls.target.clone(),
            toPos:      new THREE.Vector3(CONFIG.CAMERA_POS.x, CONFIG.CAMERA_POS.y, CONFIG.CAMERA_POS.z),
            toTarget:   new THREE.Vector3(CONFIG.CAMERA_TARGET.x, CONFIG.CAMERA_TARGET.y, CONFIG.CAMERA_TARGET.z),
            t: 0, dur: 1.2,
        };

        game.startBattle(autoTargets);
    };

    // ── Game loop ──
    const timer = new THREE.Timer();
    renderer.setAnimationLoop(() => {
        timer.update();
        const dt = Math.min(timer.getDelta(), 0.1);

        if (game.state === State.SETUP) {
            setupScreen?.update(dt);
        }

        if (game.state === State.PLAYING || game.state === State.BREACH || game.state === State.RETREAT) {
            for (const squad of game.squads) squad.update(dt);
            combat?.tick(dt);
            for (const section of wallSections) {
                if (section.labelDirty) {
                    updateLabel(section);
                    section.labelDirty = false;
                }
            }
            game.ui?.update(dt);
            tickProjectiles(dt, wallSections, defenders);
            knightSystem.update(dt);

            // Start defense timer the first time any player unit engages a wall section
            if (game.state === State.PLAYING && !defenseReinforcements.active) {
                if (wallSections.some(s => s.engagedSquads.length > 0)) {
                    defenseReinforcements.start();
                }
            }
            defenseReinforcements.update(dt);
        }

        // Camera transition animation
        if (cameraAnim) {
            cameraAnim.t += dt / cameraAnim.dur;
            if (cameraAnim.t >= 1) {
                cameraAnim.t = 1;
                camera.position.copy(cameraAnim.toPos);
                controls.target.copy(cameraAnim.toTarget);
                cameraAnim = null;
            } else {
                camera.position.lerpVectors(cameraAnim.fromPos, cameraAnim.toPos, cameraAnim.t);
                controls.target.lerpVectors(cameraAnim.fromTarget, cameraAnim.toTarget, cameraAnim.t);
            }
        }

        updateProjectiles(dt);
        for (const d of defenders) d.update();
        controls.update();
        for (const m of mixers) m.update(dt);
        renderer.render(scene, camera);
        css2dRenderer.render(scene, camera);
    });
}

document.getElementById('title-screen').addEventListener('click', () => {
    document.getElementById('title-screen').style.display = 'none';
    init().catch(err => {
        console.error('Init failed:', err);
        document.getElementById('loading-status').textContent = 'Failed to load. Check console.';
    });
}, { once: true });

# Siege of the Valley — Technical Design Document

**Author:** Jeff  
**Based on:** PRD v0.1 (June 19, 2026)  
**Status:** Living document — updated after each enhancement  
**Last updated:** June 20, 2026 (squad assembly screen added)

---

## Table of Contents

1. [Tech Stack & Project Setup](#1-tech-stack--project-setup)
2. [Project Structure](#2-project-structure)
3. [Scene Architecture](#3-scene-architecture)
4. [Asset Loading Strategy](#4-asset-loading-strategy)
5. [Game State Machine](#5-game-state-machine)
6. [Data Model & Constants](#6-data-model--constants)
7. [Unit System](#7-unit-system)
8. [Wall System](#8-wall-system)
9. [Wall Defenders](#9-wall-defenders)
10. [Combat System](#10-combat-system)
11. [Projectile System](#11-projectile-system)
12. [Audio System](#12-audio-system)
13. [UI Architecture](#13-ui-architecture)
14. [Camera](#14-camera)
15. [Rendering & Performance](#15-rendering--performance)
16. [Known Risks & Mitigations](#16-known-risks--mitigations)
17. [Squad Assembly Screen](#17-squad-assembly-screen-added-june-20-2026)

---

## 1. Tech Stack & Project Setup

| Layer | Choice | Rationale |
|---|---|---|
| Renderer | Three.js (installed in node_modules) | Existing project setup |
| Bundler | Vite | Fast dev server, HMR, serves `public/` as static root |
| Language | Vanilla ES modules (no TypeScript) | Fastest to iterate |
| 3D models | glTF via `GLTFLoader` | Both asset packs are glTF |
| 3D-anchored UI | `CSS2DRenderer` (Three.js addon) | Wall section health bars must track 3D positions |
| 2D HUD | HTML/CSS overlay over canvas | Squad panel, order buttons, timer |
| Camera controls | `OrbitControls` | User-adjustable with min/max distance limits |

Import Three.js from the package, not a CDN:
```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
```

---

## 2. Project Structure

```
src/
  main.js         # Entry point: init scene, load assets, start game loop; projectile system
  scene.js        # Three.js scene, camera, lights, renderers, mixers Set
  loader.js       # ModelCache class — loads and caches glTF, clones instances
  game.js         # Game state machine class
  squad.js        # Squad class + UnitPool
  wall.js         # WallSection class + buildWall()
  defenders.js    # WallDefenders class — animated archers/mages on wall top
  combat.js       # CombatSystem — tick-based auto-combat
  ui.js           # HUD DOM management (timer, squad panel, order menu)
  ui-3d.js        # CSS2DRenderer labels (wall section HP bars)
  audio.js        # AudioSystem — pooled HTML Audio elements
  constants.js    # All tunable values: CONFIG, PATHS, SCENE, WALL, DEFENDERS,
                  #   PROJECTILES, UNIT_FX, FORMATION, UNIT_HEIGHTS

public/
  assets/
    buildings/
      glTF/...    # Wall, towers, mountains, pine trees
    cubeworld/
      Enemies/glTF/...      # Zombie.gltf (orc), Goblin.gltf, Giant.gltf (ogre)
      Characters/glTF/...   # Character_Male_1.gltf (archer defender)
      Environment/glTF/...  # Tree_1.gltf, Rock1.gltf
    sfx/          # WAV and MP3 sound effect files
  concept/
    concept art.png

docs/
  PRD.md
  tdd.md          # This file

index.html        # Single HTML shell: canvas + HUD overlay + loading/victory/defeat screens
CLAUDE.md         # Workflow guidelines for this project
```

---

## 3. Scene Architecture

### 3.1 Coordinate System

```
         Wall (z = -25)
    ┌──────────────────────┐
    │  A  │  B  │  C       │
    └──────────────────────┘
              ↑ north (-Z)

          Valley (ground plane y=0)

    ┌──────────────────────┐
    │   Staging area        │
    └──────────────────────┘
         Squads start here (z = +15)
```

- **X-axis**: left/right across the valley
- **Y-axis**: up (height)
- **Z-axis**: north/south — squads march in the -Z direction toward the wall
- Wall spans the X-axis at z = -25 (`CONFIG.WALL_Z`)
- Staging area is z = +15 (`CONFIG.STAGING_Z`)
- Scene is ~100 units wide, 70 units deep (extended for mountain dressing)

### 3.2 Model Orientation Convention

All cubeworld models face **+Z** at `rotation.y = 0`. This means:
- Squads spawn at staging area facing the camera (at z=+28)
- After receiving march orders, `rotation.y = Math.atan2(dx, dz)` correctly points them toward the wall
- Defenders on the wall use `rotation.y = 0` to face out toward attackers (toward +Z = south = staging area)

### 3.3 Lighting

```js
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

directionalLight.castShadow = true;
directionalLight.shadow.camera.left   = -35;
directionalLight.shadow.camera.right  =  35;
directionalLight.shadow.camera.top    =  30;
directionalLight.shadow.camera.bottom = -30;
directionalLight.shadow.mapSize.set(2048, 2048);
```

Warm ambient + directional sun from front-above-right. Hemisphere light for ground color. No point/spot lights needed. Environment dressing (mountains, trees) has `castShadow = false` to keep shadow pass fast.

---

## 4. Asset Loading Strategy

### 4.1 ModelCache (loader.js)

Load each model once; clone instances. **Critical:** Cubeworld character/enemy models are skinned (animated), so clones must use `SkeletonUtils.clone()`, not `.clone()`. Building models are static so regular `.clone()` is fine.

The `ModelCache` uses `model.traverse(c => { if (c.isMesh) c.castShadow = true; })` at load time.

### 4.2 Model Normalization

```js
export function normalizeModel(model, targetHeight = 1.0) {
    // Uses mesh-only bounding box (NOT setFromObject) to avoid skeleton-armature floating bug
    // Returns model with feet at y=0, scaled to targetHeight
}
```

Wall/building models are NOT normalized — placed at native scale.

### 4.3 Assets in Use

| Asset | Path (in public/) | Height | Usage |
|---|---|---|---|
| Orc (Zombie.gltf) | `/assets/cubeworld/Enemies/glTF/Zombie.gltf` | 0.9 | Squad unit |
| Goblin | `/assets/cubeworld/Enemies/glTF/Goblin.gltf` | 0.7 | Squad unit (ranged) |
| Ogre (Giant.gltf) | `/assets/cubeworld/Enemies/glTF/Giant.gltf` | 1.4 | Squad unit (tank) |
| Archer (Character_Male_1) | `/assets/cubeworld/Characters/glTF/Character_Male_1.gltf` | 0.85 | Wall defender |
| Mage (Wizard.gltf) | `/assets/cubeworld/Enemies/glTF/Wizard.gltf` | 0.85 | Wall defender |
| Wall segment | `/assets/buildings/glTF/Wall_FirstAge.gltf` | native | Tiled wall |
| WallTower | `/assets/buildings/glTF/WallTowers_FirstAge.gltf` | native | Section boundaries |
| Door (closed) | `/assets/buildings/glTF/WallTowers_DoorClosed_FirstAge.gltf` | native | Pre-breach gate |
| Door (open) | `/assets/buildings/glTF/WallTowers_Door_FirstAge.gltf` | native | Post-breach gate |
| MountainLarge_Single | `/assets/buildings/glTF/MountainLarge_Single.gltf` | native | Valley backdrop |
| Mountain_Group_1/2 | `/assets/buildings/glTF/Mountain_Group_1/2.gltf` | native | Valley sides |
| Resource_PineTree_Group | `/assets/buildings/glTF/Resource_PineTree_Group.gltf` | native | Valley dressing |
| Tree_1 | `/assets/cubeworld/Environment/glTF/Tree_1.gltf` | 3.0 | Staging dressing |
| Rock1 | `/assets/cubeworld/Environment/glTF/Rock1.gltf` | varies | Valley dressing |

---

## 5. Game State Machine

```js
// game.js
export const State = {
    LOADING: 'loading',
    SETUP:   'setup',    // Pre-battle squad assembly screen (added June 20, 2026)
    READY:   'ready',    // Squads built, no orders issued yet
    PLAYING: 'playing',  // At least one squad is marching or engaged
    BREACH:  'breach',   // A wall section HP reached 0; all squads auto-march through breach
    VICTORY: 'victory',
    DEFEAT:  'defeat',
};
```

### State Transitions

```
LOADING → SETUP    Assets loaded; player assigns units to squads
SETUP   → READY    Player clicks "Start Battle" (all units assigned)
READY   → PLAYING  Auto-squads immediately issue attack orders on startBattle()
PLAYING → BREACH   Any wall section HP reaches 0
BREACH  → VICTORY  At least one unit recorded as through-the-breach after all squads exhaust
BREACH  → DEFEAT   All squads destroyed/gone without any unit making it through
PLAYING → DEFEAT   All squads destroyed, no section breached
```

**Decision (vs PRD):** On breach, ALL squads automatically march through the breach — there is no "Send Through" button. The game ends (VICTORY) when at least one unit passes through. The `game.recordUnitThrough()` / `game.unitsThroughBreach` counter tracks units for the UI, with final check in `checkDefeat()`.

### Game Loop (main.js)

```js
renderer.setAnimationLoop(() => {
    const dt = Math.min(timer.getDelta(), 0.1);

    if (game.state === State.SETUP) {
        setupScreen.update(dt);  // no-op; reserved for future setup animations
    }

    if (game.state === State.PLAYING || game.state === State.BREACH) {
        for (const squad of game.squads) squad.update(dt);
        combat.tick(dt);
        for (const section of wallSections) {
            if (section.labelDirty) { updateLabel(section); section.labelDirty = false; }
        }
        game.ui.update(dt);
        tickProjectiles(dt, wallSections, defenders);  // reads game.squads internally
    }

    // Camera transition animation (setup → battle)
    if (cameraAnim) { /* lerps camera.position and controls.target over 1.2s */ }

    updateProjectiles(dt);
    controls.update();
    for (const m of mixers) m.update(dt);
    renderer.render(scene, camera);
    css2dRenderer.render(scene, camera);
});
```

---

## 6. Data Model & Constants

### 6.1 constants.js exports

All tunable constants live here. Never hardcode values in logic files.

```js
PATHS          // Asset file paths
SCENE          // Renderer settings, fog, lighting colors
WALL           // Scale of wall tile geometry
DEFENDERS      // Wall defender positions, heights, HP
PROJECTILES    // Arrow/bolt/spear timing, geometry, arc
UNIT_FX        // Hit flash color, death linger duration
FORMATION      // Spacing between units in formation
UNIT_HEIGHTS   // Normalization heights per unit type
CONFIG         // Main game config (see below)
```

### 6.2 CONFIG

```js
export const CONFIG = {
    SQUAD_COUNT: 3,
    SQUAD_COMPOSITION: [           // Same composition for every squad
        { unitType: 'ogre',   count: 2,  columns: 2 },
        { unitType: 'orc',    count: 10, columns: 5 },
        { unitType: 'goblin', count: 10, columns: 5 },
    ],

    UNITS: {
        orc:    { hp: 30,  attack: 2.5,  speed: 2.2 },
        goblin: { hp: 20,  attack: 4,    speed: 2.88 },
        ogre:   { hp: 120, attack: 12.5, speed: 1.8 },
    },

    SECTION_HP:            2000,
    SECTION_DEFEND_DAMAGE: 100,    // Total damage per second to engaged melee squads
    COMBAT_TICK_RATE:      1.0,    // Seconds between combat resolution ticks

    WALL_Z:            -25,
    STAGING_Z:          15,
    SECTION_X: { A: -20, B: 0, C: 20 },   // X center per section
    SECTION_BOUNDS: { A: [-30, -10], B: [-10, 10], C: [10, 30] },
    MARCH_ARRIVE_DIST:  3,     // Melee units stop this far from wall
    MARCH_HEADSTART_S:  3,     // Seconds orcs wait before marching (ogres march immediately)
    GOBLIN_RANGE:       8,     // Goblins stop this far from wall (ranged)
    GOBLIN_DEFEND_DAMAGE_SCALE: 0.4,  // Defenders deal 40% damage to ranged goblins

    CAMERA_POS:      { x: 0, y: 30, z: 28 },
    CAMERA_TARGET:   { x: 0, y: 0,  z: -5 },
    CAMERA_MIN_DIST: 10,
    CAMERA_MAX_DIST: 70,
};
```

### 6.3 Unit object (on UnitPool instances)

```
unit.model          THREE.Group — clone from ModelCache
unit.mixer          THREE.AnimationMixer
unit.emissiveMeshes Mesh[] — cached on spawn, used by flashHit
unit.alive          bool
unit.hp / maxHp
unit.marchOffset    THREE.Vector3 — fixed offset within formation grid
unit.yOffset        float — ground-level y correction from normalizeModel
unit.unitType       'orc' | 'goblin' | 'ogre'
unit.pool           UnitPool reference (for killUnit / flashHit dispatch)
unit.attacking      bool — true once unit arrives at target position
unit.marchDelay     float — seconds remaining before unit starts moving
unit.defenderTarget defender object | null — goblins' current defender target
unit.throughRecorded bool — prevents double-counting on breach march
```

### 6.4 WallSection

```
section.id            'A' | 'B' | 'C'
section.hp            current HP (setter sets labelDirty = true)
section.maxHp         CONFIG.SECTION_HP
section.breached      bool
section.engagedSquads Squad[]
section.group         THREE.Group
section.label         CSS2DObject — health bar DOM element
section.labelDirty    bool — true when HP changed, cleared after DOM update
```

---

## 7. Unit System

### 7.1 Squad Composition

Each of the 3 squads has the same mixed composition: 2 ogres (front), 10 orcs, 10 goblins. Ogres lead, orcs follow after `MARCH_HEADSTART_S` delay, goblins follow after `MARCH_HEADSTART_S * 2` delay. This staggers arrival so ogres tank while the rest advance.

### 7.2 Formation Layout

```js
// Formation builds rows per unit group, with ogres in row 0 (closest to wall)
// FORMATION.SPACING = 1.2 units between units in a row
```

Units spread in a grid with their `marchOffset` baked in at spawn time. The arrival target adds `Math.abs(marchOffset.z) * 0.5` to Z so back rows stay behind front rows.

### 7.3 UnitPool (object pooling)

All unit models are pre-allocated at startup, hidden, and pulled from the pool on spawn. `despawn()` hides and returns them. Mixer is added to the global `mixers` Set on spawn and removed on despawn — inactive pool units never run `mixer.update()`.

```js
// On spawn
mixers.add(unit.mixer);
// On despawn
mixers.delete(unit.mixer);
```

### 7.4 Steering Forces

Each marching unit blends three forces each frame:

1. **Seek**: normalized direction toward `targetWorldPos(unit)`, scaled by `speed * dt`
2. **Separation**: push away from any other alive unit within `SEP_RADIUS (0.85)`, strength `SEP_STRENGTH (3.0)`. Checked across all squads.
3. **Obstacle avoidance**: push away from the center of any obstacle within `obs.radius + OBS_CLEARANCE (1.5)`, strength `OBS_STRENGTH (6.0)`. Obstacles are defined in `addDressing()` which returns an array of `{x, z, radius}` circles: rocks (r=1.2), trees (r=0.9), pine groups (r=3.0).

All three are summed into `#_dir` before the position update. The final `rotation.y` is derived from the blended direction so units visually turn as they steer.

Tuning constants live at the top of squad.js: `SEP_RADIUS`, `SEP_STRENGTH`, `OBS_CLEARANCE`, `OBS_STRENGTH`.

### 7.6 March Movement

On `squad.setOrder(section)`:
- All units face toward target section immediately (`rotation.y = atan2(dx, dz)`)
- Ogres start walking immediately (delay = 0)
- Orcs wait `MARCH_HEADSTART_S` seconds before marching
- Goblins wait `MARCH_HEADSTART_S * 2` seconds

During march, each unit moves toward `targetWorldPos(unit)`:
```js
#targetWorldPos(unit) {
    const arrive = unit.unitType === 'goblin' ? CONFIG.GOBLIN_RANGE : CONFIG.MARCH_ARRIVE_DIST;
    this.#_target.set(
        CONFIG.SECTION_X[section] + unit.marchOffset.x,
        0,
        CONFIG.WALL_Z + arrive + Math.abs(unit.marchOffset.z) * 0.5
    );
}
```

Scratch `Vector3`s (`#_target`, `#_dir`) are class-level to avoid per-frame allocation.

### 7.7 Attack State

When `dist <= FORMATION.ARRIVE_THRESHOLD (0.15)`:
- `unit.attacking = true`
- Attack animation plays
- Squad registers itself on the wall section's `engagedSquads`

Every frame for `attacking = true` units, `#faceTarget()` re-orients them toward their target (wall section center for melee, specific defender for goblins).

### 7.6 Breach March

On breach, `game.checkBreach()` calls `squad.marchThroughBreach(breachX)` on ALL squads. Units funnel through the breach, X-clamped to ±4 units around `breachX`. When a unit's Z crosses `CONFIG.WALL_Z`, it records itself through (with 500ms delay) via `game.recordUnitThrough()`. On arrival 12 units past the wall, unit despawns.

### 7.7 Animation States

| State | Clip lookup | Loop |
|---|---|---|
| Idle / waiting | `idle`, `stand` | Yes |
| Marching | `walk`, `run` | Yes |
| Attacking | `attack` | Yes |
| Dying | `death`, `die` | No (clamp) |

If no death clip exists, model is rotated flat (`rotation.x = -PI/2`) as a visual stand-in.

### 7.8 Unit Death

```
1. unit.alive = false; hp = 0
2. playDeath(unit) — death anim or flat rotation
3. After UNIT_FX.DEATH_LINGER_MS (1500ms), pool.despawn(unit)
4. unit removed from squad.units
5. If squad.units.length === 0 → squad.order = 'idle'; game.checkDefeat()
```

---

## 8. Wall System

### 8.1 Physical Layout

Three sections, each ~20 X units wide. Each section is built by `buildWall()` in `wall.js`:

```
[WallTower] [Wall][Wall][Wall][Wall] [WallTower]
            ←——— section spans ~20 units ———→
```

Section X bounds:
- Section A: x from -30 to -10
- Section B: x from -10 to +10
- Section C: x from +10 to +30

The center door (`DoorClosed` / `Door`) is toggled on breach. Both gate models pre-placed; visibility swapped.

### 8.2 HP Tracking

`section.hp` is a property with a setter that sets `section.labelDirty = true` whenever HP changes. The main loop only calls `updateLabel(section)` when `labelDirty` is true, preventing unnecessary DOM writes.

### 8.3 Breach

```js
breach() {
    this.breached = true;
    this.closedGate.visible = false;
    this.openGate.visible   = true;
    this.label.element.classList.add('breached');  // gold color in CSS2D
    game.checkBreach();
}
```

After breach, `defGroup.remove()` despawns all defenders for that section, and `audio.play('breach')` / `audio.play('orc-wall')` fire.

---

## 9. Wall Defenders

**Decision (not in original TDD):** Wall sections have animated defender figures — archers and mages — placed on the wall top. Their presence and HP affects combat.

### 9.1 WallDefenders (defenders.js)

Each section gets 8 defenders at fixed X positions (`DEFENDERS.X_POSITIONS = [-8,-6,-4,-2,2,4,6,8]` relative to section center). Indices in `DEFENDERS.MAGE_INDICES` use the Wizard model; others use `Character_Male_1`.

```js
DEFENDERS = {
    WALL_TOP_Y:    4.7,    // y of wall top
    HEIGHT:        0.85,   // normalized height
    X_POSITIONS:   [-8, -6, -4, -2, 2, 4, 6, 8],
    MAGE_INDICES:  new Set([2, 5]),
    FIRE_Y:        5.2,    // projectile origin y
    FIRE_Z_OFF:    0.6,    // z offset toward attackers for projectile spawn
    DEFENDER_HP:   30,
};
```

### 9.2 Combat Interaction

- Alive defender count scales volley output: `aliveRatio = aliveCount / totalDefenders`
- `effectiveDmg = SECTION_DEFEND_DAMAGE * aliveRatio` — wall section deals less damage as defenders die
- Goblins target individual defenders: each attacking goblin picks a defender, damages it with `CONFIG.UNITS.goblin.attack` per combat tick
- On breach, `defGroup.remove()` removes all defenders from scene

### 9.3 Defender Orientation

Defenders face +Z (toward staging area / attackers) at `rotation.y = 0`, which is their default. No rotation needed.

---

## 10. Combat System

### 10.1 Tick-Based Resolution (combat.js)

Runs on `CONFIG.COMBAT_TICK_RATE` (1.0s) fixed interval. Two damage tracks per tick:

**Melee track (orcs, ogres → wall):**
```
totalMeleeAttack = sum of attack values of all engaged melee units
section.hp -= totalMeleeAttack
Wall deals back: effectiveDmg / meleeSquads.length to each melee squad
```

**Goblin track (goblins → individual defenders):**
```
Each attacking goblin damages its defenderTarget by CONFIG.UNITS.goblin.attack
Defenders deal back: effectiveDmg * GOBLIN_DEFEND_DAMAGE_SCALE / goblinSquads.length
```

Goblins deal 40% normal defender damage because they're out of melee range.

### 10.2 Damage Distribution

Within a squad, damage falls on a random surviving unit. The hit unit gets a flash effect via `squad.flashHit(unit)` which sets emissive intensity on cached mesh list (no traverse needed). If unit HP ≤ 0, `squad.killUnit(unit)`.

### 10.3 Win/Loss Checks

`game.checkDefeat()` runs every combat tick. Defeat condition: all squads have 0 units AND no section breached. Victory: at least one unit recorded through breach AND all squads gone (checked in `checkDefeat()` during breach state).

---

## 11. Projectile System

**Decision (not in original TDD):** Defenders fire visual projectiles at attacking squads. Goblins fire spears at individual defenders. All projectile meshes are pooled.

### 11.1 Pools

Three pools pre-created at startup in `main.js`:
- `arrow` pool (20): `CylinderGeometry` — archers fire at engaged/nearby units
- `bolt` pool (20): `SphereGeometry` — mages fire magic bolts (no `lookAt`, spherical)
- `spear` pool (40): `CylinderGeometry` — goblins fire at defenders

**Geometry fix (June 20):** `arrowGeo` and `spearGeo` have `.rotateX(Math.PI / 2)` applied at creation so the cylinder's long axis aligns with Z. `mesh.lookAt(to)` then correctly orients the cylinder along the flight path.

### 11.2 Volley Timing

Every `PROJECTILES.TICK_INTERVAL` (0.35s), `tickProjectiles()` fires volleys. Volume scales with alive defenders (`aliveRatio`). Archers target units within `ARCHER_RANGE (10)` units from wall; mages target within `MAGE_RANGE (12)`. Each tick fires `VOLLEY_COUNT (3)` projectiles (adjusted by aliveRatio). 25% magic chance per volley.

Goblins also fire spears each tick — one per attacking goblin with a `defenderTarget`.

### 11.3 Flight

Projectiles lerp from `from` to `to` over `PROJECTILES.DURATION (0.45s)` with a sine arc of `ARC_HEIGHT (2.0)` units. On expiry, mesh is hidden and returned to pool.

---

## 12. Audio System

**Decision (not in original TDD):** HTML Audio API with per-key pools of `Audio` objects to allow overlapping playback.

```js
// audio.js
const SOUNDS = {
    'battle-start': '/assets/sfx/battle_start.wav',
    'march':        '/assets/sfx/enemy_start_move.wav',
    'breach':       '/assets/sfx/breach.wav',
    'arrow':        '/assets/sfx/archer.mp3',
    'mage':         '/assets/sfx/mage.wav',
    'spear':        '/assets/sfx/spear.wav',
    'melee':        ['/assets/sfx/melee1.wav', '/assets/sfx/melee2.wav', '/assets/sfx/melee3.wav'],
    'ogre':         '/assets/sfx/ogre.mp3',
    'orc-wall':     '/assets/sfx/orc_on_wall.wav',
};
```

Each key has a pool of 3 `Audio` instances (for multi-URL keys like 'melee', each URL gets 3). Pool cycles round-robin. Per-key cooldowns (150–2500ms) prevent spam.

Sound toggle button in HUD controls `audio.muted` flag.

### 12.1 Trigger Points

| Sound | When |
|---|---|
| `battle-start` | First order issued (READY → PLAYING) |
| `march` | Subsequent orders |
| `arrow` | Each arrow projectile fired |
| `bolt`/`mage` | Each magic bolt fired |
| `spear` | Each goblin spear fired |
| `melee` | Each combat tick with melee attackers |
| `ogre` | 15% chance each combat tick with ogre present |
| `breach` | Wall section HP reaches 0 |
| `orc-wall` | Same as breach |

---

## 13. UI Architecture

Three rendering layers stacked:

```
┌─────────────────────────────────────┐
│  HTML overlay (z-index: 20)         │  ← Timer, squad panel, order menu, breach counter
├─────────────────────────────────────┤
│  CSS2DRenderer (absolute, z: auto)  │  ← Wall section HP bars (3D-tracked)
├─────────────────────────────────────┤
│  WebGLRenderer (canvas)             │  ← Three.js scene
└─────────────────────────────────────┘
```

### 13.1 HUD Elements

| Element | Position | Notes |
|---|---|---|
| Timer | Top-left | Counts up from 00:00 |
| Objective banner | Bottom-center | Updates on state changes |
| Mana display | Top-right | Reserved; inert |
| Sound toggle 🔊 | Top-right (below mana) | Calls audio.toggle() |
| Squad panel | Bottom-left | 3 cards, click to select squad |
| Order menu | Bottom-right | Appears on squad select; 3 section buttons |
| Breach counter | Bottom-right | Replaces order menu on breach |

### 13.2 Squad Card Update

`ui.update(dt)` runs every frame during PLAYING/BREACH. Updates timer and squad cards. Card HP bar color: green (>60%), orange (30–60%), red (<30%). Unit count badge (`×N`) tracks `squad.units.filter(u => u.alive).length`.

### 13.3 Input Flow

1. Click squad card → `game.selectSquad(id)` → order menu appears
2. Click section button → `game.issueOrder(squadId, section)` → squad marches
3. On breach: breach counter replaces order menu; all squads auto-march through

---

## 14. Camera

### 14.1 Setup

```js
const camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 200);
camera.position.set(0, 30, 28);  // CONFIG.CAMERA_POS
camera.lookAt(0, 0, -5);         // CONFIG.CAMERA_TARGET
```

### 14.2 OrbitControls

**Decision (vs original TDD):** OrbitControls are enabled for the player, not just as a debug toggle. Min distance: 10, max: 70, max polar angle: PI/2.1 (can't go below horizon). Enables pan and damping (factor 0.08).

---

## 15. Rendering & Performance

### 15.1 Unit Count

| Squad | Ogres | Orcs | Goblins | Total |
|---|---|---|---|---|
| Squad 1 | 2 | 10 | 10 | 22 |
| Squad 2 | 2 | 10 | 10 | 22 |
| Squad 3 | 2 | 10 | 10 | 22 |
| **Total** | **6** | **30** | **30** | **66** |

Plus 8 defenders × 3 sections = 24 defenders. Total max ~90 visible models.

### 15.2 Performance Decisions Made

| Optimization | Status | File |
|---|---|---|
| AnimationMixer Set (only active units) | Done | scene.js, squad.js, defenders.js |
| emissiveMeshes cached on unit objects | Done | squad.js |
| Scratch Vector3s in Squad.update() | Done | squad.js |
| labelDirty flag for CSS2D HP bars | Done | wall.js, main.js |
| Projectile mesh pooling | Done | main.js |
| Projectile Vector3 reuse | Done | main.js |
| aliveCount integer in WallDefenders | Done | defenders.js |
| Shadow map quality (PCFSoft, 2048) | Pending — see performance_todo.md | scene.js |

### 15.3 Pixel Ratio Cap

```js
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```

---

## 17. Squad Assembly Screen (added June 20, 2026)

### Overview

Replaces the previous system (3 pre-configured squads, battle starts immediately in READY). The player now assembles units into 6 squads before battle begins.

### 6 Squads

| ID | Label | Behavior | Ogres allowed? |
|---|---|---|---|
| `autoL` | Left | Auto-marches to chosen wall section at battle start | Yes |
| `autoC` | Center | Auto-marches to chosen wall section at battle start | Yes |
| `autoR` | Right | Auto-marches to chosen wall section at battle start | Yes |
| `resL` | Reserve Left | Player-controlled (same as pre-existing squad behavior) | No |
| `resC` | Reserve Center | Player-controlled | No |
| `resR` | Reserve Right | Player-controlled | No |

Auto-squads do not appear in the battle HUD squad panel — they auto-march immediately and need no player direction.

### Unit Pool

Total: 6 ogres, 30 orcs, 30 goblins = 66 units. Defined in `TOTAL_UNITS` constant. Pool sizes = `TOTAL_UNITS` values directly (no longer derived from `SQUAD_COMPOSITION × SQUAD_COUNT`).

### Zone Layout (world coordinates)

```
Front row (auto-squads, z≈2):   Left [-12,2]  Center [0,2]  Right [12,2]
Rear row  (reserves, z≈11):     ResL [-12,11] ResC   [0,11] ResR  [12,11]
Unassigned pool (z≈22):         [0,22]  (30-unit wide pad)
```

Zone pad colors: auto=blue, reserve=dark green, pool=brown.

### Drag-and-Drop

- All 66 units are spawned from pools (actual GLTF models) into the Unassigned zone at setup start
- Player drags a unit model: `mousedown` → raycast picks unit mesh, lifts it by `SETUP.LIFT_Y=1.5` units, disables OrbitControls
- `mousemove` → unit follows cursor on ground plane; zone pads highlight under cursor (red if ogre over reserve zone)
- `mouseup` → unit assigned to hovered zone; formation repacked via `packZone()`; OrbitControls re-enabled
- Invalid drop (ogre→reserve, or drop outside all zones): unit returns to origin zone; warning shown for 2.2s

### Assign All Button

Distributes all unassigned units evenly:
- Ogres → round-robin across autoL/autoC/autoR only (2 per auto-squad)
- Orcs + Goblins → round-robin across all 6 squads (10 per squad)

### Start Battle Condition

Start Battle button enabled only when `unassigned count === 0`. Empty squads are allowed — all 66 units just need to be in some squad.

### Formation Packing

`packZone(id)` arranges a zone's units in a square-ish grid: `cols = ceil(sqrt(n))`, spacing = 1.2 units centered on zone origin.

### Squad Construction (Squad.fromUnits)

When Start Battle is clicked, `buildSquadsFromSetup()` constructs 6 `Squad` instances using `Squad.fromUnits(id, label, units, stagingPos)`:
- Accepts pre-spawned unit array (avoids double-spawn; same meshes move from setup positions to battle formations)
- Sorts: ogres first, then orcs, then goblins within each squad
- Columns = `ceil(sqrt(n))` for the squad's formation

### Camera

Setup: `{x:0, y:45, z:45}` targeting `{x:0, y:0, z:10}` — pulled back to see all zones.
On Start Battle: 1.2-second lerp back to `CONFIG.CAMERA_POS = {x:0, y:30, z:28}`.

---

## 16. Known Risks & Mitigations

| Risk | Status | Notes |
|---|---|---|
| `SkeletonUtils.clone()` required for skinned models | Mitigated | `ModelCache.clone()` encapsulates this |
| `Box3.setFromObject()` floating on animated models | Mitigated | `normalizeModel()` uses mesh-only bounds |
| Sound inaudible in browser | Fixed (June 20) | Rewritten to Web Audio API: fetch → decodeAudioData → BufferSource; handles suspended context |
| Units occupy same space when multiple squads at same section | Fixed (June 20) | Push-apart separation force in march loop; SEP_RADIUS=0.85, SEP_STRENGTH=3.0 |
| Unit facing direction incorrect in some states | Needs verification | atan2 math audited correct; no code bug found in attacker units; defender facing needs in-game check |
| Projectile cylinder facing wrong direction | Fixed (June 20) | `arrowGeo/spearGeo.rotateX(PI/2)` applied at geometry creation |
| Marching units flash red (not taking damage) | Fixed (June 20) | `#damageSquad` now filters `u.attacking`; also guards `damage <= 0` (zero-damage flash when all defenders dead) |
| Defenders animate (attack loop) when no squads present | Fixed (June 20) | Defenders start idle; `activateCombat()` switches to attack on first squad engagement |
| Units path through rocks and trees | Fixed (June 20) | Proximity-based obstacle avoidance steering in march loop; `addDressing()` returns obstacle circles; each unit avoids independently |
| Wall assembly seams between tiles | Mitigated | `WALL.SX/SY/SZ` scale constants adjusted by hand |
| glTF path with spaces ("Pixel Blocks" folder) | N/A | Unused in this prototype |

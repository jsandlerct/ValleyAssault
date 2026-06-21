// ── Asset paths ──────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL;
export const PATHS = {
    ORC:           `${BASE}assets/cubeworld/Enemies/glTF/Zombie.gltf`,
    GOBLIN:        `${BASE}assets/cubeworld/Enemies/glTF/Goblin.gltf`,
    OGRE:          `${BASE}assets/cubeworld/Enemies/glTF/Giant.gltf`,
    WALL:          `${BASE}assets/buildings/glTF/Wall_FirstAge.gltf`,
    TOWER:         `${BASE}assets/buildings/glTF/WallTowers_FirstAge.gltf`,
    DOOR_CLOSED:   `${BASE}assets/buildings/glTF/WallTowers_DoorClosed_FirstAge.gltf`,
    DOOR_OPEN:     `${BASE}assets/buildings/glTF/WallTowers_Door_FirstAge.gltf`,
    MOUNTAIN_LG:   `${BASE}assets/buildings/glTF/MountainLarge_Single.gltf`,
    MOUNTAIN_GRP:  `${BASE}assets/buildings/glTF/Mountain_Group_1.gltf`,
    MOUNTAIN_GRP2: `${BASE}assets/buildings/glTF/Mountain_Group_2.gltf`,
    PINE_GRP:      `${BASE}assets/buildings/glTF/Resource_PineTree_Group.gltf`,
    TREE1:         `${BASE}assets/cubeworld/Environment/glTF/Tree_1.gltf`,
    ROCK:          `${BASE}assets/cubeworld/Environment/glTF/Rock1.gltf`,
    ARCHER:        `${BASE}assets/cubeworld/Characters/glTF/Character_Male_1.gltf`,
    MAGE:          `${BASE}assets/cubeworld/Enemies/glTF/Wizard.gltf`,
    KNIGHT_HORSE:  `${BASE}assets/cubeworld/Animals/glTF/Horse.gltf`,
    KNIGHT_RIDER:  `${BASE}assets/cubeworld/Characters/glTF/Character_Male_2.gltf`,
    BOW:           `${BASE}assets/cubeworld/Tools/glTF/Pickaxe_Wood.gltf`,
};

// ── Scene / renderer ─────────────────────────────────────────────────────────
export const SCENE = {
    SKY_COLOR:          0x5a7a9a,
    FOG_NEAR:           60,
    FOG_FAR:            120,
    CAMERA_FOV:         45,
    CAMERA_NEAR:        0.1,
    CAMERA_FAR:         200,
    GROUND_W:           100,
    GROUND_D:           70,
    GROUND_COLOR:       0x4a7c47,
    AMBIENT_COLOR:      0xfff4e0,
    AMBIENT_INTENSITY:  0.5,
    SUN_COLOR:          0xffffff,
    SUN_INTENSITY:      1.2,
    SUN_POS:            { x: 10, y: 20, z: 15 },
    SHADOW_EXTENT_H:    35,
    SHADOW_EXTENT_V:    30,
    SHADOW_MAP_SIZE:    2048,
    HEMI_SKY:           0x88aaff,
    HEMI_GROUND:        0x443322,
    HEMI_INTENSITY:     0.3,
};

// ── Wall geometry scales ──────────────────────────────────────────────────────
export const WALL = {
    SX: 1.5,   // x/z scale — width
    SY: 9.0,   // y scale   — height
    SZ: 2.5,   // z scale   — thickness
};

// ── Wall defenders ────────────────────────────────────────────────────────────
export const DEFENDERS = {
    WALL_TOP_Y:    4.7,
    HEIGHT:        0.85,
    X_POSITIONS:   [-8, -6, -4, -2, 2, 4, 6, 8],
    MAGE_INDICES:  new Set([2, 5]),
    FIRE_Y:        5.2,
    FIRE_Z_OFF:    0.6,
    ARCHER_SPREAD: 14,
    DEFENDER_HP:   30,
    ARCHER_ATTACK: 10,
    MAGE_ATTACK:   25,
};

// ── Projectiles ───────────────────────────────────────────────────────────────
export const PROJECTILES = {
    TICK_INTERVAL:          0.70,
    ARROW_DURATION:         0.45,
    BOLT_DURATION:          0.45,
    SPEAR_DURATION:         0.90,
    ARC_HEIGHT:             2.0,
    VOLLEY_COUNT:           3,
    MAGIC_CHANCE:           0.25,
    ARCHER_RANGE:           10,   // units from wall archers can target
    MAGE_RANGE:             12,   // units from wall mages can target
    MAGE_X_LOCAL:          [-4, 4],
    ARROW_RADIUS:           0.02,
    ARROW_LENGTH:           0.35,
    ARROW_COLOR:            0x3D2200,
    BOLT_RADIUS:            0.09,
    BOLT_COLOR:             0xFF6600,
    TARGET_Y_OFFSET:        0.5,
};

// ── Unit damage visuals ───────────────────────────────────────────────────────
export const UNIT_FX = {
    HIT_FLASH_MS:           200,
    DEATH_LINGER_MS:        1500,
    HIT_EMISSIVE:           0xff2200,
    HIT_EMISSIVE_INTENSITY: 0.6,
};

// ── Formation ─────────────────────────────────────────────────────────────────
export const FORMATION = {
    SPACING:          1.2,
    ARRIVE_THRESHOLD: 0.15,
};

// ── Unit model heights for normalization ──────────────────────────────────────
export const UNIT_HEIGHTS = {
    orc:    0.9,
    goblin: 0.7,
    ogre:   1.4,
};

// ── Knight defender ───────────────────────────────────────────────────────────
export const KNIGHT = {
    // Model assembly
    HORSE_H:      1.2,    // normalized horse height (world units)
    RIDER_H:      0.70,   // normalized rider height
    SADDLE_FRAC:  0.50,   // fraction of horse height where rider feet sit
    SILVER:       0xd8e0ec,

    // Combat stats — same HP/attack as ogre, speed marginally faster than goblin (2.88)
    HP:           120,
    ATTACK:       25,
    ATTACK_SPEED: 0.5,
    SPEED:        3.1,
};

// ── Total unit pool (shared across all 6 squads) ──────────────────────────────
export const TOTAL_UNITS = {
    ogre:   9,
    orc:    45,
    goblin: 45,
};

// ── Pool sizes — max units that can ever exist across all years ────────────────
// Year 1 starts with 99 units; damage bonuses can add up to 300 more per year.
export const POOL_SIZES = {
    ogre:   10,
    orc:    200,
    goblin: 200,
};

// ── Campaign ──────────────────────────────────────────────────────────────────
export const CAMPAIGN = {
    MAX_YEARS:     10,
    STARTING_OGRES: 9,
};

// ── Pre-battle setup screen ───────────────────────────────────────────────────
export const SETUP = {
    LIFT_Y: 1.5,
    ZONE_SPACING: 1.2,
    ZONES: {
        autoL: { x: -12, z:  2,  label: 'Left',           isReserve: false, isAuto: true,  padW: 10, padD: 7 },
        autoC: { x:   0, z:  2,  label: 'Center',         isReserve: false, isAuto: true,  padW: 10, padD: 7 },
        autoR: { x:  12, z:  2,  label: 'Right',          isReserve: false, isAuto: true,  padW: 10, padD: 7 },
        resL:  { x: -12, z: 11,  label: 'Reserve Left',   isReserve: true,  isAuto: false, padW: 10, padD: 7 },
        resC:  { x:   0, z: 11,  label: 'Reserve Center', isReserve: true,  isAuto: false, padW: 10, padD: 7 },
        resR:  { x:  12, z: 11,  label: 'Reserve Right',  isReserve: true,  isAuto: false, padW: 10, padD: 7 },
        pool:  { x:   0, z: 22,  label: 'Unassigned',     isReserve: false, isAuto: false, padW: 30, padD: 8 },
    },
    PAD_COLORS: {
        auto:     0x2255aa,
        reserve:  0x225522,
        pool:     0x553311,
        hover:    0x4488ff,
        invalid:  0xaa2222,
    },
    SETUP_CAMERA_POS:    { x: 0, y: 45, z: 45 },
    SETUP_CAMERA_TARGET: { x: 0, y: 0,  z: 10 },
};

// ── Defense reinforcements ────────────────────────────────────────────────────
export const REINFORCEMENT = {
    TRICKLE_INTERVAL: 10,   // seconds between trickle archer spawns
    DEFENDER_CAP:     20,   // max alive defenders per wall segment

    EVENT1_MIN: 10, EVENT1_MAX: 25,
    EVENT2_MIN: 35, EVENT2_MAX: 55,
    EVENT3_MIN: 80, EVENT3_MAX: 100,

    R1_ARCHERS:   4,
    R1_MAGES:     2,
    SORTIE_COUNT: 12,
};

// ── Main game config ──────────────────────────────────────────────────────────
export const CONFIG = {
    SQUAD_COUNT: 3,
    BREACH_VICTORY_COUNT: 10,  // units that must survive the breach to win
    // Default composition per squad — kept for reference; pools use TOTAL_UNITS
    SQUAD_COMPOSITION: [
        { unitType: 'ogre',   count: 2,  columns: 2 },
        { unitType: 'orc',    count: 10, columns: 5 },
        { unitType: 'goblin', count: 10, columns: 5 },
    ],

    UNITS: {
        orc:    { hp: 30,  attack: 2.5,  attackSpeed: 1.0, speed: 2.2 },
        goblin: { hp: 20,  attack: 4,    attackSpeed: 1.0, speed: 2.88 },
        ogre:   { hp: 120, attack: 25,   attackSpeed: 0.5, speed: 1.8 },
    },

    SECTION_HP:       1000,

    COMBAT_TICK_RATE: 1.0,

    WALL_Z:            -25,
    BREACH_THROUGH_Z:  -35,  // unit counts as "through" once past this Z (far edge of brown ground) and all knights dead
    STAGING_Z:          15,
    SECTION_X: { A: -20, B: 0, C: 20 },
    SECTION_BOUNDS: { A: [-30, -10], B: [-10, 10], C: [10, 30] },
    MARCH_ARRIVE_DIST: 3,
    MARCH_HEADSTART_S: 3,  // seconds non-vanguard units wait before marching
    RETREAT_Z:         38, // units despawn (escaped) once they pass this Z
    GOBLIN_RANGE:      8,   // goblins stop further back — ranged unit

    WALL_SCALE: 1.0,

    CAMERA_POS:      { x: 0, y: 30, z: 28 },
    CAMERA_TARGET:   { x: 0, y: 0,  z: -5 },
    CAMERA_MIN_DIST: 10,
    CAMERA_MAX_DIST: 70,
};

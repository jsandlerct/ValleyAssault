// ── Asset paths ──────────────────────────────────────────────────────────────
export const PATHS = {
    ORC:           '/assets/cubeworld/Enemies/glTF/Zombie.gltf',
    GOBLIN:        '/assets/cubeworld/Enemies/glTF/Goblin.gltf',
    OGRE:          '/assets/cubeworld/Enemies/glTF/Giant.gltf',
    WALL:          '/assets/buildings/glTF/Wall_FirstAge.gltf',
    TOWER:         '/assets/buildings/glTF/WallTowers_FirstAge.gltf',
    DOOR_CLOSED:   '/assets/buildings/glTF/WallTowers_DoorClosed_FirstAge.gltf',
    DOOR_OPEN:     '/assets/buildings/glTF/WallTowers_Door_FirstAge.gltf',
    MOUNTAIN_LG:   '/assets/buildings/glTF/MountainLarge_Single.gltf',
    MOUNTAIN_GRP:  '/assets/buildings/glTF/Mountain_Group_1.gltf',
    MOUNTAIN_GRP2: '/assets/buildings/glTF/Mountain_Group_2.gltf',
    PINE_GRP:      '/assets/buildings/glTF/Resource_PineTree_Group.gltf',
    TREE1:         '/assets/cubeworld/Environment/glTF/Tree_1.gltf',
    ROCK:          '/assets/cubeworld/Environment/glTF/Rock1.gltf',
    ARCHER:        '/assets/cubeworld/Characters/glTF/Character_Male_1.gltf',
    MAGE:          '/assets/cubeworld/Enemies/glTF/Wizard.gltf',
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
    TICK_INTERVAL:          0.35,
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

// ── Total unit pool (shared across all 6 squads) ──────────────────────────────
export const TOTAL_UNITS = {
    ogre:   9,
    orc:    45,
    goblin: 45,
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

// ── Main game config ──────────────────────────────────────────────────────────
export const CONFIG = {
    SQUAD_COUNT: 3,
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

    SECTION_HP:       2000,

    COMBAT_TICK_RATE: 1.0,

    WALL_Z:            -25,
    STAGING_Z:          15,
    SECTION_X: { A: -20, B: 0, C: 20 },
    SECTION_BOUNDS: { A: [-30, -10], B: [-10, 10], C: [10, 30] },
    MARCH_ARRIVE_DIST: 3,
    MARCH_HEADSTART_S: 3,  // seconds non-vanguard units wait before marching
    GOBLIN_RANGE:      8,   // goblins stop further back — ranged unit

    WALL_SCALE: 1.0,

    CAMERA_POS:      { x: 0, y: 30, z: 28 },
    CAMERA_TARGET:   { x: 0, y: 0,  z: -5 },
    CAMERA_MIN_DIST: 10,
    CAMERA_MAX_DIST: 70,
};

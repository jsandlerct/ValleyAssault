import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

vi.mock('three', () => ({
    MeshStandardMaterial: class {},
    CanvasTexture: class {
        repeat = { set() {} };
        wrapS  = 0;
        wrapT  = 0;
    },
    RepeatWrapping: 1002,
    DoubleSide:     2,
    BoxGeometry:    class {},
    PlaneGeometry:  class {},
    Mesh: class {
        position = { set() {}, x: 0, y: 0, z: 0 };
        rotation = { set() {}, x: 0, y: 0, z: 0 };
        castShadow    = false;
        receiveShadow = false;
    },
    Group: class {
        position = { x: 0, y: 0, z: 0, set() {} };
        add()      {}
        traverse() {}
    },
    Box3: class {
        isEmpty()         { return true; }
        union()           { return this; }
        setFromObject()   { return this; }
        getSize(v)        { v.x = 1; v.y = 1; v.z = 1; return v; }
        applyMatrix4()    { return this; }
    },
    Vector3: class {
        constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
        set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
        clone()      { return { x: this.x, y: this.y, z: this.z }; }
    },
}));

vi.mock('../scene.js',  () => ({
    scene:  { add: vi.fn(), remove: vi.fn() },
    mixers: new Set(),
}));
vi.mock('../ui-3d.js',  () => ({ createSectionLabel: vi.fn(), updateLabel: vi.fn() }));
vi.mock('../game.js',   () => ({
    game:  { checkBreach: vi.fn(), checkDefeat: vi.fn() },
    State: {},
    Game:  class {},
}));

import { WallSection } from '../wall.js';
import { game }        from '../game.js';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WallSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('starts at full HP and labelDirty=true', () => {
        const s = new WallSection('A');
        expect(s.hp).toBe(s.maxHp);
        expect(s.labelDirty).toBe(true);
    });

    it('hp setter marks labelDirty', () => {
        const s = new WallSection('A');
        s.labelDirty = false;
        s.hp = 500;
        expect(s.labelDirty).toBe(true);
        expect(s.hp).toBe(500);
    });

    it('breach() sets breached=true and hp=0', () => {
        const s = new WallSection('B');
        s.breach();
        expect(s.breached).toBe(true);
        expect(s.hp).toBe(0);
    });

    it('breach() calls onBreach callback exactly once', () => {
        const s      = new WallSection('C');
        const onBreach = vi.fn();
        s.onBreach   = onBreach;
        s.breach();
        expect(onBreach).toHaveBeenCalledOnce();
    });

    it('breach() calls game.checkBreach()', () => {
        const s = new WallSection('A');
        s.breach();
        expect(game.checkBreach).toHaveBeenCalledOnce();
    });

    it('breach() is idempotent — second call is a no-op', () => {
        const s      = new WallSection('A');
        const onBreach = vi.fn();
        s.onBreach   = onBreach;
        s.breach();
        s.breach();
        expect(onBreach).toHaveBeenCalledOnce();
        expect(game.checkBreach).toHaveBeenCalledOnce();
    });

    it('breach() sets engaged squads from "engaged" to "idle"', () => {
        const s     = new WallSection('A');
        const squad = { order: 'engaged' };
        s.engagedSquads = [squad];
        s.breach();
        expect(squad.order).toBe('idle');
    });

    it('breach() leaves non-engaged squads unchanged', () => {
        const s     = new WallSection('A');
        const squad = { order: 'marching' };
        s.engagedSquads = [squad];
        s.breach();
        expect(squad.order).toBe('marching');
    });
});

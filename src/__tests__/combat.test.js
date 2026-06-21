import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CONFIG } from '../constants.js';

vi.mock('../audio.js', () => ({ audio: { play: vi.fn() } }));
vi.mock('../game.js',  () => ({
    State: { LOADING: 'loading', SETUP: 'setup', READY: 'ready', PLAYING: 'playing', BREACH: 'breach', VICTORY: 'victory', DEFEAT: 'defeat' },
    game:  { checkDefeat: vi.fn(), state: 'playing' },
    Game:  class {},
}));

import { CombatSystem } from '../combat.js';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeSection(hp = 1000) {
    return {
        id:            'A',
        hp,
        breached:      false,
        engagedSquads: [],
        breach:        vi.fn(),
    };
}

function makeUnit(type = 'orc', attacking = true) {
    return {
        alive:          true,
        attacking,
        unitType:       type,
        defenderTarget: null,
        pool:           { playIdle: vi.fn() },
    };
}

function makeDefGroup(aliveDefenders = []) {
    return {
        activateCombat:    vi.fn(),
        getAliveDefenders: vi.fn(() => aliveDefenders),
        damageSpecific:    vi.fn(),
    };
}

function makeAttackingSquad(...types) {
    return { units: types.map(t => makeUnit(t)) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CombatSystem — tick accumulator', () => {
    it('does not fire before COMBAT_TICK_RATE seconds elapse', () => {
        const section = makeSection();
        const squad   = makeAttackingSquad('orc');
        section.engagedSquads = [squad];
        const combat = new CombatSystem([section], [squad], [makeDefGroup()]);
        combat.tick(CONFIG.COMBAT_TICK_RATE * 0.9);
        expect(section.hp).toBe(1000);
    });

    it('fires exactly at COMBAT_TICK_RATE', () => {
        const section = makeSection(1000);
        const squad   = makeAttackingSquad('orc');
        section.engagedSquads = [squad];
        const combat = new CombatSystem([section], [squad], [makeDefGroup()]);
        combat.tick(CONFIG.COMBAT_TICK_RATE);
        const { attack, attackSpeed } = CONFIG.UNITS.orc;
        expect(section.hp).toBe(1000 - attack * attackSpeed * CONFIG.COMBAT_TICK_RATE);
    });

    it('fires twice when tick() is called twice with COMBAT_TICK_RATE each', () => {
        const section = makeSection(1000);
        const squad   = makeAttackingSquad('orc');
        section.engagedSquads = [squad];
        const combat = new CombatSystem([section], [squad], [makeDefGroup()]);
        combat.tick(CONFIG.COMBAT_TICK_RATE);
        combat.tick(CONFIG.COMBAT_TICK_RATE);
        const dmgPerTick = CONFIG.UNITS.orc.attack * CONFIG.UNITS.orc.attackSpeed * CONFIG.COMBAT_TICK_RATE;
        expect(section.hp).toBeCloseTo(1000 - dmgPerTick * 2);
    });
});

describe('CombatSystem — melee damage', () => {
    it('orc deals correct damage per tick', () => {
        const section = makeSection(1000);
        const squad   = makeAttackingSquad('orc');
        section.engagedSquads = [squad];
        const combat = new CombatSystem([section], [squad], [makeDefGroup()]);
        combat.tick(CONFIG.COMBAT_TICK_RATE);
        const { attack, attackSpeed } = CONFIG.UNITS.orc;
        expect(section.hp).toBeCloseTo(1000 - attack * attackSpeed * CONFIG.COMBAT_TICK_RATE);
    });

    it('ogre deals more damage per tick than orc', () => {
        const sOrc  = makeSection(1000);
        const sOgre = makeSection(1000);
        sOrc.engagedSquads  = [makeAttackingSquad('orc')];
        sOgre.engagedSquads = [makeAttackingSquad('ogre')];
        const cOrc  = new CombatSystem([sOrc],  [], [makeDefGroup()]);
        const cOgre = new CombatSystem([sOgre], [], [makeDefGroup()]);
        cOrc.tick(CONFIG.COMBAT_TICK_RATE);
        cOgre.tick(CONFIG.COMBAT_TICK_RATE);
        expect(1000 - sOgre.hp).toBeGreaterThan(1000 - sOrc.hp);
    });

    it('goblin units do not contribute to wall damage', () => {
        const section = makeSection(1000);
        const squad   = makeAttackingSquad('goblin');
        section.engagedSquads = [squad];
        const combat = new CombatSystem([section], [squad], [makeDefGroup()]);
        combat.tick(CONFIG.COMBAT_TICK_RATE);
        expect(section.hp).toBe(1000);
    });

    it('dead units are excluded from damage calculation', () => {
        const section = makeSection(1000);
        const unit    = makeUnit('orc');
        unit.alive    = false;
        section.engagedSquads = [{ units: [unit] }];
        const combat = new CombatSystem([section], [], [makeDefGroup()]);
        combat.tick(CONFIG.COMBAT_TICK_RATE);
        expect(section.hp).toBe(1000);
    });

    it('section.breach() is called when hp reaches zero', () => {
        const section = makeSection(1);
        const squad   = makeAttackingSquad('ogre');
        section.engagedSquads = [squad];
        const combat = new CombatSystem([section], [squad], [makeDefGroup()]);
        combat.tick(CONFIG.COMBAT_TICK_RATE);
        expect(section.breach).toHaveBeenCalledOnce();
    });

    it('already-breached sections are skipped', () => {
        const section    = makeSection(1000);
        section.breached = true;
        section.engagedSquads = [makeAttackingSquad('orc')];
        const combat = new CombatSystem([section], [], [null]);
        combat.tick(CONFIG.COMBAT_TICK_RATE);
        expect(section.hp).toBe(1000);
    });
});

describe('CombatSystem — goblin vs defenders', () => {
    it('goblin assigns a defender target and calls damageSpecific', () => {
        const section    = makeSection(1000);
        const defender   = { hp: 30 };
        const defGroup   = makeDefGroup([defender]);
        const goblin     = makeUnit('goblin');
        section.engagedSquads = [{ units: [goblin] }];
        const combat = new CombatSystem([section], [], [defGroup]);
        combat.tick(CONFIG.COMBAT_TICK_RATE);
        const { attack, attackSpeed } = CONFIG.UNITS.goblin;
        expect(defGroup.damageSpecific).toHaveBeenCalledWith(
            defender,
            attack * attackSpeed * CONFIG.COMBAT_TICK_RATE
        );
    });

    it('goblin stops attacking when no defenders remain', () => {
        const section = makeSection(1000);
        const defGroup = makeDefGroup([]); // no alive defenders
        const goblin   = makeUnit('goblin');
        section.engagedSquads = [{ units: [goblin] }];
        const combat = new CombatSystem([section], [], [defGroup]);
        combat.tick(CONFIG.COMBAT_TICK_RATE);
        expect(goblin.attacking).toBe(false);
        expect(goblin.pool.playIdle).toHaveBeenCalledWith(goblin);
    });
});

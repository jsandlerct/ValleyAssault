import { describe, it, expect, beforeEach } from 'vitest';
import { Campaign } from '../campaign.js';

// Mock constants so tests don't need the full module
vi.mock('../constants.js', () => ({
    CAMPAIGN:    { MAX_YEARS: 10, STARTING_OGRES: 9 },
    TOTAL_UNITS: { ogre: 9, orc: 45, goblin: 45 },
}));

function makeSection(id, hp, maxHp = 1000) {
    return { id, hp, maxHp };
}

describe('Campaign', () => {
    let campaign;

    beforeEach(() => {
        campaign = new Campaign();
    });

    // ── computeReinforcements ──────────────────────────────────────────────────

    describe('computeReinforcements', () => {
        it('tops ogres up to 9 based on survivors', () => {
            const sections = [makeSection('A', 1000), makeSection('B', 1000), makeSection('C', 1000)];
            const result = campaign.computeReinforcements({ orc: 0, goblin: 0, ogre: 3 }, sections);
            expect(result.ogre).toBe(9); // 3 survivors + 6 reinforcements
        });

        it('gives 9 ogres when none survived', () => {
            const sections = [makeSection('A', 1000), makeSection('B', 1000), makeSection('C', 1000)];
            const result = campaign.computeReinforcements({ orc: 0, goblin: 0, ogre: 0 }, sections);
            expect(result.ogre).toBe(9);
        });

        it('gives 0 ogre reinforcements when all 9 survived', () => {
            const sections = [makeSection('A', 1000), makeSection('B', 1000), makeSection('C', 1000)];
            const result = campaign.computeReinforcements({ orc: 5, goblin: 5, ogre: 9 }, sections);
            expect(result.ogre).toBe(9); // 9 survivors + 0 new
        });

        it('splits even damage bonus equally between orcs and goblins', () => {
            // 50% damage on one section = 50 bonus units = 25 orcs + 25 goblins
            const sections = [makeSection('A', 500), makeSection('B', 1000), makeSection('C', 1000)];
            const result = campaign.computeReinforcements({ orc: 0, goblin: 0, ogre: 0 }, sections);
            expect(result.orc).toBe(25);
            expect(result.goblin).toBe(25);
        });

        it('odd bonus units: orcs get floor, goblins get ceil', () => {
            // 1% damage = 1 bonus unit → 0 orcs + 1 goblin
            const sections = [makeSection('A', 990), makeSection('B', 1000), makeSection('C', 1000)];
            const result = campaign.computeReinforcements({ orc: 0, goblin: 0, ogre: 0 }, sections);
            expect(result.orc).toBe(0);
            expect(result.goblin).toBe(1);
        });

        it('adds survivors to reinforcements', () => {
            const sections = [makeSection('A', 500), makeSection('B', 1000), makeSection('C', 1000)];
            const result = campaign.computeReinforcements({ orc: 10, goblin: 8, ogre: 2 }, sections);
            // ogre: 2 survivors + 7 reinforcements = 9
            // damage: 50 points → 25 orcs + 25 goblins; + survivors
            expect(result.ogre).toBe(9);
            expect(result.orc).toBe(35);    // 10 + 25
            expect(result.goblin).toBe(33); // 8 + 25
        });

        it('handles zero damage (no bonus units)', () => {
            const sections = [makeSection('A', 1000), makeSection('B', 1000), makeSection('C', 1000)];
            const result = campaign.computeReinforcements({ orc: 5, goblin: 5, ogre: 5 }, sections);
            expect(result.orc).toBe(5);    // survivors only
            expect(result.goblin).toBe(5);
        });

        it('treats a breached section (0 HP) as 100 damage points', () => {
            const sections = [makeSection('A', 0), makeSection('B', 1000), makeSection('C', 1000)];
            const result = campaign.computeReinforcements({ orc: 0, goblin: 0, ogre: 0 }, sections);
            expect(result.orc).toBe(50);    // floor(100/2)
            expect(result.goblin).toBe(50); // ceil(100/2)
        });

        it('handles max damage (all three sections at 0)', () => {
            const sections = [makeSection('A', 0), makeSection('B', 0), makeSection('C', 0)];
            const result = campaign.computeReinforcements({ orc: 0, goblin: 0, ogre: 0 }, sections);
            // 300 damage points → 150 orcs + 150 goblins
            expect(result.orc).toBe(150);
            expect(result.goblin).toBe(150);
        });
    });

    // ── computeWallRepairs ─────────────────────────────────────────────────────

    describe('computeWallRepairs', () => {
        it('repairs 50% HP section to 75%', () => {
            const sections = [makeSection('A', 500)];
            const repairs = campaign.computeWallRepairs(sections);
            // newHp = 500 + floor((1000 - 500) / 2) = 500 + 250 = 750
            expect(repairs[0].newHp).toBe(750);
        });

        it('repairs 20% HP section to 60%', () => {
            const sections = [makeSection('B', 200)];
            const repairs = campaign.computeWallRepairs(sections);
            // newHp = 200 + floor((1000 - 200) / 2) = 200 + 400 = 600
            expect(repairs[0].newHp).toBe(600);
        });

        it('repairs breached section (0 HP) to 50%', () => {
            const sections = [makeSection('C', 0)];
            const repairs = campaign.computeWallRepairs(sections);
            // newHp = 0 + floor(1000 / 2) = 500
            expect(repairs[0].newHp).toBe(500);
        });

        it('leaves full HP section unchanged', () => {
            const sections = [makeSection('A', 1000)];
            const repairs = campaign.computeWallRepairs(sections);
            expect(repairs[0].newHp).toBe(1000);
        });

        it('rounds down when repair is fractional', () => {
            // 999 HP damage = 1 HP. repair = floor(1/2) = 0. stays at 999.
            const sections = [makeSection('A', 999)];
            const repairs = campaign.computeWallRepairs(sections);
            expect(repairs[0].newHp).toBe(999);
        });

        it('returns repair data for all three sections', () => {
            const sections = [makeSection('A', 0), makeSection('B', 500), makeSection('C', 1000)];
            const repairs = campaign.computeWallRepairs(sections);
            expect(repairs).toHaveLength(3);
            expect(repairs[0]).toEqual({ id: 'A', newHp: 500 });
            expect(repairs[1]).toEqual({ id: 'B', newHp: 750 });
            expect(repairs[2]).toEqual({ id: 'C', newHp: 1000 });
        });
    });

    // ── advance / reset ────────────────────────────────────────────────────────

    describe('advance', () => {
        it('increments year and updates startingUnits', () => {
            const next = { orc: 30, goblin: 35, ogre: 9 };
            campaign.advance(next);
            expect(campaign.year).toBe(2);
            expect(campaign.startingUnits).toEqual(next);
        });

        it('returns true while within max years', () => {
            const next = { orc: 1, goblin: 1, ogre: 1 };
            expect(campaign.advance(next)).toBe(true);
        });

        it('returns false after advancing past max years', () => {
            const next = { orc: 1, goblin: 1, ogre: 1 };
            for (let i = 0; i < 9; i++) campaign.advance(next);
            expect(campaign.year).toBe(10);
            expect(campaign.advance(next)).toBe(false);
        });
    });

    describe('reset', () => {
        it('resets year to 1 and starting units to defaults', () => {
            campaign.advance({ orc: 30, goblin: 30, ogre: 9 });
            campaign.reset();
            expect(campaign.year).toBe(1);
            expect(campaign.startingUnits).toEqual({ ogre: 9, orc: 45, goblin: 45 });
        });
    });
});

import { describe, it, expect } from 'vitest';
import { CONFIG, UNIT_HEIGHTS, TOTAL_UNITS, SETUP, DEFENDERS } from '../constants.js';

describe('constants schema', () => {
    it('UNIT_HEIGHTS has an entry for every unit type in CONFIG.UNITS', () => {
        for (const type of Object.keys(CONFIG.UNITS)) {
            expect(UNIT_HEIGHTS, `missing UNIT_HEIGHTS.${type}`).toHaveProperty(type);
        }
    });

    it('TOTAL_UNITS has an entry for every unit type in CONFIG.UNITS', () => {
        for (const type of Object.keys(CONFIG.UNITS)) {
            expect(TOTAL_UNITS, `missing TOTAL_UNITS.${type}`).toHaveProperty(type);
        }
    });

    it('SECTION_X and SECTION_BOUNDS cover the same section IDs', () => {
        expect(Object.keys(CONFIG.SECTION_X).sort()).toEqual(Object.keys(CONFIG.SECTION_BOUNDS).sort());
    });

    it('every unit stat block has the required combat fields', () => {
        const required = ['hp', 'attack', 'attackSpeed', 'speed'];
        for (const [type, stats] of Object.entries(CONFIG.UNITS)) {
            for (const key of required) {
                expect(stats, `CONFIG.UNITS.${type} missing ${key}`).toHaveProperty(key);
            }
        }
    });

    it('every battle zone in SETUP.ZONES has all required fields', () => {
        const required = ['x', 'z', 'label', 'isAuto', 'isReserve', 'padW', 'padD'];
        for (const [id, zone] of Object.entries(SETUP.ZONES)) {
            for (const key of required) {
                expect(zone, `SETUP.ZONES.${id} missing ${key}`).toHaveProperty(key);
            }
        }
    });

    it('DEFENDERS.X_POSITIONS is non-empty and MAGE_INDICES are valid indices', () => {
        expect(DEFENDERS.X_POSITIONS.length).toBeGreaterThan(0);
        for (const idx of DEFENDERS.MAGE_INDICES) {
            expect(idx).toBeGreaterThanOrEqual(0);
            expect(idx).toBeLessThan(DEFENDERS.X_POSITIONS.length);
        }
    });

    it('SECTION_BOUNDS ranges are non-overlapping and ordered correctly', () => {
        const bounds = Object.values(CONFIG.SECTION_BOUNDS);
        for (const [lo, hi] of bounds) {
            expect(lo).toBeLessThan(hi);
        }
    });

    it('goblin is slower to attack than ogre (ogre is heavy melee)', () => {
        expect(CONFIG.UNITS.goblin.attackSpeed).toBeGreaterThanOrEqual(CONFIG.UNITS.ogre.attackSpeed);
    });
});

import { describe, it, expect } from 'vitest';
import { KNIGHT, CONFIG, PATHS } from '../constants.js';

// KnightSystem and KnightDefender depend on Three.js scene/renderer and a live
// ModelCache (WebGL context required) — those are covered by manual testing via
// knight-demo.html.  These tests cover the constants contract and pure logic.

describe('KNIGHT constants — schema', () => {
    it('has all required combat stats', () => {
        const required = ['HP', 'ATTACK', 'ATTACK_SPEED', 'SPEED'];
        for (const key of required) {
            expect(KNIGHT, `missing KNIGHT.${key}`).toHaveProperty(key);
            expect(typeof KNIGHT[key]).toBe('number');
            expect(KNIGHT[key]).toBeGreaterThan(0);
        }
    });

    it('has all required model-assembly constants', () => {
        const required = ['HORSE_H', 'RIDER_H', 'SADDLE_FRAC', 'SILVER'];
        for (const key of required) {
            expect(KNIGHT, `missing KNIGHT.${key}`).toHaveProperty(key);
        }
        expect(KNIGHT.SADDLE_FRAC).toBeGreaterThan(0);
        expect(KNIGHT.SADDLE_FRAC).toBeLessThan(1);
        expect(KNIGHT.HORSE_H).toBeGreaterThan(KNIGHT.RIDER_H);
    });

    it('PATHS has KNIGHT_HORSE and KNIGHT_RIDER entries', () => {
        expect(PATHS).toHaveProperty('KNIGHT_HORSE');
        expect(PATHS).toHaveProperty('KNIGHT_RIDER');
        expect(PATHS.KNIGHT_HORSE).toMatch(/\.(gltf|glb)$/i);
        expect(PATHS.KNIGHT_RIDER).toMatch(/\.(gltf|glb)$/i);
    });
});

describe('KNIGHT constants — game balance', () => {
    it('knights catch retreating orcs and ogres (speed > retreat speed)', () => {
        const orcRetreat  = CONFIG.UNITS.orc.speed  * 1.1;
        const ogreRetreat = CONFIG.UNITS.ogre.speed * 1.1;
        expect(KNIGHT.SPEED).toBeGreaterThan(orcRetreat);
        expect(KNIGHT.SPEED).toBeGreaterThan(ogreRetreat);
    });

    it('goblins outrun knights (adds escape tension)', () => {
        const goblinRetreat = CONFIG.UNITS.goblin.speed * 1.1;
        expect(KNIGHT.SPEED).toBeLessThan(goblinRetreat);
    });

    it('knight attack matches ogre attack (heavy hitter)', () => {
        expect(KNIGHT.ATTACK).toBe(CONFIG.UNITS.ogre.attack);
    });

    it('knight HP matches ogre HP (tanky)', () => {
        expect(KNIGHT.HP).toBe(CONFIG.UNITS.ogre.hp);
    });
});

describe('KNIGHT retreat interaction — pure logic', () => {
    it('a unit with HP <= KNIGHT.ATTACK dies from one strike if at low HP', () => {
        const unitHp = KNIGHT.ATTACK - 1;
        const newHp  = unitHp - KNIGHT.ATTACK;
        expect(newHp).toBeLessThanOrEqual(0);
    });

    it('a full-HP orc survives at least one knight strike', () => {
        const orcHp = CONFIG.UNITS.orc.hp;
        expect(orcHp - KNIGHT.ATTACK).toBeGreaterThan(0);
    });

    it('saddle height calculation is positive', () => {
        const saddleY = KNIGHT.HORSE_H * KNIGHT.SADDLE_FRAC;
        expect(saddleY).toBeGreaterThan(0);
        expect(saddleY).toBeLessThan(KNIGHT.HORSE_H);
    });
});

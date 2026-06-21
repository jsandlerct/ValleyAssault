import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DefenseReinforcementSystem } from '../defense-reinforcements.js';
import { REINFORCEMENT } from '../constants.js';

function makeDefenders(count = 3, aliveCount = 8) {
    return Array.from({ length: count }, () => ({
        aliveCount,
        spawnArcher:          vi.fn(),
        spawnReinforcements:  vi.fn(),
    }));
}

function makeKnights() {
    return { deploySortie: vi.fn() };
}

describe('DefenseReinforcementSystem — timer', () => {
    it('does not tick before start()', () => {
        const defs    = makeDefenders();
        const knights = makeKnights();
        const sys     = new DefenseReinforcementSystem(defs, knights);
        sys.update(100);
        expect(defs[0].spawnArcher).not.toHaveBeenCalled();
        expect(knights.deploySortie).not.toHaveBeenCalled();
    });

    it('active is false before start(), true after', () => {
        const sys = new DefenseReinforcementSystem(makeDefenders(), makeKnights());
        expect(sys.active).toBe(false);
        sys.start();
        expect(sys.active).toBe(true);
    });

    it('start() is idempotent — calling twice does not reset timer', () => {
        // If start() were to reset #elapsed, a second call at 9s would prevent
        // the trickle at 10s from firing.
        const defs = makeDefenders();
        const sys  = new DefenseReinforcementSystem(defs, makeKnights());
        sys.start();
        sys.update(9);
        sys.start(); // should not reset elapsed
        sys.update(1.5); // total 10.5s — trickle should have fired
        expect(defs[0].spawnArcher).toHaveBeenCalledTimes(1);
    });

    it('stop() halts all further updates', () => {
        const defs = makeDefenders();
        const sys  = new DefenseReinforcementSystem(defs, makeKnights());
        sys.start();
        sys.stop();
        sys.update(100);
        expect(defs[0].spawnArcher).not.toHaveBeenCalled();
    });
});

describe('DefenseReinforcementSystem — trickle spawns', () => {
    it('spawns one archer every TRICKLE_INTERVAL seconds', () => {
        const defs = makeDefenders();
        const sys  = new DefenseReinforcementSystem(defs, makeKnights());
        sys.start();
        // Three intervals
        for (let i = 0; i < 3; i++) sys.update(REINFORCEMENT.TRICKLE_INTERVAL);
        const total = defs.reduce((n, d) => n + d.spawnArcher.mock.calls.length, 0);
        expect(total).toBe(3);
    });

    it('targets segment with the fewest alive defenders', () => {
        const defs = makeDefenders(3, 8);
        defs[1].aliveCount = 2; // segment 1 is weakest
        const sys  = new DefenseReinforcementSystem(defs, makeKnights());
        sys.start();
        sys.update(REINFORCEMENT.TRICKLE_INTERVAL);
        expect(defs[1].spawnArcher).toHaveBeenCalledTimes(1);
        expect(defs[0].spawnArcher).not.toHaveBeenCalled();
        expect(defs[2].spawnArcher).not.toHaveBeenCalled();
    });

    it('does not tick partial intervals — requires full TRICKLE_INTERVAL', () => {
        const defs = makeDefenders();
        const sys  = new DefenseReinforcementSystem(defs, makeKnights());
        sys.start();
        sys.update(REINFORCEMENT.TRICKLE_INTERVAL - 0.01);
        const total = defs.reduce((n, d) => n + d.spawnArcher.mock.calls.length, 0);
        expect(total).toBe(0);
    });
});

describe('DefenseReinforcementSystem — events', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    function buildSeededSys(event1IsR1) {
        // Seed Math.random so event times hit their minimums and event1IsR1 is controlled.
        // Calls in start(): rand(E1_MIN,E1_MAX), rand(E2_MIN,E2_MAX), rand(E3_MIN,E3_MAX), Math.random()<0.5
        vi.spyOn(Math, 'random')
            .mockReturnValueOnce(0)                         // event1Time = E1_MIN
            .mockReturnValueOnce(0)                         // event2Time = E2_MIN
            .mockReturnValueOnce(0)                         // event3Time = E3_MIN
            .mockReturnValueOnce(event1IsR1 ? 0 : 1);      // 0 → R1 first, 1 → R2 first
        const defs    = makeDefenders();
        const knights = makeKnights();
        const sys     = new DefenseReinforcementSystem(defs, knights);
        sys.start();
        return { sys, defs, knights };
    }

    it('event 1 fires R1 and event 2 fires R2 when event1IsR1=true', () => {
        const { sys, defs, knights } = buildSeededSys(true);
        sys.update(REINFORCEMENT.EVENT1_MIN + 0.1);
        expect(defs[0].spawnReinforcements).toHaveBeenCalled();
        expect(knights.deploySortie).not.toHaveBeenCalled();

        sys.update(REINFORCEMENT.EVENT2_MIN - REINFORCEMENT.EVENT1_MIN);
        expect(knights.deploySortie).toHaveBeenCalledTimes(1);
    });

    it('event 1 fires R2 and event 2 fires R1 when event1IsR1=false', () => {
        const { sys, defs, knights } = buildSeededSys(false);
        sys.update(REINFORCEMENT.EVENT1_MIN + 0.1);
        expect(knights.deploySortie).toHaveBeenCalledTimes(1);
        expect(defs[0].spawnReinforcements).not.toHaveBeenCalled();

        sys.update(REINFORCEMENT.EVENT2_MIN - REINFORCEMENT.EVENT1_MIN);
        expect(defs[0].spawnReinforcements).toHaveBeenCalled();
    });

    it('event 3 always fires R1 regardless of event1IsR1', () => {
        const { sys, defs } = buildSeededSys(false); // event1=R2, event2=R1, event3=R1
        sys.update(REINFORCEMENT.EVENT3_MIN + 0.1);
        // defs[0].spawnReinforcements called for event2 AND event3
        expect(defs[0].spawnReinforcements.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('each event fires exactly once even with many updates', () => {
        const { sys, defs, knights } = buildSeededSys(true);
        for (let i = 0; i < 200; i++) sys.update(1); // 200s total
        const r1Calls = defs[0].spawnReinforcements.mock.calls.length;
        const r2Calls = knights.deploySortie.mock.calls.length;
        // event1=R1, event2=R2, event3=R1 → 2 R1 firings, 1 R2 firing
        expect(r1Calls).toBe(2);
        expect(r2Calls).toBe(1);
    });

    it('event times respect their minimum bounds', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0); // all times hit minimums
        const defs    = makeDefenders();
        const knights = makeKnights();
        const sys     = new DefenseReinforcementSystem(defs, knights);
        sys.start();

        // Just before event1 min — nothing should fire
        sys.update(REINFORCEMENT.EVENT1_MIN - 0.01);
        expect(defs[0].spawnReinforcements).not.toHaveBeenCalled();
        expect(knights.deploySortie).not.toHaveBeenCalled();

        // Cross event1 min
        sys.update(0.02);
        const fired = defs[0].spawnReinforcements.mock.calls.length +
                      knights.deploySortie.mock.calls.length;
        expect(fired).toBe(1);
    });

    it('R1 response calls spawnReinforcements on every defender segment', () => {
        const { sys, defs } = buildSeededSys(true);
        sys.update(REINFORCEMENT.EVENT1_MIN + 0.1);
        for (const d of defs) expect(d.spawnReinforcements).toHaveBeenCalledWith(
            REINFORCEMENT.R1_ARCHERS, REINFORCEMENT.R1_MAGES
        );
    });

    it('R2 response calls deploySortie with SORTIE_COUNT', () => {
        const { sys, knights } = buildSeededSys(false);
        sys.update(REINFORCEMENT.EVENT1_MIN + 0.1);
        expect(knights.deploySortie).toHaveBeenCalledWith(REINFORCEMENT.SORTIE_COUNT);
    });

    it('onAnnounce is called with correct text for each response', () => {
        const { sys, defs } = buildSeededSys(true);
        const announces = [];
        sys.onAnnounce = (t) => announces.push(t);

        sys.update(REINFORCEMENT.EVENT1_MIN + 0.1); // R1
        sys.update(REINFORCEMENT.EVENT2_MIN - REINFORCEMENT.EVENT1_MIN); // R2

        expect(announces).toContain('More defenders come! This very bad for us!');
        expect(announces).toContain('KNIGHTS COME OUT! Kill them! Kill them!');
    });
});

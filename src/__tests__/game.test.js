import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Game, State } from '../game.js';
import { CONFIG } from '../constants.js';

vi.mock('../audio.js', () => ({ audio: { play: vi.fn() } }));

function makeGame() {
    const g = new Game();
    g.squads       = [];
    g.wallSections = [];
    g.ui           = null;
    return g;
}

function makeSquad(unitCount = 1) {
    return {
        id:                 'resL',
        units:              Array.from({ length: unitCount }, () => ({ alive: true })),
        marchThroughBreach: vi.fn(),
        setOrder:           vi.fn(),
    };
}

describe('Game — state machine', () => {
    let g;
    beforeEach(() => { g = makeGame(); });

    it('starts in LOADING state', () => {
        expect(g.state).toBe(State.LOADING);
    });

    it('startBattle transitions to READY', () => {
        g.startBattle({});
        expect(g.state).toBe(State.READY);
    });

    it('issueOrder transitions READY → PLAYING on first order', () => {
        g.state  = State.READY;
        const sq = makeSquad();
        sq.id    = 'resL';
        g.squads = [sq];
        g.issueOrder('resL', 'A');
        expect(g.state).toBe(State.PLAYING);
    });

    it('issueOrder in PLAYING stays PLAYING', () => {
        g.state  = State.PLAYING;
        const sq = makeSquad();
        sq.id    = 'resL';
        g.squads = [sq];
        g.issueOrder('resL', 'B');
        expect(g.state).toBe(State.PLAYING);
    });

    it('checkBreach transitions PLAYING → BREACH', () => {
        g.state        = State.PLAYING;
        const sq       = makeSquad(2);
        g.squads       = [sq];
        g.wallSections = [{ breached: true, group: { position: { x: -20 } } }];
        g.checkBreach();
        expect(g.state).toBe(State.BREACH);
    });

    it('checkBreach calls marchThroughBreach on all squads with the breach X', () => {
        vi.useFakeTimers();
        g.state        = State.PLAYING;
        const sq       = makeSquad(2);
        g.squads       = [sq];
        g.wallSections = [{ breached: true, group: { position: { x: -20 } } }];
        g.checkBreach();
        vi.advanceTimersByTime(500);
        expect(sq.marchThroughBreach).toHaveBeenCalledWith(-20);
        vi.useRealTimers();
    });

    it('checkBreach is a no-op when no section is breached', () => {
        g.state        = State.PLAYING;
        g.wallSections = [{ breached: false }];
        g.checkBreach();
        expect(g.state).toBe(State.PLAYING);
    });

    it('checkDefeat in PLAYING with all squads empty → DEFEAT', () => {
        g.state  = State.PLAYING;
        g.squads = [{ units: [] }, { units: [] }];
        g.checkDefeat();
        expect(g.state).toBe(State.DEFEAT);
    });

    it('checkDefeat in PLAYING with alive units → no state change', () => {
        g.state  = State.PLAYING;
        g.squads = [{ units: [{ alive: true }] }];
        g.checkDefeat();
        expect(g.state).toBe(State.PLAYING);
    });

    it('checkDefeat in BREACH with enough units through → VICTORY', () => {
        g.state              = State.BREACH;
        g.squads             = [{ units: [] }];
        g.unitsThroughBreach = CONFIG.BREACH_VICTORY_COUNT;
        g.checkDefeat();
        expect(g.state).toBe(State.VICTORY);
    });

    it('checkDefeat in BREACH with fewer than BREACH_VICTORY_COUNT through → DEFEAT', () => {
        g.state              = State.BREACH;
        g.squads             = [{ units: [] }];
        g.unitsThroughBreach = CONFIG.BREACH_VICTORY_COUNT - 1;
        g.checkDefeat();
        expect(g.state).toBe(State.DEFEAT);
    });

    it('checkDefeat does nothing outside PLAYING/BREACH', () => {
        for (const state of [State.SETUP, State.READY, State.VICTORY, State.DEFEAT]) {
            g        = makeGame();
            g.state  = state;
            g.squads = [{ units: [] }];
            g.checkDefeat();
            expect(g.state).toBe(state);
        }
    });

    it('recordUnitThrough increments unitsThroughBreach', () => {
        g.unitsThroughBreach = 0;
        g.recordUnitThrough();
        g.recordUnitThrough();
        expect(g.unitsThroughBreach).toBe(2);
    });

    it('selectSquad calls ui.showOrderMenu with the matching squad', () => {
        const showOrderMenu = vi.fn();
        g.ui     = { showOrderMenu };
        const sq = makeSquad();
        sq.id    = 'resC';
        g.squads = [sq];
        g.selectSquad('resC');
        expect(showOrderMenu).toHaveBeenCalledWith(sq);
    });

    it('selectSquad is a no-op for unknown squad id', () => {
        const showOrderMenu = vi.fn();
        g.ui     = { showOrderMenu };
        g.squads = [];
        g.selectSquad('nonexistent');
        expect(showOrderMenu).not.toHaveBeenCalled();
    });
});

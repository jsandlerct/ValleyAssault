import { REINFORCEMENT } from './constants.js';

// ── DefenseReinforcementSystem ────────────────────────────────────────────────
// Manages the defense timer that starts the first time a player unit attacks
// the wall and drives:
//   • Trickle spawns — one archer every TRICKLE_INTERVAL seconds on the
//     segment with the fewest alive defenders.
//   • Three timed events that fire R1 (archers + mages) or R2 (knight sortie).
//
// Call start()  — once — when the first unit engages the wall.
// Call stop()   when the wall is breached or retreat is sounded.
// Call update(dt) every frame while the battle is playing.
//
// onAnnounce is set by main.js: (text) => game.ui?.announce(text)
export class DefenseReinforcementSystem {
    onAnnounce = null;  // (text: string) => void

    #defenders;     // WallDefenders[]  (same order as wallSections)
    #knightSystem;  // KnightSystem

    #active = false;
    #elapsed = 0;
    #trickleTimer = 0;

    #event1Time  = 0;
    #event2Time  = 0;
    #event3Time  = 0;
    #event1Fired = false;
    #event2Fired = false;
    #event3Fired = false;
    #event1IsR1  = true;   // which response fires at event 1

    constructor(defenders, knightSystem) {
        this.#defenders    = defenders;
        this.#knightSystem = knightSystem;
    }

    get active() { return this.#active; }

    start() {
        if (this.#active) return;
        this.#active = true;

        const rand = (min, max) => min + Math.random() * (max - min);
        this.#event1Time = rand(REINFORCEMENT.EVENT1_MIN, REINFORCEMENT.EVENT1_MAX);
        this.#event2Time = rand(REINFORCEMENT.EVENT2_MIN, REINFORCEMENT.EVENT2_MAX);
        this.#event3Time = rand(REINFORCEMENT.EVENT3_MIN, REINFORCEMENT.EVENT3_MAX);
        this.#event1IsR1 = Math.random() < 0.5;
    }

    stop() {
        this.#active = false;
    }

    reset() {
        this.#active        = false;
        this.#elapsed       = 0;
        this.#trickleTimer  = 0;
        this.#event1Fired   = false;
        this.#event2Fired   = false;
        this.#event3Fired   = false;
    }

    update(dt) {
        if (!this.#active) return;
        this.#elapsed += dt;

        // Trickle: one archer on the weakest segment every TRICKLE_INTERVAL seconds
        this.#trickleTimer += dt;
        if (this.#trickleTimer >= REINFORCEMENT.TRICKLE_INTERVAL) {
            this.#trickleTimer -= REINFORCEMENT.TRICKLE_INTERVAL;
            this.#spawnTrickleArcher();
        }

        // Event 1
        if (!this.#event1Fired && this.#elapsed >= this.#event1Time) {
            this.#event1Fired = true;
            this.#fireResponse(this.#event1IsR1 ? 'R1' : 'R2');
        }
        // Event 2 — opposite response from event 1
        if (!this.#event2Fired && this.#elapsed >= this.#event2Time) {
            this.#event2Fired = true;
            this.#fireResponse(this.#event1IsR1 ? 'R2' : 'R1');
        }
        // Event 3 — always R1 (second wave of reinforcements)
        if (!this.#event3Fired && this.#elapsed >= this.#event3Time) {
            this.#event3Fired = true;
            this.#fireResponse('R1');
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    #spawnTrickleArcher() {
        let minCount  = Infinity;
        let targetIdx = 0;
        for (let i = 0; i < this.#defenders.length; i++) {
            if (this.#defenders[i].aliveCount < minCount) {
                minCount  = this.#defenders[i].aliveCount;
                targetIdx = i;
            }
        }
        this.#defenders[targetIdx].spawnArcher();
    }

    #fireResponse(r) {
        if (r === 'R1') {
            for (const def of this.#defenders) {
                def.spawnReinforcements(REINFORCEMENT.R1_ARCHERS, REINFORCEMENT.R1_MAGES);
            }
            this.onAnnounce?.('More defenders come! This very bad for us!');
        } else {
            this.#knightSystem.deploySortie(REINFORCEMENT.SORTIE_COUNT);
            this.onAnnounce?.('KNIGHTS COME OUT! Kill them! Kill them!');
        }
    }
}

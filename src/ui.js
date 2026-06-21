import { game, State } from './game.js';
import { audio } from './audio.js';

const SQUAD_ICON = '⚔️';

export class UISystem {
    #squads          = [];
    #timerSeconds    = 0;
    #selectedId      = null;
    #confirmTimeout  = null;

    // DOM refs
    #timerEl          = document.getElementById('timer');
    #bannerEl         = document.getElementById('objective-banner');
    #panelEl          = document.getElementById('squad-panel');
    #orderMenuEl      = document.getElementById('order-menu');
    #confirmEl        = document.getElementById('order-confirm');
    #breachCounterEl  = document.getElementById('breach-counter');

    constructor(squads) {
        this.#squads = squads;
        this.#buildSquadPanel();
        this.#wireOrderButtons();
        this.#wireSoundToggle();
    }

    // ── Squad panel ───────────────────────────────────────────────────────────

    #buildSquadPanel() {
        this.#panelEl.innerHTML = '';
        for (const squad of this.#squads) {
            const card = document.createElement('div');
            card.className  = 'squad-card';
            card.dataset.id = squad.id;
            card.innerHTML  = `
                <div class="squad-header">
                    <span class="squad-icon">${SQUAD_ICON}</span>
                    <span class="squad-name">${squad.label}</span>
                    <span class="squad-size">×${squad.units.length}</span>
                </div>
                <div class="hp-bar"><div class="hp-fill" style="width:100%"></div></div>
                <div class="hp-text">${squad.totalHP} / ${squad.maxHP} HP</div>
                <div class="squad-status">Waiting</div>
            `;
            card.addEventListener('click', () => {
                this.#selectedId = squad.id;
                game.selectSquad(squad.id);
                this.#highlightCard(squad.id);
            });
            this.#panelEl.appendChild(card);
        }
    }

    #highlightCard(id) {
        for (const card of this.#panelEl.querySelectorAll('.squad-card')) {
            card.classList.toggle('selected', card.dataset.id === id);
        }
    }

    // ── Order menu ────────────────────────────────────────────────────────────

    showOrderMenu(squad) {
        this.#orderMenuEl.classList.remove('hidden');
        const titleEl = document.getElementById('order-menu-title');
        if (titleEl) titleEl.textContent = squad.order === 'engaged' ? 'Redirect to…' : 'Attack order';
    }

    hideOrderMenu() {
        this.#orderMenuEl.classList.add('hidden');
    }

    #wireOrderButtons() {
        for (const btn of document.querySelectorAll('.order-btn')) {
            btn.addEventListener('click', () => {
                if (!this.#selectedId) return;
                const section   = btn.dataset.section;
                const wasReady  = game.state === State.READY;
                game.issueOrder(this.#selectedId, section);
                if (wasReady) audio.play('battle-start');
                else          audio.play('march');
                this.#orderMenuEl.classList.add('hidden');
                this.#flashConfirm();
            });
        }
    }

    #wireSoundToggle() {
        const btn = document.getElementById('sound-toggle');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const muted = audio.toggle();
            btn.textContent = muted ? '🔇' : '🔊';
            btn.classList.toggle('muted', muted);
        });
    }

    #flashConfirm() {
        this.#confirmEl.classList.remove('hidden');
        clearTimeout(this.#confirmTimeout);
        this.#confirmTimeout = setTimeout(() => {
            this.#confirmEl.classList.add('hidden');
        }, 1500);
    }

    // ── Breach counter ────────────────────────────────────────────────────────

    updateBreachCounter(count, total) {
        this.#breachCounterEl.classList.remove('hidden');
        this.#breachCounterEl.textContent = `Units through the breach: ${count} out of ${total}`;
    }

    // ── Outcome screens ───────────────────────────────────────────────────────

    showVictoryScreen() {
        document.getElementById('victory-screen').style.display = 'flex';
    }

    showDefeatScreen() {
        flashScreen('#ff2200', 0.4);
        document.getElementById('defeat-screen').style.display = 'flex';
    }

    // ── Timer & live updates ──────────────────────────────────────────────────

    update(dt) {
        this.#timerSeconds += dt;
        const m = Math.floor(this.#timerSeconds / 60);
        const s = Math.floor(this.#timerSeconds % 60);
        this.#timerEl.textContent =
            String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');

        this.#updateSquadCards();
    }

    #updateSquadCards() {
        for (const squad of this.#squads) {
            const card = this.#panelEl.querySelector(`[data-squad-id="${squad.id}"], [data-id="${squad.id}"]`);
            if (!card) continue;

            const aliveCount = squad.units.filter(u => u.alive).length;
            const hp    = Math.max(0, squad.totalHP);
            const pct   = squad.maxHP > 0 ? (hp / squad.maxHP) * 100 : 0;
            const fill  = card.querySelector('.hp-fill');
            const hpTxt = card.querySelector('.hp-text');
            const size  = card.querySelector('.squad-size');
            const status = card.querySelector('.squad-status');

            if (fill) {
                fill.style.width = pct + '%';
                fill.style.backgroundColor =
                    pct > 60 ? '#4caf50' :
                    pct > 30 ? '#ff9800' : '#f44336';
            }
            if (hpTxt) hpTxt.textContent = `${Math.ceil(hp)} / ${squad.maxHP} HP`;
            if (size)  size.textContent  = `×${aliveCount}`;
            if (status) {
                status.textContent =
                    squad.order === 'marching' ? `→ Section ${squad.targetSection}` :
                    squad.order === 'engaged'  ? `⚔ Engaging ${squad.targetSection}` :
                    squad.order === 'through'  ? '→ Through the breach' :
                    aliveCount === 0           ? 'Destroyed' : 'Waiting';
            }

            if (aliveCount === 0) card.classList.add('dead');
        }
    }

    updateObjectiveBanner(text) {
        this.#bannerEl.textContent = text;
    }
}

// ── Global flash helper ───────────────────────────────────────────────────────
export function flashScreen(color, duration) {
    const overlay = document.getElementById('flash-overlay');
    overlay.style.backgroundColor = color;
    overlay.style.opacity          = '0.35';
    setTimeout(() => { overlay.style.opacity = '0'; }, duration * 1000);
}

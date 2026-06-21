import { game } from './game.js';
import { audio } from './audio.js';

const SQUAD_ICON = '⚔️';

export class UISystem {
    #squads          = [];
    #timerSeconds    = 0;
    #selectedId      = null;
    #confirmTimeout  = null;

    // DOM refs
    #timerEl           = document.getElementById('timer');
    #yearEl            = document.getElementById('year-display');
    #bannerEl          = document.getElementById('objective-banner');
    #announceBannerEl  = document.getElementById('announce-banner');
    #panelEl           = document.getElementById('squad-panel');
    #orderMenuEl       = document.getElementById('order-menu');
    #confirmEl         = document.getElementById('order-confirm');
    #breachCounterEl   = document.getElementById('breach-counter');
    #retreatBtnEl      = document.getElementById('retreat-btn');
    #retreatCounterEl  = document.getElementById('retreat-counter');
    #unitCountEl       = document.getElementById('unit-count');
    #announceTimeout   = null;
    #onRetreatClick    = null;
    #orderClickHandlers = [];

    constructor(squads) {
        this.#squads = squads;
        this.#buildSquadPanel();
        this.#wireOrderButtons();
        this.#wireSoundToggle();
        this.#wireRetreatButton();
        this.#retreatCounterEl?.classList.add('hidden');
        this.#breachCounterEl?.classList.add('hidden');
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
                <div class="squad-status">Sitting... bored...</div>
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
        if (titleEl) titleEl.textContent = squad.order === 'engaged' ? 'Send where now?' : 'Where smash?';
    }

    hideOrderMenu() {
        this.#orderMenuEl.classList.add('hidden');
    }

    #wireOrderButtons() {
        for (const btn of document.querySelectorAll('.order-btn')) {
            const handler = () => {
                if (!this.#selectedId) return;
                const section   = btn.dataset.section;
                game.issueOrder(this.#selectedId, section, true);
                audio.play('march');
                this.#orderMenuEl.classList.add('hidden');
                this.#flashConfirm();
            };
            btn.addEventListener('click', handler);
            this.#orderClickHandlers.push({ btn, handler });
        }
    }

    #wireRetreatButton() {
        if (!this.#retreatBtnEl) return;
        this.#onRetreatClick = () => {
            audio.play('retreat');
            game.soundRetreat();
            this.#retreatBtnEl.classList.add('hidden');
        };
        this.#retreatBtnEl.addEventListener('click', this.#onRetreatClick);
    }

    destroy() {
        if (this.#onRetreatClick) {
            this.#retreatBtnEl?.removeEventListener('click', this.#onRetreatClick);
        }
        for (const { btn, handler } of this.#orderClickHandlers) {
            btn.removeEventListener('click', handler);
        }
        this.#orderClickHandlers = [];
    }

    showRetreatButton() {
        this.#retreatBtnEl?.classList.remove('hidden');
    }

    hideRetreatButton() {
        this.#retreatBtnEl?.classList.add('hidden');
    }

    updateRetreatCounter(count, total) {
        if (!this.#retreatCounterEl) return;
        this.#retreatCounterEl.classList.remove('hidden');
        this.#retreatCounterEl.textContent = `Made it out: ${count} / ${total}`;
    }

    showRetreatScreen(survived, total) {
        const screen = document.getElementById('retreat-screen');
        if (!screen) return;
        const detail = screen.querySelector('#retreat-detail');
        if (detail) detail.textContent = `${survived} of ${total} goblins made it back alive. Zoob... mostly impressed.`;
        screen.style.display = 'flex';
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
        this.#breachCounterEl.textContent = `Through the hole: ${count} of ${total}! GO GO GO!`;
    }

    // ── Year display ──────────────────────────────────────────────────────────

    setYear(year, maxYears) {
        if (this.#yearEl) this.#yearEl.textContent = `YEAR ${year} / ${maxYears}`;
    }

    // ── Year summary screen ───────────────────────────────────────────────────

    /**
     * @param {{
     *   year: number,
     *   retreatedByType: { orc: number, goblin: number, ogre: number },
     *   wallHpBefore: Array<{ id: string, hp: number, maxHp: number }>,
     *   reinforcements: { orc: number, goblin: number, ogre: number },
     *   nextYear: number,
     * }} data
     */
    showYearSummary(data) {
        const screen = document.getElementById('year-summary');
        if (!screen) return;

        const { year, retreatedByType: r, wallHpBefore, reinforcements: rf, nextYear } = data;

        screen.querySelector('#summary-year').textContent = year;

        screen.querySelector('#summary-survivors').textContent =
            `${r.orc} orcs, ${r.goblin} goblins, ${r.ogre} ogres`;

        const wallRows = wallHpBefore.map(s => {
            const damagePct = Math.floor((s.maxHp - s.hp) / s.maxHp * 100);
            const comment = damagePct >= 80 ? ' — Zoob very happy!' : damagePct >= 40 ? ' — okay, okay.' : ' — Zoob make face.';
            return `Section ${s.id}: ${damagePct}% smashed${comment}`;
        });
        screen.querySelector('#summary-wall').textContent = wallRows.join(' | ');

        const netOrc    = rf.orc    - r.orc;
        const netGoblin = rf.goblin - r.goblin;
        const netOgre   = rf.ogre   - r.ogre;
        const netTotal  = netOrc + netGoblin + netOgre;
        const rfComment = netTotal > 0 ? 'Zoob send more!' : netTotal < 0 ? 'Zoob send fewer. Zoob disappointed.' : 'Zoob send same. Zoob shrug.';
        screen.querySelector('#summary-reinforcements').textContent =
            `+${netOrc} orcs, +${netGoblin} goblins, +${netOgre} ogres — ${rfComment}`;

        screen.querySelector('#next-year-btn').textContent = `Year ${nextYear} — Smash Harder!`;

        screen.style.display = 'flex';
    }

    hideYearSummary() {
        const screen = document.getElementById('year-summary');
        if (screen) screen.style.display = 'none';
    }

    // ── Outcome screens ───────────────────────────────────────────────────────

    showVictoryScreen() {
        const screen = document.getElementById('victory-screen');
        screen.querySelector('p').textContent = 'Wall is DOWN! Army march through! Zoob do little happy dance! YOU NOT FAIL ZOOB!';
        screen.style.display = 'flex';
    }

    showDefeatScreen() {
        flashScreen('#ff2200', 0.4);
        document.getElementById('defeat-screen').style.display = 'flex';
    }

    showCampaignDefeatScreen(reason = 'Army all dead. Zoob very sad. Also very hungry.') {
        flashScreen('#ff2200', 0.4);
        const screen = document.getElementById('defeat-screen');
        screen.querySelector('p').textContent = reason;
        screen.style.display = 'flex';
    }

    // ── Timer & live updates ──────────────────────────────────────────────────

    update(dt) {
        this.#timerSeconds += dt;
        const m = Math.floor(this.#timerSeconds / 60);
        const s = Math.floor(this.#timerSeconds % 60);
        this.#timerEl.textContent =
            String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');

        this.#updateSquadCards();
        this.#updateUnitCount();
    }

    #updateSquadCards() {
        for (const squad of this.#squads) {
            const card = this.#panelEl.querySelector(`[data-id="${squad.id}"]`);
            if (!card) continue;

            const aliveCount = squad.units.filter(u => u.alive).length;
            const size   = card.querySelector('.squad-size');
            const status = card.querySelector('.squad-status');

            if (size)  size.textContent = `×${aliveCount}`;
            if (status) {
                status.textContent =
                    squad.order === 'marching'   ? `→ Running to ${squad.targetSection}!` :
                    squad.order === 'engaged'    ? `⚔ Smashing ${squad.targetSection}!` :
                    squad.order === 'through' && game.breachBlocked ? '⚔ Stupid knights! Kill!' :
                    squad.order === 'through'    ? '→ THROUGH! GO GO GO!' :
                    squad.order === 'retreating' ? '↓ Running away (smart!)' :
                    aliveCount === 0             ? 'All dead. Zoob weep.' : 'Sitting... bored...';
            }

            if (aliveCount === 0) card.classList.add('dead');
        }
    }

    #updateUnitCount() {
        if (!this.#unitCountEl) return;
        const alive = game.squads.reduce((n, s) => n + s.units.filter(u => u.alive).length, 0);
        this.#unitCountEl.textContent = `ZOOB'S ARMY: ${alive}`;
    }

    updateObjectiveBanner(text) {
        this.#bannerEl.textContent = text;
    }

    announce(text, durationMs = 3500) {
        if (!this.#announceBannerEl) return;
        this.#announceBannerEl.textContent = text;
        this.#announceBannerEl.classList.remove('hidden');
        clearTimeout(this.#announceTimeout);
        this.#announceTimeout = setTimeout(() => {
            this.#announceBannerEl?.classList.add('hidden');
        }, durationMs);
    }
}

// ── Global flash helper ───────────────────────────────────────────────────────
export function flashScreen(color, duration) {
    const overlay = document.getElementById('flash-overlay');
    overlay.style.backgroundColor = color;
    overlay.style.opacity          = '0.35';
    setTimeout(() => { overlay.style.opacity = '0'; }, duration * 1000);
}

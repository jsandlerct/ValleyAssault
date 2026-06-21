const SOUNDS = {
    'battle-start': ['/assets/SFX/battle_start.wav'],
    'march':        ['/assets/SFX/enemy_start_move.wav'],
    'breach':       ['/assets/SFX/breach.wav'],
    'retreat':      ['/assets/SFX/retreat.wav'],
    'arrow':        ['/assets/SFX/archer.mp3'],
    'mage':         ['/assets/SFX/mage.wav'],
    'spear':        ['/assets/SFX/spear.wav'],
    'melee':        ['/assets/SFX/orc_on_wall.wav'],
    'ogre':         ['/assets/SFX/ogre.mp3'],
};

const VOLUME = {
    'battle-start': 0.8,
    'march':        0.7,
    'breach':       0.9,
    'retreat':      0.85,
    'arrow':        0.5,
    'mage':         0.6,
    'spear':        0.5,
    'melee':        0.65,
    'ogre':         0.45,
};

const COOLDOWN = {
    arrow:  150,
    spear:  200,
    mage:   250,
    melee:  400,
    ogre:   2500,
};

class AudioSystem {
    #muted    = false;
    #lastPlay = {};
    #active   = [];   // playing instances so toggle() can pause them

    load() { /* no-op: Audio elements created at play-time */ }

    play(key) {
        if (this.#muted) return;

        const cd = COOLDOWN[key] ?? 0;
        if (cd) {
            const now = Date.now();
            if (now - (this.#lastPlay[key] ?? 0) < cd) return;
            this.#lastPlay[key] = now;
        }

        const urls = SOUNDS[key];
        if (!urls?.length) return;

        const url = urls[Math.floor(Math.random() * urls.length)];
        const a = new Audio();
        a.volume = VOLUME[key] ?? 0.7;
        a.src = url;
        a.play().catch(() => {});

        this.#active.push(a);
        a.addEventListener('ended', () => {
            const i = this.#active.indexOf(a);
            if (i !== -1) this.#active.splice(i, 1);
        }, { once: true });
    }

    get muted() { return this.#muted; }

    toggle() {
        this.#muted = !this.#muted;
        if (this.#muted) {
            for (const a of this.#active) { a.pause(); a.src = ''; }
            this.#active = [];
        }
        return this.#muted;
    }
}

export const audio = new AudioSystem();

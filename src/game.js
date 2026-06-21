export const State = {
    LOADING: 'loading',
    SETUP:   'setup',
    READY:   'ready',
    PLAYING: 'playing',
    BREACH:  'breach',
    VICTORY: 'victory',
    DEFEAT:  'defeat',
};

class Game {
    state = State.LOADING;
    selectedSquadId = null;

    // Set by main.js after construction
    squads       = [];
    wallSections = [];
    ui           = null;

    autoSquadTargets = {};  // { autoL: 'A', autoC: 'B', autoR: 'C' }

    unitsThroughBreach  = 0;
    #totalBeforeBreach  = 0;

    selectSquad(id) {
        this.selectedSquadId = id;
        const squad = this.squads.find(s => s.id === id);
        if (squad && this.ui) this.ui.showOrderMenu(squad);
    }

    issueOrder(squadId, section) {
        const squad = this.squads.find(s => s.id === squadId);
        if (!squad) return;

        squad.setOrder(section);

        if (this.state === State.READY) {
            this.state = State.PLAYING;
            if (this.ui) this.ui.updateObjectiveBanner(
                'Squads advancing — watch the wall section HP!'
            );
        }
    }

    checkBreach() {
        if (this.state !== State.PLAYING) return;
        const breachedSection = this.wallSections.find(s => s.breached);
        if (!breachedSection) return;

        this.state = State.BREACH;
        this.unitsThroughBreach = 0;
        this.#totalBeforeBreach = this.squads.reduce(
            (n, s) => n + s.units.filter(u => u.alive).length, 0
        );

        const breachX = breachedSection.group.position.x;
        for (const squad of this.squads) {
            squad.marchThroughBreach(breachX);
        }

        if (this.ui) {
            this.ui.hideOrderMenu();
            this.ui.updateObjectiveBanner('BREACH! Forces streaming through the gap!');
            this.ui.updateBreachCounter(0, this.#totalBeforeBreach);
        }
    }

    recordUnitThrough() {
        this.unitsThroughBreach++;
        if (this.ui) this.ui.updateBreachCounter(this.unitsThroughBreach, this.#totalBeforeBreach);
    }

    checkDefeat() {
        if (this.state !== State.PLAYING && this.state !== State.BREACH) return;
        const allGone = this.squads.every(s => s.units.length === 0);
        if (!allGone) return;

        if (this.state === State.BREACH) {
            if (this.unitsThroughBreach > 0) {
                this.state = State.VICTORY;
                if (this.ui) this.ui.showVictoryScreen();
            } else {
                this.state = State.DEFEAT;
                if (this.ui) this.ui.showDefeatScreen();
            }
        } else {
            const noneBreached = this.wallSections.every(s => !s.breached);
            if (noneBreached) {
                this.state = State.DEFEAT;
                if (this.ui) this.ui.showDefeatScreen();
            }
        }
    }

    startBattle(autoTargets) {
        this.autoSquadTargets = autoTargets;
        this.state = State.READY;
        // Auto-issue orders for the 3 front-line squads — triggers READY→PLAYING on first call
        for (const [zoneId, section] of Object.entries(autoTargets)) {
            const squad = this.squads.find(s => s.id === zoneId);
            if (squad && squad.units.length > 0) this.issueOrder(zoneId, section);
        }
    }
}

export const game = new Game();

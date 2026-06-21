import { audio } from './audio.js';
import { CONFIG } from './constants.js';

export const State = {
    LOADING:  'loading',
    SETUP:    'setup',
    READY:    'ready',
    PLAYING:  'playing',
    BREACH:   'breach',
    RETREAT:  'retreat',
    VICTORY:  'victory',
    DEFEAT:   'defeat',
};

export class Game {
    state = State.LOADING;
    selectedSquadId = null;

    // Set by main.js after construction
    squads       = [];
    wallSections = [];
    ui           = null;

    autoSquadTargets = {};  // { autoL: 'A', autoC: 'B', autoR: 'C' }

    unitsThroughBreach  = 0;
    #totalBeforeBreach  = 0;

    retreatedUnits      = 0;
    retreatedByType     = { orc: 0, goblin: 0, ogre: 0 };
    #totalBeforeRetreat = 0;
    #totalAtBattleStart = 0;

    knightSystem          = null;  // set by main.js after KnightSystem is created
    defenseReinforcements = null;  // set by main.js after DefenseReinforcementSystem is created
    breachBlocked         = false; // true while breach-sortie knights are alive

    selectSquad(id) {
        this.selectedSquadId = id;
        const squad = this.squads.find(s => s.id === id);
        if (squad && this.ui && this.state !== State.BREACH) this.ui.showOrderMenu(squad);
    }

    issueOrder(squadId, section, immediate = false) {
        if (this.state === State.BREACH) return;
        const squad = this.squads.find(s => s.id === squadId);
        if (!squad) return;

        squad.setOrder(section, immediate);

        if (this.state === State.READY) {
            this.state = State.PLAYING;
            if (this.ui) {
                this.ui.updateObjectiveBanner('They march! Watch the walls — hit hard!');
                this.ui.showRetreatButton();
            }
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

        if (this.ui) {
            this.ui.hideOrderMenu();
            this.ui.hideRetreatButton();
            this.ui.updateObjectiveBanner(`WALL FALL DOWN! Push ${CONFIG.BREACH_VICTORY_COUNT} through the hole!`);
            this.ui.updateBreachCounter(0, this.#totalBeforeBreach);
        }

        audio.play('battle-start');
        this.defenseReinforcements?.stop();

        const breachX = breachedSection.group.position.x;
        setTimeout(() => {
            for (const squad of this.squads) squad.marchThroughBreach(breachX);
        }, 500);

        // Knights sortie to defend the breach
        setTimeout(() => this.knightSystem?.deploy(), 2000);
    }

    recordUnitThrough() {
        this.unitsThroughBreach++;
        if (this.ui) this.ui.updateBreachCounter(this.unitsThroughBreach, this.#totalBeforeBreach);
        if (this.unitsThroughBreach >= CONFIG.BREACH_VICTORY_COUNT) {
            this.state = State.VICTORY;
            if (this.ui) this.ui.showVictoryScreen();
        }
    }

    soundRetreat() {
        if (this.state !== State.PLAYING && this.state !== State.BREACH) return;
        this.state = State.RETREAT;
        this.retreatedUnits = 0;
        this.retreatedByType = { orc: 0, goblin: 0, ogre: 0 };
        this.#totalBeforeRetreat = this.#totalAtBattleStart;
        for (const squad of this.squads) squad.startRetreat();
        this.defenseReinforcements?.stop();
        if (this.ui) {
            this.ui.hideOrderMenu();
            this.ui.updateObjectiveBanner('HORN SOUND! Run! Bring goblins home!');
        }
        // Knights sortie 2 seconds after the horn — gives units a head-start
        setTimeout(() => this.knightSystem?.deploy(), 2000);
    }

    recordRetreated(unit) {
        this.retreatedUnits++;
        if (unit?.unitType) this.retreatedByType[unit.unitType]++;
        if (this.ui) this.ui.updateRetreatCounter(this.retreatedUnits, this.#totalBeforeRetreat);
        this.checkRetreatComplete();
    }

    onRetreatComplete = null; // (retreatedUnits, retreatedByType) => void — set by campaign wiring

    checkRetreatComplete() {
        if (this.state !== State.RETREAT) return;
        const allGone = this.squads.every(s => s.units.length === 0);
        if (!allGone) return;
        if (this.onRetreatComplete) {
            this.onRetreatComplete(this.retreatedUnits, this.retreatedByType);
        } else if (this.ui) {
            this.ui.showRetreatScreen(this.retreatedUnits, this.#totalBeforeRetreat);
        }
    }

    checkDefeat() {
        if (this.state !== State.PLAYING && this.state !== State.BREACH) return;
        const allGone = this.squads.every(s => s.units.length === 0);
        if (!allGone) return;

        if (this.state === State.BREACH) {
            if (this.unitsThroughBreach >= CONFIG.BREACH_VICTORY_COUNT) {
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
        this.#totalAtBattleStart = this.squads.reduce((n, s) => n + s.units.length, 0);
        audio.play('battle-start');
        // Delay march so the horn has a moment to land before units move
        setTimeout(() => {
            for (const [zoneId, section] of Object.entries(autoTargets)) {
                const squad = this.squads.find(s => s.id === zoneId);
                if (squad && squad.units.length > 0) this.issueOrder(zoneId, section);
            }
        }, 1500);
    }
}

export const game = new Game();

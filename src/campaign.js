import { CAMPAIGN, TOTAL_UNITS } from './constants.js';

export class Campaign {
    year        = 1;
    maxYears    = CAMPAIGN.MAX_YEARS;

    // Units available for the current year's setup screen
    startingUnits = { ...TOTAL_UNITS };

    /**
     * Compute units for the next year.
     * @param {{ orc: number, goblin: number, ogre: number }} retreatedByType
     * @param {Array<{ hp: number, maxHp: number }>} wallSections
     * @returns {{ orc: number, goblin: number, ogre: number }}
     */
    computeReinforcements(retreatedByType, wallSections) {
        const survivingOgres = retreatedByType.ogre;
        const newOgres = Math.max(0, CAMPAIGN.STARTING_OGRES - survivingOgres);

        // Damage bonus = sum of integer percentage points of damage across all sections
        const totalDamagePoints = wallSections.reduce((sum, s) => {
            return sum + Math.floor((s.maxHp - s.hp) / s.maxHp * 100);
        }, 0);

        const newOrcs   = Math.floor(totalDamagePoints / 2);
        const newGoblins = Math.ceil(totalDamagePoints / 2);

        return {
            ogre:   retreatedByType.ogre   + newOgres,
            orc:    retreatedByType.orc    + newOrcs,
            goblin: retreatedByType.goblin + newGoblins,
        };
    }

    /**
     * Compute repaired HP values for each wall section.
     * Repair formula: newHp = currentHp + floor((maxHp - currentHp) / 2)
     * @param {Array<{ id: string, hp: number, maxHp: number }>} wallSections
     * @returns {Array<{ id: string, newHp: number }>}
     */
    computeWallRepairs(wallSections) {
        return wallSections.map(s => ({
            id:    s.id,
            newHp: s.hp + Math.floor((s.maxHp - s.hp) / 2),
        }));
    }

    /** Advance to the next year. Returns false if the campaign is over. */
    advance(nextUnits) {
        this.year++;
        this.startingUnits = { ...nextUnits };
        return this.year <= this.maxYears;
    }

    reset() {
        this.year          = 1;
        this.startingUnits = { ...TOTAL_UNITS };
    }
}

import { CONFIG } from './constants.js';
import { game } from './game.js';
import { audio } from './audio.js';

export class CombatSystem {
    #accumulator = 0;
    #wallSections;
    #squads;
    #defenders;

    constructor(wallSections, squads, defenders) {
        this.#wallSections = wallSections;
        this.#squads       = squads;
        this.#defenders    = defenders;
    }

    tick(dt) {
        this.#accumulator += dt;
        if (this.#accumulator < CONFIG.COMBAT_TICK_RATE) return;
        this.#accumulator -= CONFIG.COMBAT_TICK_RATE;
        this.#resolve();
    }

    #resolve() {
        for (let i = 0; i < this.#wallSections.length; i++) {
            const section  = this.#wallSections[i];
            const defGroup = this.#defenders[i];

            if (section.breached) continue;

            const engaged = section.engagedSquads.filter(
                s => s.units.some(u => u.alive && u.attacking)
            );
            if (engaged.length === 0) continue;

            // ── Melee units (orc, ogre) attack wall ───────────────────────────
            let totalMeleeAttack = 0;
            let hasOgre = false;

            for (const squad of engaged) {
                for (const unit of squad.units) {
                    if (!unit.alive || !unit.attacking || unit.unitType === 'goblin') continue;
                    const stats = CONFIG.UNITS[unit.unitType];
                    totalMeleeAttack += stats.attack * stats.attackSpeed * CONFIG.COMBAT_TICK_RATE;
                    if (unit.unitType === 'ogre') hasOgre = true;
                }
            }

            // Activate defender combat animations on first engagement
            if (defGroup) defGroup.activateCombat();

            if (totalMeleeAttack > 0) {
                section.hp = Math.max(0, section.hp - totalMeleeAttack);
                audio.play('melee');

                if (section.hp === 0) {
                    section.breach();
                    continue;
                }
            }

            // ── Goblin ranged units attack defenders ──────────────────────────
            const goblinSquads = engaged.filter(s => s.units.some(u => u.alive && u.attacking && u.unitType === 'goblin'));

            if (goblinSquads.length > 0 && defGroup) {
                const goblinStats = CONFIG.UNITS.goblin;
                const goblinDmg   = goblinStats.attack * goblinStats.attackSpeed * CONFIG.COMBAT_TICK_RATE;

                for (const squad of goblinSquads) {
                    for (const unit of squad.units) {
                        if (!unit.alive || !unit.attacking || unit.unitType !== 'goblin') continue;
                        if (!unit.defenderTarget || unit.defenderTarget.hp <= 0) {
                            const alive = defGroup.getAliveDefenders();
                            if (alive.length > 0) {
                                unit.defenderTarget = alive[Math.floor(Math.random() * alive.length)];
                            } else {
                                unit.defenderTarget = null;
                                unit.attacking = false;
                                unit.pool.playIdle(unit);
                            }
                        }
                        if (unit.defenderTarget) {
                            defGroup.damageSpecific(unit.defenderTarget, goblinDmg);
                        }
                    }
                }
            }

            if (hasOgre && Math.random() < 0.15) audio.play('ogre');
        }

        game.checkDefeat();
    }
}

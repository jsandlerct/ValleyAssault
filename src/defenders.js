import * as THREE from 'three';
import { scene, mixers } from './scene.js';
import { CONFIG, DEFENDERS } from './constants.js';
import { normalizeModel } from './loader.js';

export class WallDefenders {
    #defenders    = [];   // { model, mixer, hp, idleAction, attackAction }
    #aliveCount   = 0;
    #combatActive = false;

    constructor(section, cache, archerPath, magePath) {
        const sx = CONFIG.SECTION_X[section.id];
        const sz = CONFIG.WALL_Z + DEFENDERS.FIRE_Z_OFF;

        for (let i = 0; i < DEFENDERS.X_POSITIONS.length; i++) {
            const isMage = DEFENDERS.MAGE_INDICES.has(i);
            const path   = isMage ? magePath : archerPath;
            try {
                const model = cache.clone(path);
                normalizeModel(model, DEFENDERS.HEIGHT);
                const yOff = model.position.y;
                model.position.set(sx + DEFENDERS.X_POSITIONS[i], DEFENDERS.WALL_TOP_Y + yOff, sz);
                model.rotation.y = 0;  // face +Z (toward attackers coming from staging zone)
                model.traverse(c => { if (c.isMesh) c.castShadow = false; });
                scene.add(model);

                const clips = cache.getAnimations(path);
                const mixer = new THREE.AnimationMixer(model);
                mixers.add(mixer);

                const idleClip   = clips.find(c => c.name.toLowerCase().includes('idle'))   ||
                                   clips.find(c => c.name.toLowerCase().includes('stand'))  ||
                                   clips.find(c => !c.name.toLowerCase().includes('attack')) ||
                                   clips[0];
                const attackClip = clips.find(c => c.name.toLowerCase().includes('attack')) || idleClip;

                const idleAction   = idleClip   ? mixer.clipAction(idleClip).setLoop(THREE.LoopRepeat)   : null;
                const attackAction = attackClip  ? mixer.clipAction(attackClip).setLoop(THREE.LoopRepeat) : null;

                if (idleAction) idleAction.play();

                this.#defenders.push({ model, mixer, hp: DEFENDERS.DEFENDER_HP, idleAction, attackAction });
                this.#aliveCount++;
            } catch (e) { /* skip if model unavailable */ }
        }
    }

    get aliveCount() { return this.#aliveCount; }

    activateCombat() {
        if (this.#combatActive) return;
        this.#combatActive = true;
        for (const d of this.#defenders) {
            if (d.hp <= 0 || !d.attackAction || d.attackAction === d.idleAction) continue;
            d.idleAction?.stop();
            d.attackAction.reset().play();
        }
    }

    getAliveDefenders() {
        return this.#defenders.filter(d => d.hp > 0);
    }

    damageSpecific(defender, dmg) {
        if (defender.hp <= 0) return;
        defender.hp -= dmg;
        if (defender.hp <= 0) {
            defender.hp = 0;
            this.#aliveCount--;
            mixers.delete(defender.mixer);
            scene.remove(defender.model);
        }
    }

    takeDamage(totalDmg) {
        const alive = this.getAliveDefenders();
        if (alive.length === 0) return;
        this.damageSpecific(alive[Math.floor(Math.random() * alive.length)], totalDmg);
    }

    remove() {
        for (const d of this.#defenders) {
            mixers.delete(d.mixer);
            scene.remove(d.model);
        }
        this.#defenders  = [];
        this.#aliveCount = 0;
    }
}

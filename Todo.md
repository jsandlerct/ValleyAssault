# Todo

- [ ] Fix bug where some player units do not take damage even though they are being shot with projectiles
- [ ] Player units are walking through mountains.  They should path around them.
- [ ] **Setup screen — zone pad overlap with trees**: Reserve zone pads (z≈11, x=±12) may visually clip into trees at (±14, 12). Test in-game; if needed, reduce `padW` from 10 to 8 in `SETUP.ZONES` or shift reserve zones to z=13.
- [ ] **Setup screen — drag-and-drop verification**: Verify individual unit dragging works correctly at all squad sizes (especially when pool zone is full of 66 units). Check that dropping outside all zones returns unit to origin.

## Needs In-Game Verification / Tuning

- [ ] **Sound** — Rewritten June 20 to use Web Audio API (fetch + decodeAudioData + BufferSource nodes). Needs in-game confirmation sounds play.

- [ ] **Projectile facing** — Fixed June 20: arrow/spear geometry pre-rotated π/2 around X so `lookAt` aligns long axis with flight path. Verify in-game.

- [ ] **Unit facing** — Audited June 20: `atan2(dx, dz)` formula is correct. No code bug found. Needs in-game visual confirmation.

- [ ] **Wall defender facing** — Defenders use `rotation.y = 0` (faces +Z toward staging area). If Character_Male_1 or Wizard.gltf default to facing -Z, change defenders.js to `Math.PI`. Needs in-game check.

- [ ] **Unit separation + obstacle avoidance tuning** — Constants in squad.js: `SEP_RADIUS=0.85`, `SEP_STRENGTH=3.0`, `OBS_CLEARANCE=1.5`, `OBS_STRENGTH=6.0`. Obstacle radii in main.js: rocks 1.2, trees 0.9, pine groups 3.0. Tune as needed.

## Fixed

- [x] **Units flash red when not taking damage** — Root cause: `#damageSquad` was called with `damage=0` when all defenders are dead (`effectiveDmg = SECTION_DEFEND_DAMAGE × aliveRatio`, aliveRatio=0). Fix: `if (damage <= 0) return` at top of `#damageSquad`. Also added `u.attacking` filter so marching units can't take damage.

- [x] **Defenders animate continuously** — Fixed: start with idle animation, switch to attack via `activateCombat()` on first combat tick per section.

- [x] **Units path through rocks and trees** — Fixed: proximity-based obstacle avoidance steering added to march loop. Each unit independently computes avoidance from 17 obstacles (6 pine groups r=3.0, 6 trees r=0.9, 5 rocks r=1.2). Same loop also handles unit-to-unit separation across all squads.

- [x] **Units stack when multiple squads attack same section** — Fixed June 20: separation force in march loop.

- [x] **Projectile cylinders face north-south** — Fixed June 20: geometry pre-rotated.

# Valley Assault — Claude Code Guidelines

## Workflow: Maintaining Docs After Each Enhancement

After every enhancement, bug fix, or new feature is added:

1. **Update `Todo.md`** — mark completed items done, add newly discovered issues as new items.
2. **Update `docs/tdd.md`** — record all implementation decisions made during the enhancement: what was chosen, what was changed from the original plan, and why. The TDD is a living record of what was actually built, not just the original design.
3. **Run `npm test`** — all tests must pass before reporting a feature complete. If a test fails, fix the code (or, if the test itself has a wrong premise, fix the test and document why).

This keeps future sessions oriented quickly without re-deriving what has already been decided.

## Test Suite

Run: `npm test` (Vitest, 42 tests across 4 files)

Test files live in `src/__tests__/`:

| File | What it covers |
|---|---|
| `constants.test.js` | Schema validation — every unit type, zone, and section has required fields |
| `game.test.js` | Game state machine — all state transitions, breach, defeat, victory |
| `combat.test.js` | CombatSystem — tick accumulator, melee damage, goblin vs defenders |
| `wall.test.js` | WallSection — hp setter, breach idempotency, onBreach callback |

**Rule: every new feature requires tests.**

- New game mechanic → add cases to `game.test.js` or `combat.test.js`
- New unit type or stat → add to `constants.test.js`
- New wall/section behavior → add to `wall.test.js`
- New module with testable logic → add a new `<module>.test.js` file
- Three.js / DOM-heavy code that can't be unit tested → note it explicitly and cover the closest testable boundary

Never mark a feature done until `npm test` passes.

## Project Summary

**Valley Assault** — a 3D browser-based real-time tactics game built with Three.js and Vite.  
Player commands squads of orcs, goblins, and ogres against a three-section wall. Combat is automatic; player role is squad assignment and timing.

- **Entry point:** `src/main.js`
- **Constants (all tunable values):** `src/constants.js`
- **PRD:** `docs/PRD.md`
- **TDD (living document):** `docs/tdd.md`
- **Current bug backlog:** `Todo.md`
- **Performance notes:** `performance_todo.md`

## Key Architecture Decisions

- Unit types are `orc`, `goblin`, `ogre` (mapped to Zombie.gltf, Goblin.gltf, Giant.gltf from cubeworld pack).
- All tunable constants live in `src/constants.js` — never hardcode values in logic files.
- Goblins are ranged: they stop at `CONFIG.GOBLIN_RANGE` from the wall and target individual defenders, not the wall HP.
- Melee units (orc, ogre) attack wall HP directly; goblins kill defenders, reducing volley count.
- Wall defenders (`WallDefenders`) are animated archers and mages placed on the wall top.
- Projectiles use pooled `THREE.Mesh` objects (no scene.add/remove during play).
- AnimationMixers use a `Set` (not Array) so inactive pool units don't burn frame time.
- CSS2DRenderer wall health bars use a `labelDirty` flag — DOM writes only happen when HP changes.

## Tech Stack

| Layer | Choice |
|---|---|
| Renderer | Three.js (installed in node_modules) |
| Bundler | Vite (`npm run dev`) |
| Language | Vanilla ES modules, no TypeScript |
| Camera | PerspectiveCamera + OrbitControls (user-adjustable) |
| 3D UI | CSS2DRenderer (wall HP bars) |
| Audio | HTML Audio API pooled instances |

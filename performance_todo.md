# Performance TODO

## 1. Cull AnimationMixer updates to active units only

All pre-allocated pool units (96 units + 24 defenders ≈ 120 mixers) run `mixer.update(dt)` every frame, including invisible units sitting in the pool. Only ~30 are ever active at once.

**Fix:** Change `mixers` in `scene.js` from an Array to a Set. In `UnitPool.spawn()` add the mixer to the Set; in `despawn()` delete it. Do the same for defender mixers in `defenders.js`.

**Files:** `src/scene.js`, `src/squad.js`, `src/defenders.js`

---

## 2. Cache emissive meshes on unit objects — remove traverse from flashHit

`flashHit` calls `model.traverse()` twice per hit (set + reset after 200ms). On a combat tick with 60 engaged units that's 120 traversals per second.

**Fix:** During `UnitPool` construction (when materials are already being cloned), collect meshes with an `emissive` property into an `emissiveMeshes` array and store it on the unit object. `flashHit` iterates that array directly instead of traversing.

**Files:** `src/squad.js`

---

## 3. Reuse scratch Vector3s in Squad.update()

`Squad.update()` calls `#targetWorldPos()` which returns `new THREE.Vector3()`, then creates another via `.clone().sub()`, then a third in `dir.normalize()...` — ~3 short-lived allocations per unit per frame. With 63 marching units that's ~190 Vector3s/frame going to GC.

**Fix:** Add two class-level scratch vectors (`#_target`, `#_dir`) to `Squad` and reuse them in the update loop via `subVectors`, `normalize`, etc. instead of allocating.

**Files:** `src/squad.js`

---

## 4. Dirty-flag wall label DOM updates

`updateLabel()` is called for all 3 sections every frame, writing `style.width`, `style.backgroundColor`, and `textContent` unconditionally — 9 DOM mutations per frame even when HP hasn't changed.

**Fix:** Add a `labelDirty` flag to `WallSection`. Set it to `true` whenever `hp` changes (use a setter). In the main loop, only call `updateLabel(section)` when `section.labelDirty` is true, then clear the flag.

**Files:** `src/wall.js`, `src/main.js`, `src/ui-3d.js`

---

## 5. Pool projectile meshes — eliminate scene.add/remove churn

Every 0.35s, 3–9 new `THREE.Mesh` objects are created, added to the scene, then removed and discarded 0.45s later. `scene.add`/`remove` update parent references and dirty matrix flags and are non-trivial. This also allocates `from.clone()` and `to.clone()` per projectile.

**Fix:** Pre-create a pool of ~20 meshes per type (`arrow`, `bolt`, `spear`) at startup. On fire, take one from the pool and set `visible = true`. On expire, set `visible = false` and return it. Store position data directly on the pooled object rather than cloning Vector3s.

**Files:** `src/main.js`

---

## 6. Maintain aliveCount as an integer in WallDefenders

`defGroup.aliveCount` calls `this.#defenders.filter(d => d.hp > 0).length` — creates a new array — every 0.35s in `tickProjectiles` and every 1.0s in `combat.js`.

**Fix:** Add a `#aliveCount` integer field, initialize it to `X_POSITIONS.length` in the constructor, and decrement it in `takeDamage()` when a defender dies. The getter returns the integer directly.

**Files:** `src/defenders.js`

---

## 7. Reduce shadow map cost

`PCFSoftShadowMap` at `2048×2048` samples 9 texels per shadow lookup. With 60+ shadow-casting skinned meshes this is meaningful GPU time. The difference is barely visible from a top-down camera.

**Fix (two lines in `src/scene.js`):**
```js
renderer.shadowMap.type = THREE.PCFShadowMap;  // 1 sample instead of 9
sunLight.shadow.mapSize.set(1024, 1024);       // quarter the texel count
```

**Files:** `src/scene.js`

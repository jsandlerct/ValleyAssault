# Siege of the Valley

### Product Requirements Document
*Working title — final name TBD*

**Author:** Jeff
**Document version:** 0.1 (initial draft)
**Date:** June 19, 2026
**Status:** Prototype scope — single level

---

## Table of Contents

1. [Overview](#1-overview)
2. [Reference Material](#2-reference-material)
3. [Core Gameplay Loop](#3-core-gameplay-loop)
4. [Units, Squads & the Wall](#4-units-squads--the-wall)
5. [UI / UX Requirements](#5-ui--ux-requirements)
6. [Open Questions & Risks](#6-open-questions--risks)
7. [Future Considerations (Out of Scope for This Phase)](#7-future-considerations-out-of-scope-for-this-phase)

---

## 1. Overview

### 1.1 Concept

Siege of the Valley is a 3D real-time tactics game in which the player commands a monster army — zombies, goblins, and giants — in a single coordinated assault against a fortified wall at the end of a valley. The player does not control individual units directly. Instead, the player organizes their army into squads, then issues attack orders telling each squad which of three wall sections to advance on and when. Combat between an engaged squad and the wall resolves automatically, without further player input, based on each squad's stats and the defending section's stats.

The reference screenshot supplied with this brief (a top-down, blocky/voxel-style siege scene with three highlighted wall sections, a squad command panel, and per-section health bars) is the primary visual and UX target for the prototype.

### 1.2 Goals for this Prototype

- Prove out the core loop: assign squads → squads march → squads engage a wall section → section HP depletes → section breaches → player commits units through the breach to win.
- Validate that asymmetric squad types (zombies, goblins, giants) create interesting attack-order decisions even with fully automatic combat.
- Establish an art pipeline using the two existing low-poly asset packs (the "Cube World" character/voxel set and the "Ultimate Fantasy RTS" building/wall set) so future levels can be built quickly from the same assets.

### 1.3 Non-Goals (this phase)

- No campaign, no level progression, no meta-game (resource gathering, base building, unlocks).
- No multiplayer.
- No manual/direct unit control (no RTS-style click-and-drag micromanagement of individual units).
- No enemy AI behaviors beyond static defenders per wall section (see Section 4.4) — defenders do not sortie out, reinforce other sections, or use abilities in this phase.
- No save/load or session persistence — a single level is played start to finish in one sitting.

### 1.4 Platform & Engine

Target: desktop browser, built with three.js (per existing project setup). Single-player, keyboard/mouse input, top-down/isometric camera matching the concept art's perspective.

---

## 2. Reference Material

### 2.1 Concept Art

The supplied concept art screenshot establishes the target UX and visual language:

- Top-down isometric camera angle showing the full battlefield: army staging area in the foreground, open valley ground in the middle, wall at the back.
- The wall is visually divided into three labeled sections (Section A — Left, Section B — Center, Section C — Right), each with its own health bar and percentage readout rendered above it in 3D space.
- A primary-target banner at the top of the screen states the current objective in plain language (e.g. "PRIMARY TARGET: [Wall Name]. Select Squad, Assign Target Section.").
- A persistent Squad Command Panel (bottom-left) lists every squad with: unit type icon, name, a color-coded health bar, current HP value, and squad size.
- A contextual order menu (bottom-right) appears once a squad is selected, offering one button per wall section ("ATTACK SECTION A/B/C"); the chosen order is echoed back as a small "Order Issued" confirmation label.
- A resource readout (top-right) shows a single currency ("Mana") — out of scope for combat mechanics in this prototype, but the UI slot should be reserved for future use.
- A match timer (top-left) counts up from the start of the engagement.

### 2.2 Asset Packs Provided

Two existing low-poly glTF asset libraries are available and should be the exclusive source of 3D models for the prototype — no new modeling work is required to build the first playable level.

#### 2.2.1 "Cube World" set — units, characters, and small environment props

Indexed in `cubeworld_assets.json`. Notably includes ready-made enemy/monster models that map directly onto our three squad types:

| Squad Type | Asset ID | Source Path |
|---|---|---|
| Zombies | `enemy_zombie` | `/assets/cubeworld/Enemies/glTF/Zombie.gltf` |
| Goblins | `enemy_goblin` | `/assets/cubeworld/Enemies/glTF/Goblin.gltf` |
| Giants | `enemy_giant` | `/assets/cubeworld/Enemies/glTF/Giant.gltf` |

Additional Cube World assets useful for valley dressing and polish: trees (`env_tree_1/2/3`), rocks (`env_rock1/2`), bushes, crystals, and terrain blocks (`block_grass`, `block_dirt`, `block_stone`) for any voxel-style ground detailing. Other enemy models (Skeleton, Wizard, Demon, Yeti, Hedgehog) and the playable `Character_Male/Female` models are available but not required for this prototype's three squad types — flagged here as candidates for future squad variety.

#### 2.2.2 "Ultimate Fantasy RTS" set — the wall and base structures

Indexed in `buildings_assets.json`. This pack provides purpose-built wall and fortification assets:

| Element | Asset ID(s) | Notes |
|---|---|---|
| Wall segments | `wall_firstage` / `wall_secondage` | Two visual eras available; recommend FirstAge for the prototype's rustic look |
| Wall towers | `walltowers_firstage`, `walltowers_door_firstage`, `walltowers_doorclosed_firstage` | Door variant marks the eventual breach point per section |
| Defensive structures | `watchtower_firstage_1/2/3`, `archery_firstage_1/2/3`, `barracks_firstage_1/2/3` | For dressing the defender side and signaling section identity |
| Valley/army staging dressing | `towncenter`, `houses`, market stalls, `port` | Optional — for player-side staging area visual interest |
| Natural terrain | `mountain_single`, `mountain_large_single`, `mountain_group_1/2`, `resource_pinetree(_group)` | For valley walls/backdrop framing, matching the concept art's mountain backdrop |

> **Note:** the asset index flags a known filename typo on disk — `Storage_FirstAge_Leve3.gltf` (missing the "l" in "Level3"). Not relevant to wall/military assets used here, but worth remembering if storage buildings are pulled in later.

### 2.3 Visual Direction

Combine both packs under one consistent low-poly aesthetic: Cube World's blocky, saturated, Minecraft-adjacent units against Ultimate Fantasy RTS's slightly more detailed (but still low-poly) medieval architecture. Both are stylistically compatible low-poly/low-color-count assets, so no shader work should be needed beyond consistent lighting and possibly a shared toon/flat-shaded material pass for visual cohesion.

---

## 3. Core Gameplay Loop

### 3.1 Loop Summary

A single play session follows this loop:

1. Player reviews their starting army, already divided into squads, in the Squad Command Panel.
2. Player selects a squad, then issues an attack order assigning it to Wall Section A, B, or C.
3. The squad marches from the staging area to its assigned section (no player input required during the march).
4. On arrival, the squad automatically begins attacking that section. Combat resolves automatically each tick: the squad deals damage to the section's HP, and the section's defenders deal damage back to the squad, until one of several end states is reached (see 3.3).
5. Player repeats steps 2–4 for remaining squads, choosing whether to mass multiple squads on one section or spread them across sections, and watches section HP bars fall in real time.
6. Once a section's HP reaches 0, that section is breached and open.
7. Player must then commit at least half of their remaining (surviving, not-yet-spent) units through the breached section to win the level. Units sent through are removed from the battlefield (counted as "through the wall") rather than continuing to fight.
8. Level ends in victory once the "send half your remaining units through" condition is met, or in defeat if the player's entire army is destroyed before any section is breached and the win condition met.

### 3.2 Squad Assignment & Orders

- Each squad can have exactly one active order at a time: idle/holding, marching to a section, or engaged with a section.
- A squad can be redirected (re-ordered to a different section) only while marching or idle. Once a squad is engaged with a wall section, it remains committed to that section until the squad is destroyed or the section is breached — no mid-combat retreat or reinforcement in this phase (per scope decision).
- Multiple squads can be assigned to the same section simultaneously; their damage to that section's HP is additive.
- There is no limit on how many of the three sections can be attacked at once — the player may commit all squads to one section, split evenly, or any other distribution.

### 3.3 Combat Resolution (Automatic)

Per the scope decision for this phase, combat is fully automatic once a squad is engaged with a section — no player input is required or possible during the engagement itself. Recommended resolution model for the prototype:

- Each combat tick (e.g. once per second), an engaged squad's total damage output (sum of its remaining units' attack values) is subtracted from the section's current HP.
- Simultaneously, the section's defender damage output is distributed across the squad's units, reducing squad HP and removing units once their individual HP reaches 0.
- A squad that reaches 0 remaining units is destroyed and removed from the Squad Command Panel.
- A section that reaches 0 HP is breached: its defenders stop dealing damage, the gate/wall model swaps to a "breached" visual state, and any squads still engaged there stop taking damage but remain in place until given a new order.
- Open design question: whether breach status is permanent for the remainder of the level (recommended for prototype simplicity) or whether defenders can be reinforced/repair the section — out of scope for this phase per the non-goals above.

### 3.4 Win / Loss Conditions

| Condition | Trigger | Result |
|---|---|---|
| Victory | At least one wall section is breached AND at least 50% of the player's remaining (surviving) units have been sent through that breach | Level complete |
| Defeat | All squads are destroyed before the victory condition is met | Level failed |

**Note on "remaining units":** this should be calculated at the moment of breach (or continuously, whichever is simpler to implement first) as the total unit count across all surviving squads, not the original army size — units lost in earlier failed pushes on other sections do not count against the player when computing the 50% threshold.

---

## 4. Units, Squads & the Wall

### 4.1 Squad Types

Three unit types, matching the reference screenshot's Squad Command Panel exactly:

| Type | Asset | Suggested Role | Relative HP | Relative Attack | Relative Speed |
|---|---|---|---|---|---|
| Zombies | `enemy_zombie` | Cheap, numerous, attritional — soak damage and chip away HP in large numbers | Low | Low | Slow |
| Goblins | `enemy_goblin` | Fast, fragile, good for quick section probes or finishing off a nearly-breached section | Low | Medium | Fast |
| Giants | `enemy_giant` | Few, expensive, high per-unit impact — best used to punch through a section quickly | High | High | Slow |

Exact numeric values are a balancing task for prototyping/playtesting, not fixed by this PRD. The relative roles above are directional starting points based on the reference screenshot (where Zombie squad size was largest at 178, Goblins at 172, and the Giants squad was smallest at 125 with implied higher per-unit power).

### 4.2 Starting Army

The level begins with a fixed, pre-divided army (no in-level recruitment or production in this phase). Recommended starting composition for the prototype, loosely following the reference screenshot's squad sizes:

- **Squad 1 — Zombies** (largest squad, lowest individual stats)
- **Squad 2 — Goblins** (large squad, balanced stats)
- **Squad 3 — Giants** (smallest squad, highest individual stats)

Open question for playtesting: whether the prototype should offer exactly one squad per type (as above, matching the reference screenshot) or allow multiple squads of the same type at level start. The PRD recommends starting with the simpler one-squad-per-type model and expanding only if early playtesting shows a need for more tactical granularity.

### 4.3 The Wall

- The wall spans the end of the valley and is visually divided into three sections — Left, Center, Right — matching Sections A/B/C in the reference screenshot.
- Each section has its own independent HP pool and is visually built from the Ultimate Fantasy RTS wall assets (`wall_firstage` segments plus `walltowers_firstage` at section boundaries).
- Each section's gate/tower should use the `walltowers_door_firstage` variant to telegraph where the eventual breach opens, with `walltowers_doorclosed_firstage` as the pre-breach "closed" state if a closed/open visual swap is desired.
- Section HP and defender strength can be equal across all three sections for the initial prototype (simplest balancing case), with asymmetric section difficulty (e.g. a tougher center section, per the reference screenshot's varying HP%) as a follow-up tuning pass.

### 4.4 Wall Defenders

Per the scope decision for this phase, defenders are static per section: each section has a fixed defending force/strength stat that deals damage to engaged squads and does not move, retreat, reinforce other sections, or escalate over time. This keeps the automatic combat resolution (Section 3.3) simple and deterministic for the prototype. Defender visual representation (e.g. small NPC figures on the wall using Cube World's Skeleton or Character models) is a polish item, not required for core loop validation.

---

## 5. UI / UX Requirements

All UI requirements below are derived directly from the supplied concept art and should be treated as the prototype's UX target.

### 5.1 HUD Elements

| Element | Position | Behavior |
|---|---|---|
| Match timer | Top-left | Counts up from 00:00:00 at level start; purely informational in this phase |
| Primary target banner | Top-center | States current objective in plain text; updates if/when objective state changes (e.g. on first breach) |
| Resource readout ("Mana") | Top-right | Reserved UI slot; no functional resource system in this prototype — display only, or omit entirely if not used |
| Section health bars + % HP | Above each wall section, in 3D world space | Color-coded (e.g. green/yellow/red by HP%), updates live during combat |
| Squad Command Panel | Bottom-left | Persistent list of all squads: icon, name, HP bar, HP value, squad size; selecting a squad here begins the order-assignment flow |
| Order menu | Bottom-right, contextual | Appears only when a squad is selected; one button per wall section ("ATTACK SECTION A/B/C"); shows brief "Order Issued" confirmation on click |

### 5.2 Camera

- Fixed or lightly-adjustable top-down/isometric angle matching the concept art — full battlefield (staging area, valley, wall) visible without requiring the player to scroll or pan during normal play.
- Open question: whether the prototype needs camera pan/zoom at all, or whether a single fixed framing is sufficient for a one-screen level. Recommend starting fixed and adding pan/zoom only if the valley is too large to fit in one frame at the desired unit/wall scale.

### 5.3 Input

- Click/select a squad in the Squad Command Panel or directly on its on-field representation.
- Click a section-assignment button in the order menu to issue the attack order.
- No drag-select, no direct unit control, no keyboard shortcuts required for the prototype (mouse-only is sufficient to replicate the reference screenshot's interactions).

---

## 6. Open Questions & Risks

Flagged throughout this document, consolidated here for visibility:

- Exact unit stats (HP, attack, speed) per squad type — needs a balancing pass once the prototype is playable end-to-end.
- Whether multiple squads of the same unit type should be allowed at level start, or strictly one squad per type.
- Whether wall sections should have equal or asymmetric HP/defender strength for the first playable build.
- Whether a breached section can ever be "un-breached" (defenders reinforce/repair) — currently assumed no for this phase.
- Camera: fixed single framing vs. pan/zoom — depends on final valley scale once blocked out in-engine.
- Whether the "Mana"/resource UI slot from the reference screenshot should be visually present but inert, or omitted until a future phase gives it function.
- Tick rate and exact damage formula for automatic combat resolution (Section 3.3) — implementation detail to be finalized during build, not fixed by this PRD.

---

## 7. Future Considerations (Out of Scope for This Phase)

Captured here only to avoid losing good ideas raised during scoping — none of the below are required for the prototype:

- Campaign mode with multiple valleys/walls and difficulty progression, potentially using the SecondAge variants already present in the buildings asset pack for a visual "era upgrade" feel.
- Additional squad types from the Cube World pack already in the asset library (Skeletons, Wizards, Demons, Yeti) for army variety in later levels.
- Manual reinforcement/retreat during an active engagement, and/or defender reinforcement between sections — both explicitly deferred per the scope decision for this phase.
- A functional resource/mana economy tied to the reserved top-right UI element.
- Multiplayer or asynchronous PvP siege scenarios.

# Shadow of the Village — A Japanese Revenge Adventure

A browser adventure game built in vanilla HTML, CSS and JavaScript. It has no build step and no dependencies. All art, sound and music are generated in code.

## Run it

- **Easiest:** double-click `index.html`. It runs straight from `file://` in Chrome, Edge or Firefox.
- **Local server (optional):** `python3 -m http.server 8000` in this folder, then open http://localhost:8000.
- Click once anywhere to turn on sound. Browsers block audio until you interact with the page.

## Controls

| Action | Keyboard / mouse | Touch |
|---|---|---|
| Move | WASD / arrow keys | Left joystick |
| Light attack (combo) | Left click (or J) | 斬 |
| Heavy attack | Hold left click, then release | Hold 斬 |
| Block / counter (block just as a hit lands) | Right click (or K) | 守 |
| Dodge roll | Space | 避 |
| Interact / talk / advance dialogue | E (or F) | E |
| Ability: Shadow Strike (full Resolve) / Shadow Dash | Q | Q |
| Quick items: heal / stamina / smoke bomb | 1 / 2 / 3 | 1 2 3 |
| Map / Inventory / Pause | M / I / Esc | ≡ |
| Skip cinematic | Hold Esc / tap SKIP | SKIP |

## Project structure

```
index.html
css/  main · menu · game (HUD) · ui (panels) · inventory · shop · dialogue (+cinematic) · map · animations
js/   core       namespace, utils, seeded RNG, event bus, asset registry, game state
      data       items, abilities, upgrade tracks, lore
      audio      Web Audio synth placeholders + file override hook
      save       localStorage adapter (swap for a backend), settings, slots, autosave
      input      keyboard / mouse / touch → named actions
      sprites    procedural characters, wolves, item icons, portraits
      world      area loading, ground pre-render, props, collision, particles, lighting, weather
      areas      world layout: village, father's house, bamboo forest, deep grove, shrine; 10 map regions
      collectibles, inventory, combat, player, enemies, dialogue, npc, missions, puzzles,
      story      (cinematic engine + scripted events), shop, map, ui, game (loop/camera), main (menu/boot)
assets/  images/ audio/ sprites/   (empty; ready for real assets)
```

### Adding real assets later
- Sprites: `SV.Assets.register('player', 'assets/sprites/ren.png')`. Then pass `sprite: 'player'` in a look object, and `drawHuman` uses the image.
- Audio: `SV.Audio.files.swing = 'assets/audio/swing.ogg'`. Any synth key can be overridden this way.
- Backend: replace `SV.Store` (get/set/remove) in `save.js` with API calls.

## What's playable now (v0.4)

- **Main menu:** animated night village with moon, clouds, fog, lanterns, falling leaves and a samurai silhouette. Includes New Journey, Continue, Load, Settings and Credits.
- **Missions 01–04, fully playable:**
  1. *Ashes of Kurohana:* opens with a flashback, then you investigate father's house, the burnt letter, the elder and the crest under the hearth. You follow footprints to a hidden shrine, where a masked ambush ends in a boss fight. Unlocks Shadow Strike.
  2. *The Broken Blade:* find the broken katana behind the waterfall and 3 fragments, then Tetsuo reforges it in a cinematic. Hayato trains you in heavy strikes, dodging and parrying. You then fight Goro's bandit camp.
  3. *Into the Bamboo:* the deep grove, Hana's missing son, herbs, a hidden path, the lantern-poem gate puzzle, a wolf pack, and the rescue. Unlocks healing (remedy crafting and meditation) and Smoke Escape.
  4. *The Silent Shrine:* 3 hidden keys (pond, toppled statue, Hollow Ronin), 3 symbol stones, rotating fox statues and a symbol-dial seal, then the father's-spirit reveal. Unlocks Shadow Dash and a ledger clue.
- **Combat:** light combo (up to 3 hits with Quick Slash), charged heavy, block, perfect-block counter, i-frame roll, Resolve meter, Shadow Strike multi-blink, Shadow Dash, smoke bombs, crits, poise and stagger, hit-stop, screen shake, slow-motion and damage numbers.
- **Enemies:** bandits, wolves, Crane footsoldiers, plus three boss-type enemies (the Masked Stranger, Goro, the Hollow Ronin). Their AI covers detection, chasing and strafing, telegraphed wind-ups, blocking, evading, combos, leash-return and loot drops.
- **NPCs:** 11 villagers who walk waypoint schedules, bow when spoken to, show quest markers, and have branching dialogue that changes with progress. The old farmer has his own branching dialogue.
- **No levels:** you get stronger through the blacksmith's 8 upgrade tracks (4 for the blade, 4 for armor), bought armor, story abilities and collectible set rewards.
- **Inventory:** 6 categories plus Abilities and Journal tabs. You can equip, use, inspect, discard and craft remedies.
- **Shops:** Tetsuo (upgrades, armor, materials, sell) and Okiku (consumables, sell), paid in Ryo.
- **Side quests:** the farmer's comb, the quest-board bounty and the monk's five petals.
- **Collectibles:** 4 Father's Memories (flashback scenes), 3 scrolls, 3 relics, 5 petals, Ryo pouches and chests. Completing a set gives a reward, and collecting all the memories sets a secret-ending flag.
- **World:** a day / sunset / night / dawn cycle with dynamic lighting, glowing lanterns and windows, rain, fog, wind, leaves, petals, embers, fireflies, flowing water and koi.
- **Map:** 10 regions with lock reasons, objective and shop markers, fast travel, and a live local minimap. An on-screen objective marker shows the distance and routes you through exits.
- **Saving:** autosave (objectives, pickups, purchases, puzzles, story events, new areas) plus 3 manual slots.
- **Settings and devices:** audio levels, text speed, screen shake, particles, time and weather locks, and hints. Touch controls work on mobile.

## Roadmap (next iterations)

- **Mission 05 The Bandit Camp:** stealth infiltration, prisoner rescue, alarm, commander boss.
- **Mission 06 Blood on the Mountain:** mountain path, mysterious NPC, elite ambush, major reveal.
- **Mission 07 The Burning Village:** `villageBurned` flag variant of Kurohana (fire hooks already in `areas.js`), rescue/extinguish objectives.
- **Mission 08 The Forgotten Temple:** 4 sacred seals, pressure plates, torch puzzles, Ancient Katana.
- **Missions 09–10:** fortress infiltration, identity reveal, final seal puzzle, final boss, and the choice between Revenge, Forgive and Walk Away, with a secret ending gated by all memories.
- More: real sprite sheets and recorded audio, gamepad support, more enemy archetypes.

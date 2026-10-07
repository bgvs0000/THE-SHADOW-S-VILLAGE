/* =========================================================
   DATA — items, abilities, upgrades, lore. Pure data so it can
   later be served from a backend without touching systems.
   ========================================================= */
SV.CATS = [
  ['weapons', 'WEAPONS'], ['armor', 'ARMOR'], ['consumables', 'CONSUMABLES'],
  ['key', 'KEY ITEMS'], ['quest', 'QUEST ITEMS'], ['materials', 'MATERIALS'],
];

SV.ITEMS = {
  // ---------- weapons ----------
  wanderer_katana: { name: "Wanderer's Katana", cat: 'weapons', icon: 'katana', col: '#9aa0a6', dmg: 10,
    desc: 'A plain blade bought on the road. Honest steel, nothing more.', sell: 10 },
  broken_katana: { name: "Father's Broken Katana", cat: 'key', icon: 'broken', col: '#c9c9c9',
    desc: 'Snapped a hand-width below the guard. The tsuba bears the same three feathers as the family crest.', noDiscard: true },
  kurohana_blade: { name: 'Kurohana Blade', cat: 'weapons', icon: 'katana', col: '#e8e2d0', dmg: 16, crit: 0.04,
    desc: "Your father's sword, reforged by Tetsuo. The hamon ripples like smoke over water.", noDiscard: true },
  // ---------- armor ----------
  traveler_garb: { name: "Traveler's Garb", cat: 'armor', icon: 'garb', col: '#4a4f57', def: 0, hp: 0,
    desc: 'Worn hemp and a faded red sash. Light, quiet, offers little protection.', sell: 5 },
  ronin_haori: { name: 'Ronin Haori', cat: 'armor', icon: 'garb', col: '#5a2a2a', def: 3, hp: 10,
    desc: 'A padded haori lined with thin iron plates.', price: 150, sell: 60 },
  shrine_lamellar: { name: 'Shrine Guard Lamellar', cat: 'armor', icon: 'armor', col: '#6b5a32', def: 7, hp: 25,
    desc: 'Lacquered lamellar once worn by shrine guardians. Heavy, but it holds.', price: 380, sell: 150 },
  // ---------- consumables ----------
  health_potion: { name: 'Healing Draught', cat: 'consumables', icon: 'potion', col: '#b42a2a', heal: 40, slot: 1,
    desc: 'Bitter red tonic. Restores 40 HP.', price: 30, sell: 10 },
  herbal_remedy: { name: 'Herbal Remedy', cat: 'consumables', icon: 'potion', col: '#5f8f3f', heal: 65, slot: 1,
    desc: 'Ground bamboo-shade herbs. Restores 65 HP.', price: 55, sell: 20 },
  stamina_potion: { name: 'Ginger Tonic', cat: 'consumables', icon: 'potion', col: '#c9a227', stam: 100, slot: 2,
    desc: 'Restores all stamina and speeds recovery for 10 seconds.', price: 25, sell: 8 },
  rice_ball: { name: 'Onigiri', cat: 'consumables', icon: 'rice', col: '#eeeeee', heal: 20, slot: 1,
    desc: 'Salted rice wrapped in nori. Restores 20 HP.', price: 12, sell: 4 },
  smoke_bomb: { name: 'Smoke Bomb', cat: 'consumables', icon: 'bomb', col: '#555', slot: 3,
    desc: 'Vanish in a burst of smoke. Enemies lose your trail for a few seconds.', price: 40, sell: 12 },
  // ---------- key ----------
  family_crest: { name: 'Family Crest', cat: 'key', icon: 'crest', col: '#c9a227', noDiscard: true,
    desc: 'A bronze disc: three feathers circling a broken blade. On the back, scratched by hand: "Where the blade sleeps, water falls."' },
  burnt_letter: { name: 'Burnt Letter', cat: 'key', icon: 'scroll', col: '#a08a60', noDiscard: true,
    desc: 'Only one line survived the fire: "...the Crane must never find the—"' },
  crane_mask: { name: 'Cracked Crane Mask', cat: 'key', icon: 'mask', col: '#e8e8e8', noDiscard: true,
    desc: 'White lacquer, a red beak painted across the brow. Worn by the stranger at the hidden shrine.' },
  shrine_key: { name: 'Shrine Key', cat: 'key', icon: 'key', col: '#b08d3a', noDiscard: true,
    desc: 'An old bronze key engraved with a fox.' },
  crane_ledger: { name: 'Torn Ledger Page', cat: 'key', icon: 'scroll', col: '#d8d0b8', noDiscard: true,
    desc: 'Columns of names and payments. One entry circled: "Akagawa camp — the second half of the ledger."' },
  // ---------- quest ----------
  sword_fragment: { name: 'Sword Fragment', cat: 'quest', icon: 'shard', col: '#d0d6dc', noDiscard: true,
    desc: 'A sliver of folded steel. It hums faintly when held near the broken blade.' },
  medicinal_herb: { name: 'Shade Herb', cat: 'quest', icon: 'herb', col: '#6fa04a',
    desc: 'Grows only in deep bamboo shade. Three can be ground into a remedy once you know how.', sell: 6, price: 15 },
  kenji_sandal: { name: 'Small Sandal', cat: 'quest', icon: 'sandal', col: '#8a6a40', noDiscard: true,
    desc: "A child's straw sandal, strap torn." },
  farmer_comb: { name: 'Lacquered Comb', cat: 'quest', icon: 'comb', col: '#8b1e1e', noDiscard: true,
    desc: 'Red lacquer with a gold crane... no, a heron. Genji will want it back.' },
  // ---------- materials ----------
  iron_ore: { name: 'Iron Sand', cat: 'materials', icon: 'ore', col: '#6c6f75', desc: 'Satetsu, river iron sand. Used for blade upgrades.', price: 25, sell: 8 },
  leather: { name: 'Cured Leather', cat: 'materials', icon: 'leather', col: '#7a5534', desc: 'Used for armor upgrades.', price: 20, sell: 6 },
  tamahagane: { name: 'Tamahagane', cat: 'materials', icon: 'ingot', col: '#a9b3bd', desc: 'Jewel steel. Required for master-grade upgrades.', price: 90, sell: 30 },
  bandit_token: { name: 'Bandit Token', cat: 'materials', icon: 'coinitem', col: '#8a7556', desc: 'Crude wooden tags carried by road bandits. Store buys them.', sell: 9 },
};

/* Abilities unlock through story only — no character levels. */
SV.ABILITIES = [
  { id: 'heavy', name: 'Heavy Strike', key: 'Hold LMB', how: 'Mission 02 · Training', desc: 'Hold attack to charge, release for a wide, staggering cut. Costs stamina.' },
  { id: 'quick', name: 'Quick Slash', key: 'LMB ×3', how: 'Mission 02 · Training', desc: 'A third, lightning-fast cut finishes your combo for double damage.' },
  { id: 'counter', name: 'Counter', key: 'RMB on impact', how: 'Mission 02 · Training', desc: 'Block just as a blow lands to parry and riposte. Fills Resolve.' },
  { id: 'shadowStrike', name: 'Shadow Strike', key: 'Q (full Resolve)', how: 'Mission 01', desc: 'Spend full Resolve to blink between nearby foes, cutting each one.' },
  { id: 'smoke', name: 'Smoke Escape', key: '3', how: 'Mission 03', desc: 'Smoke bombs let you vanish and slip backwards. Enemies lose your trail.' },
  { id: 'healing', name: 'Herbal Craft & Meditation', key: 'Inventory / Shrines', how: 'Mission 03', desc: 'Grind 3 Shade Herbs into a remedy. Meditate at shrines to recover fully.' },
  { id: 'shadowDash', name: 'Shadow Dash', key: 'Q', how: 'Mission 04', desc: 'Step through shadow: a short, untouchable dash in any direction.' },
];

/* Blacksmith upgrade tracks. cost(t) = cost for tier t+1 */
SV.UPGRADES = {
  swordDmg: { name: 'Edge · Damage', group: 'sword', max: 5, desc: '+15% blade damage per tier', ryo: [60, 110, 180, 260, 360], mats: (t) => ({ iron_ore: t + 1, ...(t >= 2 ? { tamahagane: t - 1 } : {}) }) },
  swordCrit: { name: 'Temper · Critical', group: 'sword', max: 4, desc: '+4% critical chance per tier', ryo: [80, 140, 220, 320], mats: (t) => ({ iron_ore: t + 1, ...(t >= 2 ? { tamahagane: 1 } : {}) }) },
  swordSpeed: { name: 'Balance · Attack Speed', group: 'sword', max: 4, desc: '+8% attack speed per tier', ryo: [70, 130, 200, 300], mats: (t) => ({ iron_ore: t + 1 }) },
  swordHeavy: { name: 'Weight · Heavy Damage', group: 'sword', max: 4, desc: '+30% heavy attack multiplier per tier', ryo: [70, 130, 200, 300], mats: (t) => ({ iron_ore: t + 2 }) },
  armorDef: { name: 'Plates · Defense', group: 'armor', max: 5, desc: '+2 defense per tier', ryo: [50, 100, 160, 240, 340], mats: (t) => (t ? { leather: t + 1, iron_ore: t } : { leather: 1 }) },
  armorHp: { name: 'Padding · Max HP', group: 'armor', max: 5, desc: '+15 max HP per tier', ryo: [60, 110, 170, 250, 350], mats: (t) => ({ leather: t + 2 }) },
  armorStam: { name: 'Fit · Stamina', group: 'armor', max: 4, desc: '+15 max stamina per tier', ryo: [60, 110, 170, 250], mats: (t) => ({ leather: t + 1 }) },
  armorDodge: { name: 'Lacing · Dodge Efficiency', group: 'armor', max: 4, desc: '-12% dodge stamina cost per tier', ryo: [60, 110, 170, 250], mats: (t) => ({ leather: t + 1 }) },
};

/* Collectible sets + lore entries shown in the Journal */
SV.COLLECTIBLE_SETS = {
  memory: { name: "FATHER'S MEMORIES", total: 4 },
  scroll: { name: 'ANCIENT SCROLLS', total: 3 },
  relic: { name: 'SHRINE RELICS', total: 3 },
  petal: { name: 'LOST PETALS', total: 5 },
};
SV.LORE = {
  mem_armor: { set: 'memory', title: 'The Empty Armor', text: 'Winter. Father polishes armor he never wears. "Why keep it?" you ask. "So I remember what I was," he says, "and never become it again."' },
  mem_post: { set: 'memory', title: 'The Training Post', text: 'You are seven. Your wooden sword cracks against the post. Father catches your wrist. "A blade is not for anger, Ren. Anger makes the hand slow."' },
  mem_shrine: { set: 'memory', title: 'The Crane Shrine', text: 'Father kneels before a shrine in the bamboo, head bowed far longer than prayer requires. When he stands, his eyes are wet. He tells you it was smoke.' },
  mem_pond: { set: 'memory', title: 'Koi at Dusk', text: '"There were twelve of us once," Father says, watching the koi. "Eleven still serve." He says nothing more, and you are too young to ask what they serve.' },
  scr_elder: { set: 'scroll', title: 'Kurohana Records, Vol. II', text: 'The village was founded by deserters of the northern wars. Its name, "black flower," honors the burned fields they left behind.' },
  scr_bamboo: { set: 'scroll', title: 'On the White Crane', text: '...an order of retainers serving no lord but the Crane Council. Their blades settle debts that courts cannot. Members cut their family names from the registers.' },
  scr_shrine: { set: 'scroll', title: 'The Shrine Keeper\'s Note', text: 'The deepest door answers to three words, set by the founder: the bird that rises, the wind that carries, the moon that swallows.' },
  rel_1: { set: 'relic', title: 'Fox Bell', text: 'A tarnished bell from a kitsune statue. It no longer rings, though it seems to want to.' },
  rel_2: { set: 'relic', title: 'Cracked Ema', text: 'A wooden prayer plaque: "Let my son never learn what I was."' },
  rel_3: { set: 'relic', title: 'Stone Feather', text: 'Carved feather, warm to the touch. Three such feathers circle the family crest.' },
  pet_1: { set: 'petal', title: 'Lost Petal', text: '' }, pet_2: { set: 'petal', title: 'Lost Petal', text: '' },
  pet_3: { set: 'petal', title: 'Lost Petal', text: '' }, pet_4: { set: 'petal', title: 'Lost Petal', text: '' },
  pet_5: { set: 'petal', title: 'Lost Petal', text: '' },
};

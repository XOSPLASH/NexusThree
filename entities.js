const unitDefs = {};
const biomeDefs = {
  "Boxing Arena": {
    radius: 2,
    duration: 4,
    cost: 4,
    symbol: "🥊",
    color: "#f87171", // Reddish
    desc: "A gritty combat zone where fighters excel. Increases damage by 1 for all Fighter units within the area.",
    shopLabel: "Fighter DMG",
    effectType: "stat_buff",
    stat: "dmg",
    amount: 1,
    filter: "Fighter"
  },
  "Watchtower": {
    radius: 2,
    duration: 5,
    cost: 6,
    symbol: "🗼",
    color: "#60a5fa", // Blueish
    desc: "A high vantage point for sharpshooters. Increases attack range by 1 for all Marksman units within the area.",
    shopLabel: "Range Boost",
    effectType: "stat_buff",
    stat: "range",
    amount: 1,
    filter: "Marksman"
  },
  "Sanctum": {
    radius: 2,
    duration: 5,
    cost: 6,
    symbol: "⛪",
    color: "#fbbf24", // Golden
    desc: "A holy sanctuary for healers. Support units in range gain +1 Max AP and get immediate +1 AP contact plus turn-start heal/AP.",
    shopLabel: "Support AP",
    effectType: "turn_start_support_buff",
    amount: 1
  },
  "Forge": {
    radius: 1,
    duration: 5,
    cost: 5,
    symbol: "⚒️",
    color: "#94a3b8", // Metallic Gray
    desc: "A heavy industrial zone that reinforces armor. Grants 1 turn of Guard (damage reduction) to all allied units within the area at the start of every turn.",
    shopLabel: "Team Guard",
    effectType: "turn_start_guard",
    amount: 1
    ,guardValue: 1
  }
};

const makeBase = (team, row, col) => ({
  kind: "base",
  team,
  row,
  col,
  hp: 20,
  maxHp: 20,
  symbol: team === "P" ? "🏰" : "⛩️",
});

const makeUnit = (team, type, row, col) => ({
  kind: "unit",
  team,
  type,
  row,
  col,
  hp: unitDefs[type].hp,
  maxHp: unitDefs[type].hp,
  range: unitDefs[type].range,
  dmg: unitDefs[type].dmg,
  move: unitDefs[type].move,
  symbol: unitDefs[type].symbol,
  ability: unitDefs[type].ability,
  rangePattern: unitDefs[type].rangePattern,
  movePattern: unitDefs[type].movePattern || "orthogonal",
  abilityCooldowns: {},
  cooldownMods: {},
  globalCooldownMod: 0,
  runes: [],
  exp: 0,
  level: 1,
  apMax: unitDefs[type].apMax || 2,
  ap: unitDefs[type].apMax || 2,
  stunnedTurns: 0,
  hexTurns: 0,
  burnTurns: 0,
  beastTurns: 0,
  guardTurns: 0,
  guardValue: unitDefs[type] && unitDefs[type].guardValue != null ? unitDefs[type].guardValue : 0,
  siegeTurns: 0,
  stuck: false,
  waterWalker: unitDefs[type] && !!unitDefs[type].waterWalker,
  inShadowRealm: false,
  shadowTurns: 0,
  isBeast: false,
  leveling: unitDefs[type].leveling || null,
});

const defaultLeveling = {
  xpToLevel: { 2: 6, 3: 12 },
  levels: {
    2: [{ label: "+1 Damage", stat: "dmg", amount: 1 }],
    3: [{ label: "+1 Max HP", stat: "maxHp", amount: 1, heal: 1 }],
  },
};

window.Entities = { unitDefs, biomeDefs, makeBase, makeUnit };
window.Entities.getLevelingProfile = function(type) {
  const def = unitDefs[type];
  if (!def) return defaultLeveling;
  return def.leveling || defaultLeveling;
};

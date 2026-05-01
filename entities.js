const unitDefs = {};

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
  apMax: 2,
  ap: 2,
  stunnedTurns: 0,
  hexTurns: 0,
  burnTurns: 0,
  beastTurns: 0,
  guardTurns: 0,
  siegeTurns: 0,
  stuck: false,
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

window.Entities = { unitDefs, makeBase, makeUnit };
window.Entities.getLevelingProfile = function(type) {
  return (unitDefs[type] && unitDefs[type].leveling) || defaultLeveling;
};

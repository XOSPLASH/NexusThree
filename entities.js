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
  runes: [],
  exp: 0,
  level: 1,
  apMax: 2,
  ap: 2,
  stunnedTurns: 0,
});

window.Entities = { unitDefs, makeBase, makeUnit };

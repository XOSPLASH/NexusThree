// Entities: unit definitions and factories
const unitDefs = {
  Warrior:   { hp: 8, range: 1, dmg: 3, move: 2, cost: 3, symbol: "⚔️", ability: "Tough melee", rangePattern: "orthogonal", movePattern: "orthogonal" },
  Archer:    { hp: 6, range: 3, dmg: 3, move: 1, cost: 4, symbol: "🏹", ability: "Long range", rangePattern: "straight", movePattern: "orthogonal" },
  Mage:      { hp: 6, range: 2, dmg: 2, move: 1, cost: 4, symbol: "🔮", ability: "Heal adjacent ally", rangePattern: "square", movePattern: "orthogonal" },
  Paladin:   { hp: 8, range: 1, dmg: 4, move: 2, cost: 5, symbol: "🛡️", ability: "Smite distant foe", rangePattern: "orthogonal", movePattern: "orthogonal" },
  Berserker: { hp: 7, range: 2, dmg: 3, move: 3, cost: 3, symbol: "🪓", ability: "Whirlwind attack", rangePattern: "orthogonal", movePattern: "orthogonal" },
  Builder:   { hp: 5, range: 2, dmg: 2, move: 2, cost: 2, symbol: "🛠️", ability: "Construct or clear terrain", rangePattern: "orthogonal", movePattern: "orthogonal" },
  Alchemist: { hp: 6, range: 3, dmg: 3, move: 1, cost: 4, symbol: "⚗️", ability: "Catalyze a 3x3 area", rangePattern: "thrower", movePattern: "square" },
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
  apMax: 2,
  ap: 2,
});

window.Entities = { unitDefs, makeBase, makeUnit };

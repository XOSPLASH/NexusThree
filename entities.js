// Entities: unit definitions and factories
const unitDefs = {
  Warrior:   { hp: 8, range: 1, dmg: 3, symbol: "⚔️", move: 2, ability: "Tough melee", rangePattern: "orthogonal", movePattern: "orthogonal", cost: 3 },
  Archer:    { hp: 6, range: 3, dmg: 3, symbol: "🏹", move: 1, ability: "Long range", rangePattern: "straight", movePattern: "orthogonal", cost: 4 },
  Mage:      { hp: 6, range: 2, dmg: 2, symbol: "🔮", move: 1, ability: "Heal adjacent ally", rangePattern: "square", movePattern: "orthogonal", cost: 4 },
  Paladin:   { hp: 8, range: 1, dmg: 4, symbol: "🛡️", move: 2, ability: "Smite distant foe", rangePattern: "orthogonal", movePattern: "orthogonal", cost: 5 },
  Berserker: { hp: 7, range: 2, dmg: 3, symbol: "🪓", move: 3, ability: "Whirlwind attack", rangePattern: "orthogonal", movePattern: "orthogonal", cost: 3 },
  Builder:   { hp: 5, range: 2, dmg: 2, symbol: "🛠️", move: 2, ability: "Construct or clear terrain", rangePattern: "orthogonal", movePattern: "orthogonal", cost: 2 },
  Alchemist: { hp: 6, range: 2, dmg: 3, symbol: "⚗️", move: 1, ability: "Catalyze a 3x3 area", rangePattern: "orthogonal", movePattern: "square", cost: 4 },
};

const makeBase = (team, row, col) => ({
  kind: "base",
  team,
  row,
  col,
  hp: 10,
  maxHp: 10,
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

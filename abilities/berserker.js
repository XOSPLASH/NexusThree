// Berserker abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Berserker = {
    hp: 70, range: 1, dmg: 30, move: 3, cost: 3,
    symbol: "\uD83E\uDE93", ability: "Melee Area Control",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Whirlwind": 4 },
    leveling: {
      xpToLevel: { 2: 6, 3: 13 },
      levels: {
        2: [
          { label: "+10 Damage", stat: "dmg", amount: 10 },
        ],
        3: [
          { label: "+10 Max HP", stat: "maxHp", amount: 10, heal: 10 },
          { label: "+1 Move", stat: "move", amount: 1 },
        ],
      },
    },
  };
  const makeWhirlwind = () => ({
    name: "Whirlwind",
    desc: "Hit all adjacent enemies.",
    range: 2,
    rangePattern: "square",
    damage: 30,
    requiresTarget: false,
    computeTargets(game, unit) { return game.getAdjacentEnemyTiles(unit); },
    perform(game, unit) {
      const adj = game.getAdjacentEnemyTiles(unit);
      if (adj.length) {
        for (const [rr, cc] of adj) {
          const t = game.occupants[rr][cc];
          if (t) game.applyDamage(t, 30, unit);
        }
        unit.ap = Math.max(0, unit.ap - 1);
        const baseCd = game.getAbilityCooldown(unit, "Whirlwind");
        unit.abilityCooldowns["Whirlwind"] = baseCd;
        game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Berserker`, ability: "Whirlwind" });
      }
    },
  });
  window.Abilities.Berserker = [makeWhirlwind()];
})();



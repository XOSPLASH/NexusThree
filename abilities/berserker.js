// Berserker abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Berserker = {
    hp: 7, range: 1, dmg: 3, move: 3, cost: 3,
    symbol: "🪓", ability: "Melee Area Control",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Whirlwind": 4 },
    leveling: {
      xpToLevel: { 2: 6, 3: 13 },
      levels: {
        2: [
          { label: "+1 Damage", stat: "dmg", amount: 1 },
        ],
        3: [
          { label: "+1 Max HP", stat: "maxHp", amount: 1, heal: 1 },
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
    damage: 4,
    requiresTarget: false,
    computeTargets(game, unit) { return game.getAdjacentEnemyTiles(unit); },
    perform(game, unit) {
      const adj = game.getAdjacentEnemyTiles(unit);
      if (adj.length) {
        for (const [rr, cc] of adj) {
          const t = game.occupants[rr][cc];
          if (t) game.applyDamage(t, 3, unit);
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

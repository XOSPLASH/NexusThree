// Berserker abilities
(function() {
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
        unit.abilityCooldowns["Whirlwind"] = (unit.abilityCooldowns["Whirlwind"] || 0) + 2;
        game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Berserker`, ability: "Whirlwind" });
      }
    },
  });
  window.Abilities.Berserker = [makeWhirlwind()];
})();

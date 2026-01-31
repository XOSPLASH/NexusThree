// Warrior abilities
(function() {
  const makeCharge = () => ({
    name: "Charge",
    desc: "Dash 2 tiles and strike an adjacent enemy.",
    range: 2,
    rangePattern: "straight",
    damage: 2,
    requiresTarget: true,
    computeTargets(game, unit) { return game.getChargeTargets(unit); },
    perform(game, unit, r, c) {
      game.moveUnit(unit, r, c);
      const adj = game.getAdjacentEnemyTiles(unit);
      if (adj.length) {
        const [rr, cc] = adj[0];
        const t = game.occupants[rr][cc];
        if (t) game.applyDamage(t, 2, unit);
      }
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Charge"] = (unit.abilityCooldowns["Charge"] || 0) + 2;
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Warrior`, ability: "Charge" });
    },
  });
  window.Abilities.Warrior = [makeCharge()];
})(); 

// Archer abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Archer = {
    hp: 6, range: 3, dmg: 3, move: 1, cost: 4,
    symbol: "🏹", ability: "Long range",
    rangePattern: "straight", movePattern: "orthogonal",
    cooldowns: { "Snipe": 2 }
  };
  const makeSnipe = () => ({
    name: "Snipe",
    desc: "Long shot ignoring walls.",
    range: 0,
    rangePattern: "straight",
    damage: 4,
    requiresTarget: true,
    computeTargets(game, unit) {
      const tiles = game.getPatternTiles(unit, unit.range + 1, "straight");
      const res = [];
      for (const [r, c] of tiles) {
        const occ = game.occupants[r][c];
        if (occ && occ.team !== unit.team) res.push([r, c]);
      }
      return res;
    },
    perform(game, unit, r, c) {
      const target = game.occupants[r][c];
      if (!target) return;
      game.applyDamage(target, 4, unit);
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = (Entities.unitDefs.Archer.cooldowns && Entities.unitDefs.Archer.cooldowns["Snipe"]) || 2;
      unit.abilityCooldowns["Snipe"] = baseCd;
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Archer`, ability: "Snipe", target: `${target.team === "P" ? "Player" : "AI"} ${target.kind === "unit" ? target.type : "Base"}` });
    },
  });
  window.Abilities.Archer = [makeSnipe()];
})();

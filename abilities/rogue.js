// Rogue abilities
(function() {
  const makeShadowstep = () => ({
    name: "Shadowstep",
    desc: "Teleport to a target empty tile within range 3.",
    range: 3,
    rangePattern: "square",
    damage: 0,
    requiresTarget: true,
    computeTargets(game, unit) {
      const res = [];
      for (let r = unit.row - 3; r <= unit.row + 3; r++) {
        for (let c = unit.col - 3; c <= unit.col + 3; c++) {
          if (!game.inBounds(r, c)) continue;
          if (Math.abs(r - unit.row) > 3 || Math.abs(c - unit.col) > 3) continue;
          if (game.terrain[r][c] === "wall" || game.terrain[r][c] === "water") continue;
          if (game.occupants[r][c]) continue;
          res.push([r, c]);
        }
      }
      return res;
    },
    perform(game, unit, r, c) {
      game.moveUnit(unit, r, c, { dash: true });
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Shadowstep"] = (unit.abilityCooldowns["Shadowstep"] || 0) + 2;
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Rogue`, ability: "Shadowstep" });
    },
  });
  window.Abilities.Rogue = [makeShadowstep()];
})();

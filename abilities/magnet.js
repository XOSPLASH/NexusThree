// Magnet abilities
(function() {
  const makePull = () => ({
    name: "Pull",
    desc: "Pull units in a 3x3 around target 1 tile towards centre.",
    range: 3,
    rangePattern: "select",
    requiresTarget: true,
    computeTargets(game, unit) {
      const res = [];
      const maxBox = Math.max(0, this.range || unit.range || 0);
      for (let dr = -maxBox; dr <= maxBox; dr++) {
        for (let dc = -maxBox; dc <= maxBox; dc++) {
          const r = unit.row + dr, c = unit.col + dc;
          if (!game.inBounds(r, c)) continue;
          res.push([r, c]);
        }
      }
      return res;
    },
    perform(game, unit, r, c) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (!game.inBounds(rr, cc)) continue;
          const occ = game.occupants[rr][cc];
          if (!occ || occ.kind !== "unit") continue;
          const stepR = rr + Math.sign(r - rr);
          const stepC = cc + Math.sign(c - cc);
          if (!game.inBounds(stepR, stepC)) continue;
          if (game.occupants[stepR][stepC] != null) continue;
          const terr = game.terrain[stepR][stepC];
          if (terr === "wall" || terr === "water" || terr === "fortwall") continue;
          game.moveUnit(occ, stepR, stepC, { dash: true });
        }
      }
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Pull"] = (unit.abilityCooldowns["Pull"] || 0) + 2;
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Magnet`, ability: "Pull" });
      game.renderEntities();
    },
  });
  window.Abilities.Magnet = [makePull()];
})(); 

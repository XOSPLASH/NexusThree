// Magnet abilities
(function() {
  const makePull = () => ({
    name: "Pull",
    desc: "Pull nearby units 1 tile toward the Magnet.",
    range: 3,
    rangePattern: "orthogonal",
    requiresTarget: false,
    perform(game, unit) {
      const tiles = game.getPatternTiles(unit, this.range, this.rangePattern);
      for (const [rr, cc] of tiles) {
        const occ = game.occupants[rr][cc];
        if (!occ || occ.kind !== "unit") continue;
        if (occ === unit) continue;
        const stepR = rr + Math.sign(unit.row - rr);
        const stepC = cc + Math.sign(unit.col - cc);
        if (!game.inBounds(stepR, stepC)) continue;
        if (game.occupants[stepR][stepC] != null) continue;
        const terr = game.terrain[stepR][stepC];
        if (terr === "wall" || terr === "water" || terr === "fortwall") continue;
        const cell = game.board.getCell(rr, cc);
        if (cell) {
          cell.classList.add("pull-anim");
          setTimeout(() => cell.classList.remove("pull-anim"), 600);
        }
        game.moveUnit(occ, stepR, stepC, { dash: true });
      }
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = (Entities.unitDefs.Magnet.cooldowns && Entities.unitDefs.Magnet.cooldowns["Pull"]) || 2;
      unit.abilityCooldowns["Pull"] = baseCd;
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Magnet`, ability: "Pull" });
      game.renderEntities();
    },
  });
  window.Abilities.Magnet = [makePull()];
})(); 

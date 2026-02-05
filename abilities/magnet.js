// Magnet abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Magnet = {
    hp: 8, range: 1, dmg: 4, move: 2, cost: 5,
    symbol: "🧲", ability: "Pull units toward self",
    rangePattern: "square", movePattern: "orthogonal",
    cooldowns: { "Pull": 2 }
  };
  const makePull = () => ({
    name: "Pull",
    desc: "Hook a target within orthogonal range and pull it 1 tile toward Magnet.",
    range: 3,
    rangePattern: "orthogonal",
    requiresTarget: true,
    computeTargets(game, unit) {
      const tiles = game.getPatternTiles(unit, this.range, this.rangePattern);
      const res = [];
      for (const [rr, cc] of tiles) {
        const occ = game.occupants[rr][cc];
        if (occ && occ.kind === "unit" && occ.team !== unit.team) {
          res.push([rr, cc]);
        }
      }
      return res;
    },
    perform(game, unit, r, c) {
      const occ = game.occupants[r][c];
      if (!occ || occ.kind !== "unit") return;
      const cell = game.board.getCell(r, c);
      if (cell) {
        cell.classList.add("pull-anim");
        setTimeout(() => cell.classList.remove("pull-anim"), 620);
      }
      const destR = unit.row + Math.sign(r - unit.row);
      const destC = unit.col + Math.sign(c - unit.col);
      if (game.inBounds(destR, destC)) {
        const terr = game.terrain[destR][destC];
        if (!(terr === "wall" || terr === "water" || terr === "fortwall") && game.occupants[destR][destC] == null) {
          const path = game.getMovePath(occ, destR, destC, 99);
          if (path && path.length) {
            game.animateMove(occ, path, { dash: true });
          } else {
            game.moveUnit(occ, destR, destC, { dash: true });
          }
        }
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

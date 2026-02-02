// Magnet abilities
(function() {
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
      const targets = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const ar = unit.row + dr, ac = unit.col + dc;
          if (!game.inBounds(ar, ac)) continue;
          const terr = game.terrain[ar][ac];
          if (terr === "wall" || terr === "water" || terr === "fortwall") continue;
          if (game.occupants[ar][ac] != null) continue;
          targets.push([ar, ac]);
        }
      }
      let best = null;
      for (const [tr, tc] of targets) {
        const path = game.getMovePath(occ, tr, tc, 99);
        if (path && (best == null || path.length < best.path.length)) {
          best = { r: tr, c: tc, path };
        }
      }
      if (best && best.path && best.path.length) {
        game.animateMove(occ, best.path, { dash: true });
      } else {
        const stepR = r + Math.sign(unit.row - r);
        const stepC = c + Math.sign(unit.col - c);
        if (game.inBounds(stepR, stepC)) {
          const terr = game.terrain[stepR][stepC];
          if (!(terr === "wall" || terr === "water" || terr === "fortwall") && game.occupants[stepR][stepC] == null) {
            game.moveUnit(occ, stepR, stepC, { dash: true });
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

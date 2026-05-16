// Magnet abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Magnet = {
    hp: 80, range: 1, dmg: 30, move: 2, cost: 5,
    class: "Disruptor",
    symbol: "\uD83E\uDDF2", ability: "Displacement",
    rangePattern: "square", movePattern: "orthogonal",
    cooldowns: { "Pull": 2 },
    leveling: {
      xpToLevel: { 2: 8, 3: 16 },
      levels: {
        2: [
          { label: "+10 Max HP", stat: "maxHp", amount: 10, heal: 10 },
        ],
        3: [
          { label: "+1 Range", stat: "range", amount: 1 },
        ],
      },
    },
  };
  const makePull = () => ({
    name: "Pull",
    desc: "Hook a target within orthogonal range, deal 20 damage, and pull it 1 tile toward Magnet.",
    range: 3,
    rangePattern: "orthogonal",
    damage: 20,
    note: "The target slides exactly 1 tile toward Magnet if the destination is open.",
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
      game.applyDamage(occ, 20, unit);
      if (!game.entities.includes(occ) || occ.hp <= 0) {
        unit.ap = Math.max(0, unit.ap - 1);
        unit.abilityCooldowns["Pull"] = game.getAbilityCooldown(unit, "Pull");
        if (game.playSfx) game.playSfx("ability");
        game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Magnet`, ability: "Pull", msg: "Hook impact" });
        game.renderEntities();
        return;
      }
      const cell = game.board.getCell(r, c);
      if (cell) {
        cell.classList.add("pull-anim");
        setTimeout(() => cell.classList.remove("pull-anim"), 620);
      }
      const destR = r + Math.sign(unit.row - r);
      const destC = c + Math.sign(unit.col - c);
      if (game.inBounds(destR, destC)) {
        const terr = game.terrain[destR][destC];
        if (game.isTerrainPassableForUnit(terr, occ) && game.occupants[destR][destC] == null) {
          game.moveUnit(occ, destR, destC, { dash: true });
        }
      }
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = game.getAbilityCooldown(unit, "Pull");
      unit.abilityCooldowns["Pull"] = baseCd;
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Magnet`, ability: "Pull" });
      game.renderEntities();
    },
  });
  window.Abilities.Magnet = [makePull()];
})(); 



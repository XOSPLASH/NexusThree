(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Hex = {
    hp: 5, range: 3, dmg: 2, move: 2, cost: 4,
    symbol: "🧤", ability: "Marks enemies; marked take +1 damage",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Hex": 3 }
  };
  const makeHex = () => ({
    name: "Hex",
    desc: "Mark an enemy within range; marked take +1 damage.",
    range: 3,
    rangePattern: "orthogonal",
    requiresTarget: true,
    computeTargets(game, unit) {
      const tiles = game.getPatternTiles(unit, this.range, this.rangePattern);
      const res = [];
      for (const [r, c] of tiles) {
        const occ = game.occupants[r][c];
        if (occ && occ.kind === "unit" && occ.team !== unit.team) {
          if (game.hasLineOfSight(unit.row, unit.col, r, c)) res.push([r, c]);
        }
      }
      return res;
    },
    perform(game, unit, r, c) {
      const target = game.occupants[r][c];
      if (!target || target.kind !== "unit" || target.team === unit.team) return;
      target.hexMarked = true;
      const cell = game.board.getCell(target.row, target.col);
      if (cell) {
        cell.classList.add("ability-anim");
        setTimeout(() => cell.classList.remove("ability-anim"), 500);
      }
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = (window.Entities.unitDefs.Hex.cooldowns && window.Entities.unitDefs.Hex.cooldowns["Hex"]) || 2;
      unit.abilityCooldowns["Hex"] = baseCd;
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Hex`, ability: "Hex" });
      game.renderEntities();
      game.updateUnitPanel(target);
    },
  });
  window.Abilities = window.Abilities || {};
  window.Abilities.Hex = [makeHex()];
})(); 

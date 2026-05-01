(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Hex = {
    hp: 5, range: 3, dmg: 2, move: 2, cost: 4,
    symbol: "🧤", ability: "Punish enemies",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Hex": 3 },
    leveling: {
      xpToLevel: { 2: 7, 3: 14 },
      levels: {
        2: [
          { label: "+1 Range", stat: "range", amount: 1 },
        ],
        3: [
          { label: "+1 Damage", stat: "dmg", amount: 1 },
          { label: "Hex cooldown -1", stat: "cooldown", ability: "Hex", amount: -1 },
        ],
      },
    },
  };
  const makeHex = () => ({
    name: "Hex",
    desc: "Mark an enemy within range for 2 turns; marked units take +1 damage.",
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
      target.hexTurns = Math.max(target.hexTurns || 0, 2);
      const cell = game.board.getCell(target.row, target.col);
      if (cell) {
        cell.classList.add("ability-anim");
        setTimeout(() => cell.classList.remove("ability-anim"), 500);
      }
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = game.getAbilityCooldown(unit, "Hex");
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

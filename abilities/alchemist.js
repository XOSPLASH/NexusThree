// Alchemist abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Alchemist = {
    hp: 60, range: 3, dmg: 20, move: 2, cost: 4,
    symbol: "\u2697\uFE0F", ability: "Catalyze a 3x3 area",
    rangePattern: "thrower", movePattern: "square",
    cooldowns: { "Catalyze": 5 }
  };
  const makeCatalyze = () => ({
    name: "Catalyze",
    desc: "Grant allied units in the target 3x3 area a temporary +1 AP Max buff for 2 turns.",
    range: 3,
    rangePattern: "select",
    damage: 30,
    requiresTarget: true,
    computeTargets(game, unit) {
      const res = [];
      const maxBox = Math.max(0, this.range || unit.range || 0);
      for (let dr = -maxBox; dr <= maxBox; dr++) {
        for (let dc = -maxBox; dc <= maxBox; dc++) {
          const rr = unit.row + dr, cc = unit.col + dc;
          if (!game.inBounds(rr, cc)) continue;
          res.push([rr, cc]);
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
          if (occ && occ.kind === "unit" && occ.team === unit.team) {
            occ.buffTurns = Math.max((occ.buffTurns || 0), 2);
            occ.tempApBonus = Math.max((occ.tempApBonus || 0), 1);
            occ.ap = Math.min(game.getEffectiveApMax(occ), (occ.ap || 0) + 1);
          }
          const cell = game.board.getCell(rr, cc);
          if (cell) {
            cell.classList.add("ability-anim");
            setTimeout(() => cell.classList.remove("ability-anim"), 500);
          }
        }
      }
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = game.getAbilityCooldown(unit, "Catalyze");
      unit.abilityCooldowns["Catalyze"] = baseCd;
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Alchemist`, ability: "Catalyze", msg: "Allies energized" });
      game.renderEntities();
      game.updateUnitPanel(unit);
    },
  });
  window.Abilities.Alchemist = [makeCatalyze()];
})();


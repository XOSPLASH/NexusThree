// Alchemist abilities
(function() {
  const makeCatalyze = () => ({
    name: "Catalyze",
    desc: "Select a 3x3 area to damage enemies (3x3 radius).",
    range: 3,
    rangePattern: "select",
    damage: 4,
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
          if (occ && occ.team !== unit.team) {
            game.applyDamage(occ, 3, unit);
          }
          const cell = game.board.getCell(rr, cc);
          if (cell) {
            cell.classList.add("ability-anim");
            setTimeout(() => cell.classList.remove("ability-anim"), 500);
          }
        }
      }
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = (Entities.unitDefs.Alchemist.cooldowns && Entities.unitDefs.Alchemist.cooldowns["Catalyze"]) || 2;
      unit.abilityCooldowns["Catalyze"] = baseCd;
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Alchemist`, ability: "Catalyze" });
    },
  });
  window.Abilities.Alchemist = [makeCatalyze()];
})();

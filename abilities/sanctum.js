(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Sanctum = {
    hp: 7, range: 2, dmg: 1, move: 0, cost: 6,
    symbol: "⛪", ability: "Sanctify",
    rangePattern: "square", movePattern: "none",
    apMax: 1,
    cooldowns: { Sanctify: 4 },
    isBuilding: true,
    leveling: null,
  };

  const makeSanctify = () => ({
    name: "Sanctify",
    desc: "Heal all allies in a 3x3 area within range for 2.",
    range: 3,
    rangePattern: "square",
    requiresTarget: true,
    area: "3x3",
    heal: 2,
    affectsAll: false,
    affectsAllies: true,
    computeTargets(game, unit) {
      return game.getPatternTiles(unit, this.range, "square");
    },
    perform(game, unit, r, c) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (!game.inBounds(rr, cc)) continue;
          const occ = game.occupants[rr][cc];
          if (!occ || occ.team !== unit.team || occ.kind !== "unit") continue;
          occ.hp = Math.min(occ.maxHp, occ.hp + this.heal);
          const cell = game.board.getCell(rr, cc);
          if (cell) {
            cell.classList.add("heal-anim");
            setTimeout(() => cell.classList.remove("heal-anim"), 640);
          }
        }
      }
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Sanctify"] = game.getAbilityCooldown(unit, "Sanctify");
      game.renderEntities();
      game.board.clearMarks();
      if (game.playSfx) game.playSfx("heal");
    },
  });

  window.Abilities = window.Abilities || {};
  window.Abilities.Sanctum = [makeSanctify()];
})();

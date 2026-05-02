(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Forge = {
    hp: 8, range: 2, dmg: 1, move: 0, cost: 5,
    symbol: "⚒️", ability: "Aegis Pulse",
    rangePattern: "square", movePattern: "none",
    apMax: 1,
    cooldowns: { "Aegis Pulse": 4 },
    isBuilding: true,
    leveling: null,
  };

  const makeAegisPulse = () => ({
    name: "Aegis Pulse",
    desc: "Grant 2 guard turns to allies in a 3x3 area within range.",
    range: 3,
    rangePattern: "square",
    requiresTarget: true,
    area: "3x3",
    duration: 2,
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
          occ.guardTurns = Math.max(occ.guardTurns || 0, this.duration);
          const cell = game.board.getCell(rr, cc);
          if (cell) {
            cell.classList.add("ability-anim");
            setTimeout(() => cell.classList.remove("ability-anim"), 520);
          }
        }
      }
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Aegis Pulse"] = game.getAbilityCooldown(unit, "Aegis Pulse");
      game.renderEntities();
      game.board.clearMarks();
      if (game.playSfx) game.playSfx("ability");
    },
  });

  window.Abilities = window.Abilities || {};
  window.Abilities.Forge = [makeAegisPulse()];
})();

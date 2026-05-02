(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Watchtower = {
    hp: 6, range: 3, dmg: 2, move: 0, cost: 6,
    symbol: "🗼", ability: "Barrage",
    rangePattern: "square", movePattern: "none",
    apMax: 1,
    cooldowns: { Barrage: 4 },
    isBuilding: true,
    leveling: null,
  };

  const makeBarrage = () => ({
    name: "Barrage",
    desc: "Hit all enemies in a 3x3 area within range. Damage: 2.",
    range: 3,
    rangePattern: "square",
    requiresTarget: true,
    area: "3x3",
    damage: 2,
    affectsAll: false,
    computeTargets(game, unit) {
      return game.getPatternTiles(unit, this.range, "square");
    },
    perform(game, unit, r, c) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (!game.inBounds(rr, cc)) continue;
          const occ = game.occupants[rr][cc];
          if (!occ || occ.team === unit.team) continue;
          game.applyDamage(occ, this.damage, unit);
        }
      }
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Barrage"] = game.getAbilityCooldown(unit, "Barrage");
      game.renderEntities();
      game.board.clearMarks();
      if (game.playSfx) game.playSfx("ability");
    },
  });

  window.Abilities = window.Abilities || {};
  window.Abilities.Watchtower = [makeBarrage()];
})();

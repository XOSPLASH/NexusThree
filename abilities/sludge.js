(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Sludge = {
    hp: 5, range: 2, dmg: 1, move: 2, cost: 5,
    symbol: "🫧", ability: "Creates a 3x3 trap that prevents escape",
    rangePattern: "select", movePattern: "orthogonal",
    cooldowns: { "Quagmire": 5 }
  };
  const makeQuagmire = () => ({
    name: "Quagmire",
    desc: "Create a 3x3 area where units cannot move out. Duration: 2 turns.",
    range: 3,
    rangePattern: "select",
    requiresTarget: true,
    duration: 2,
    computeTargets(game, unit) {
      const tiles = game.getPatternTiles(unit, this.range, "square");
      return tiles;
    },
    perform(game, unit, r, c) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (!game.inBounds(rr, cc)) continue;
          game.hazards[rr][cc] = { kind: "sludge", turns: this.duration };
        }
      }
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = (window.Entities.unitDefs.Sludge.cooldowns && window.Entities.unitDefs.Sludge.cooldowns["Quagmire"]) || 3;
      unit.abilityCooldowns["Quagmire"] = baseCd;
      game.renderEntities();
      game.board.clearMarks();
      if (game.playSfx) game.playSfx("ability");
    },
  });
  window.Abilities.Sludge = [makeQuagmire()];
})(); 

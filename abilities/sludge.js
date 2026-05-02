(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Sludge = {
    hp: 6, range: 2, dmg: 1, move: 2, cost: 5,
    symbol: "🫧", ability: "Prevent Entry",
    rangePattern: "select", movePattern: "orthogonal",
    cooldowns: { "Mire": 5 },
    leveling: {
      xpToLevel: { 2: 8, 3: 16 },
      levels: {
        2: [
          { label: "+1 Max HP", stat: "maxHp", amount: 1, heal: 1 },
        ],
        3: [
          { label: "+1 Move", stat: "move", amount: 1 },
          { label: "Mire cooldown -1", stat: "cooldown", ability: "Mire", amount: -1 },
        ],
      },
    },
  };
  const makeMire = () => ({
    name: "Mire",
    desc: "Create a 3x3 area where units cannot move out. Duration: 2 of Sludge's turns.",
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
          game.hazards[rr][cc] = { kind: "sludge", turns: this.duration, ownerTeam: unit.team };
        }
      }
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = game.getAbilityCooldown(unit, "Mire");
      unit.abilityCooldowns["Mire"] = baseCd;
      if (game.syncSludgeStatuses) game.syncSludgeStatuses();
      game.renderEntities();
      game.board.clearMarks();
      if (game.playSfx) game.playSfx("ability");
    },
  });
  window.Abilities.Sludge = [makeMire()];
})(); 

(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Geomancer = {
    hp: 70, range: 2, dmg: 20, move: 2, cost: 8,
    class: "Support",
    symbol: "\uD83E\uDEA8", ability: "Swap two 3x3 sections of the battlefield",
    role: "Terrain and position rewiring",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Reshape": 6 },
    leveling: {
      xpToLevel: { 2: 8, 3: 15 },
      levels: {
        2: [
          { label: "+10 Max HP", stat: "maxHp", amount: 10, heal: 10 },
        ],
        3: [
          { label: "Reshape cooldown -1", stat: "cooldown", ability: "Reshape", amount: -1 },
        ],
      },
    },
  };

  const makeReshape = () => ({
    name: "Reshape",
    desc: "Choose two non-overlapping 3x3 areas within range 4 and swap everything inside them.",
    range: 4,
    rangePattern: "select",
    requiresTarget: true,
    multiSelect: true,
    maxTargets: 2,
    note: "Centers must have a full 3x3 footprint.",
    computeTargets(game, unit) {
      const res = [];
      for (let dr = -this.range; dr <= this.range; dr++) {
        for (let dc = -this.range; dc <= this.range; dc++) {
          const r = unit.row + dr;
          const c = unit.col + dc;
          if (!game.inBounds(r, c)) continue;
          if (Math.max(Math.abs(dr), Math.abs(dc)) > this.range) continue;
          if (!game.getAreaTiles(r, c, 1).length) continue;
          res.push([r, c]);
        }
      }
      return res;
    },
    performSelected(game, unit, selected) {
      if (!selected || selected.length < 2) return;
      const [a, b] = selected;
      if (game.areasOverlap(a, b, 1)) {
        game.logEvent({ type: "status", msg: "Reshape failed: 3x3 areas cannot overlap." });
        return;
      }
      if (!game.swapBoardAreas(a, b, 1)) return;
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Reshape"] = game.getAbilityCooldown(unit, "Reshape");
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Geomancer`, ability: "Reshape", msg: "Swapped two 3x3 zones" });
      game.updateUnitPanel(unit);
    },
  });

  window.Abilities = window.Abilities || {};
  window.Abilities.Geomancer = [makeReshape()];
})();

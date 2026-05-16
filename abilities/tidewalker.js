// Tidewalker unit with Water Walker passive and Harpoon Volley ability
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Tidewalker = {
    hp: 60,
    range: 3,
    dmg: 20,
    move: 3,
    cost: 4,
    symbol: "\uD83E\uDE9D",
    ability: "Harpoon Volley: fire a piercing harpoon in a straight line. (Cooldown 3)",
    rangePattern: "straight",
    movePattern: "orthogonal",
    waterWalker: true,
    leveling: {
      xpToLevel: { 2: 6, 3: 13 },
      levels: {
        2: [ { label: "+1 Range", stat: "range", amount: 1 } ],
        3: [ { label: "+10 Damage", stat: "dmg", amount: 10 } ]
      }
    }
  };

  const makeHarpoon = () => ({
    name: "Harpoon Volley",
    desc: "Fire a piercing harpoon in a straight line up to 4 tiles. Pierces enemies until hitting a wall. Cooldown 3.",
    range: 4,
    rangePattern: "straight",
    damage: 30,
    piercing: true,
    piercingLabel: "Hits every enemy on the line",
    requiresTarget: true,
    computeTargets(game, unit) {
      return game.getSnipeTargets(unit);
    },
    perform(game, unit, r, c) {
      const dr = Math.sign(r - unit.row);
      const dc = Math.sign(c - unit.col);
      if (!((dr === 0 && dc !== 0) || (dc === 0 && dr !== 0))) return;
      let rr = unit.row + dr;
      let cc = unit.col + dc;
      while (game.inBounds(rr, cc)) {
        const terr = game.terrain[rr][cc];
        if (terr === "wall" || terr === "water" || terr === "fortwall") break;
        const occ = game.occupants[rr][cc];
        if (occ && occ.team !== unit.team) {
          game.applyDamage(occ, 30, unit);
        }
        if (rr === r && cc === c) break;
        rr += dr;
        cc += dc;
      }
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = game.getAbilityCooldown(unit, "Harpoon Volley");
      unit.abilityCooldowns["Harpoon Volley"] = baseCd;
      game.logEvent({ type: "ability", caster: `${unit.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${unit.type}`, ability: "Harpoon Volley", msg: "Piercing harpoon" });
    }
  });

  window.Abilities = window.Abilities || {};
  window.Abilities.Tidewalker = [ makeHarpoon() ];
})();



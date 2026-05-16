// Archer abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Archer = {
    hp: 50, range: 3, dmg: 20, move: 2, cost: 3,
    symbol: "\uD83C\uDFF9", ability: "Piercing marksman",
    rangePattern: "straight", movePattern: "orthogonal",
    cooldowns: { "Snipe": 4 },
    leveling: {
      xpToLevel: { 2: 6, 3: 13 },
      levels: {
        2: [
          { label: "+1 Range", stat: "range", amount: 1 },
        ],
        3: [
          { label: "+10 Damage", stat: "dmg", amount: 10 },
        ],
      },
    },
  };
  const makeSnipe = () => ({
    name: "Snipe",
    desc: "Choose any tile in a straight line up to 4. Shoot through all enemies in that line, stopping at walls. Cooldown 4.",
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
      const baseCd = game.getAbilityCooldown(unit, "Snipe");
      unit.abilityCooldowns["Snipe"] = baseCd;
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Archer`, ability: "Snipe", msg: "Piercing line shot" });
    },
  });
  window.Abilities.Archer = [makeSnipe()];
})();



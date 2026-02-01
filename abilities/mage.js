// Mage abilities
(function() {
  const makeFrostbolt = () => ({
    name: "Frostbolt",
    desc: "Deal 2 damage and drain all AP (stun) from target enemy.",
    range: 3,
    rangePattern: "square",
    damage: 2,
    requiresTarget: true,
    computeTargets(game, unit) {
      const res = [];
      const range = 3;
      for (let dr = -range; dr <= range; dr++) {
        for (let dc = -range; dc <= range; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r = unit.row + dr, c = unit.col + dc;
          if (!game.inBounds(r, c)) continue;
          const occ = game.occupants[r][c];
          if (occ && occ.kind === "unit" && occ.team !== unit.team) {
             res.push([r, c]);
          }
        }
      }
      return res;
    },
    perform(game, unit, r, c) {
      const target = game.occupants[r][c];
      if (target) {
        game.applyDamage(target, 2, unit);
        if (target.kind === "unit") {
           target.ap = 0; // Stun effect
           game.logEvent({ type: "status", msg: `${target.type} frozen by Frostbolt!` });
        }
        game.playSfx && game.playSfx("hit");
      }
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Frostbolt"] = (unit.abilityCooldowns["Frostbolt"] || 0) + 2;
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Mage`, ability: "Frostbolt", target: target ? target.type : "Unknown" });
    },
  });
  window.Abilities.Mage = [makeFrostbolt()];
})();

// Mage abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Mage = {
    hp: 50, range: 2, dmg: 20, move: 2, cost: 4,
    symbol: "\uD83D\uDD2E", ability: "Crowdcontrol Mage",
    rangePattern: "square", movePattern: "orthogonal",
    cooldowns: { "Frostbolt": 4 },
    leveling: {
      xpToLevel: { 2: 7, 3: 14 },
      levels: {
        2: [
          { label: "+10 Damage", stat: "dmg", amount: 10 },
        ],
        3: [
          { label: "+1 Range", stat: "range", amount: 1 },
        ],
      },
    },
  };
  const makeFrostbolt = () => ({
    name: "Frostbolt",
    desc: "Deal 20 damage and drain all AP (stun) from target enemy.",
    range: 3,
    rangePattern: "square",
    damage: 20,
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
        game.applyDamage(target, 20, unit);
        if (target.kind === "unit") {
           target.ap = 0;
           target.stunnedTurns = Math.max((target.stunnedTurns || 0), 2);
           game.logEvent({ type: "status", msg: `${target.type} frozen by Frostbolt!` });
           const cell = game.board.getCell(r, c);
           if (cell) {
             cell.classList.add("freeze-anim");
             setTimeout(() => cell.classList.remove("freeze-anim"), 700);
           }
           if (game.selected && game.selected.kind === "unit" && game.selected === target) {
             game.updateUnitPanel(target);
           }
        }
        game.playSfx && game.playSfx("hit");
      }
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = game.getAbilityCooldown(unit, "Frostbolt");
      unit.abilityCooldowns["Frostbolt"] = baseCd;
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Mage`, ability: "Frostbolt", target: target ? target.type : "Unknown" });
    },
  });
  window.Abilities.Mage = [makeFrostbolt()];
})();



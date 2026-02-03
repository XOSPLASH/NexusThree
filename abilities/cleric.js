// Cleric abilities
(function() {
  const makeMassHeal = () => ({
    name: "Mass Heal",
    desc: "Heal all adjacent allies for 2 HP.",
    range: 2,
    rangePattern: "square",
    heal: 2,
    requiresTarget: false,
    computeTargets(game, unit) { return []; }, // No target selection needed
    perform(game, unit) {
      let healed = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r = unit.row + dr, c = unit.col + dc;
          if (!game.inBounds(r, c)) continue;
          const occ = game.occupants[r][c];
          if (occ && occ.kind === "unit" && occ.team === unit.team) {
            occ.hp = Math.min(occ.maxHp, occ.hp + 2);
            healed++;
            const cell = game.board.getCell(r, c);
            if (cell) {
              cell.classList.add("heal-anim");
              setTimeout(() => cell.classList.remove("heal-anim"), 640);
            }
          }
        }
      }
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = (Entities.unitDefs.Cleric.cooldowns && Entities.unitDefs.Cleric.cooldowns["Mass Heal"]) || 2;
      unit.abilityCooldowns["Mass Heal"] = baseCd;
      game.playSfx && game.playSfx("heal");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Cleric`, ability: "Mass Heal", target: `${healed} allies` });
    },
  });
  window.Abilities.Cleric = [makeMassHeal()];
})();

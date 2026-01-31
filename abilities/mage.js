// Mage abilities
(function() {
  const makeHeal = () => ({
    name: "Heal",
    desc: "Heal all adjacent allies.",
    range: 1,
    rangePattern: "square",
    heal: 2,
    requiresTarget: false,
    computeTargets(game, unit) { return game.getHealTargets(unit); },
    perform(game, unit) {
      const deltas = [ [1,0], [-1,0], [0,1], [0,-1] ];
      for (const [dr, dc] of deltas) {
        const r = unit.row + dr, c = unit.col + dc;
        if (!game.inBounds(r, c)) continue;
        const ally = game.occupants[r][c];
        if (ally && ally.kind === "unit" && ally.team === unit.team) {
          ally.hp = Math.min(ally.maxHp, ally.hp + 2);
          const cell = game.board.getCell(r, c);
          if (cell) {
            cell.classList.add("heal-anim");
            setTimeout(() => cell.classList.remove("heal-anim"), 640);
          }
        }
      }
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Heal"] = (unit.abilityCooldowns["Heal"] || 0) + 2;
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Mage`, ability: "Heal" });
    },
  });
  window.Abilities.Mage = [makeHeal()];
})(); 

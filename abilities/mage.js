// Mage abilities
(function() {
  const makeHeal = () => ({
    name: "Heal",
    desc: "Heal adjacent ally.",
    range: 1,
    rangePattern: "orthogonal",
    heal: 2,
    requiresTarget: true,
    computeTargets(game, unit) { return game.getHealTargets(unit); },
    perform(game, unit, r, c) {
      const ally = game.occupants[r][c];
      if (!ally) return;
      ally.hp = Math.min(ally.maxHp, ally.hp + 2);
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Heal"] = (unit.abilityCooldowns["Heal"] || 0) + 2;
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Mage`, ability: "Heal", target: `${ally.team === "P" ? "Player" : "AI"} ${ally.type}` });
    },
  });
  window.Abilities.Mage = [makeHeal()];
})(); 

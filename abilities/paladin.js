// Paladin abilities
(function() {
  const makeSmite = () => ({
    name: "Smite",
    desc: "Strike an enemy within 2 tiles.",
    range: 2,
    rangePattern: "radius",
    damage: 4,
    requiresTarget: true,
    computeTargets(game, unit) { return game.getSmiteTargets(unit); },
    perform(game, unit, r, c) {
      const target = game.occupants[r][c];
      if (!target) return;
      game.applyDamage(target, 4, unit);
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = (Entities.unitDefs.Paladin.cooldowns && Entities.unitDefs.Paladin.cooldowns["Smite"]) || 2;
      unit.abilityCooldowns["Smite"] = baseCd;
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Paladin`, ability: "Smite", target: `${target.team === "P" ? "Player" : "AI"} ${target.kind === "unit" ? target.type : "Base"}` });
    },
  });
  window.Abilities.Paladin = [makeSmite()];
})();

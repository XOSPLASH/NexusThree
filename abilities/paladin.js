// Paladin abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Paladin = {
    hp: 8, range: 2, dmg: 4, move: 2, cost: 5,
    symbol: "🛡️", ability: "Smite distant foe",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Smite": 2 }
  };
  const makeSmite = () => ({
    name: "Smite",
    desc: "Strike an enemy",
    range: 3,
    rangePattern: "straight",
    damage: 5,
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

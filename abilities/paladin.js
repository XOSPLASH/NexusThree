// Paladin abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Paladin = {
    hp: 8, range: 1, dmg: 3, move: 2, cost: 5,
    symbol: "🛡️", ability: "Medieval Brawler",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Smite": 3 },
    leveling: {
      xpToLevel: { 2: 8, 3: 16 },
      levels: {
        2: [
          { label: "+1 Max HP", stat: "maxHp", amount: 1, heal: 1 },
        ],
        3: [
          { label: "+1 Damage", stat: "dmg", amount: 1 },
          { label: "+1 Move", stat: "move", amount: 1 },
        ],
      },
    },
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
      const baseCd = game.getAbilityCooldown(unit, "Smite");
      unit.abilityCooldowns["Smite"] = baseCd;
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Paladin`, ability: "Smite", target: `${target.team === "P" ? "Player" : "AI"} ${target.kind === "unit" ? target.type : "Base"}` });
    },
  });
  window.Abilities.Paladin = [makeSmite()];
})();

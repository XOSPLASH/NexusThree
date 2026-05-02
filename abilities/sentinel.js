(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Sentinel = {
    hp: 10, range: 1, dmg: 1, move: 1, cost: 5,
    symbol: "🪨", ability: "Anchor line defender",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Fortify": 3 },
    leveling: {
      xpToLevel: { 2: 7, 3: 15 },
      levels: {
        2: [
          { label: "+1 Damage", stat: "dmg", amount: 1 },
        ],
        3: [
          { label: "+2 Max HP", stat: "maxHp", amount: 2, heal: 2 },
        ],
      },
    },
  };
  window.Abilities = window.Abilities || {};
  window.Abilities.Sentinel = [{
    name: "Fortify",
    desc: "Heal 2 HP and brace for 2 turns. While braced, damage taken is reduced by 1.",
    heal: 2,
    duration: 2,
    note: "While braced, Sentinel takes 1 less damage.",
    requiresTarget: false,
    perform(game, unit) {
      unit.hp = Math.min(unit.maxHp, unit.hp + 2);
      unit.guardTurns = 2;
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Fortify"] = game.getAbilityCooldown(unit, "Fortify");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Sentinel`, ability: "Fortify" });
    },
  }];
})();

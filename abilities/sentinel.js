(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Sentinel = {
    hp: 100, range: 1, dmg: 10, move: 1, cost: 5,
    symbol: "\uD83E\uDEA8", ability: "Anchor line defender",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Fortify": 3 },
    leveling: {
      xpToLevel: { 2: 7, 3: 15 },
      levels: {
        2: [
          { label: "+10 Damage", stat: "dmg", amount: 10 },
        ],
        3: [
          { label: "+20 Max HP", stat: "maxHp", amount: 20, heal: 20 },
        ],
      },
    },
  };
  window.Abilities = window.Abilities || {};
  window.Abilities.Sentinel = [{
    name: "Fortify",
    desc: "Heal 20 HP and brace for 2 turns. While braced, damage taken is reduced by 10.",
    heal: 20,
    duration: 2,
    note: "While braced, Sentinel takes 10 less damage.",
    requiresTarget: false,
    perform(game, unit) {
      unit.hp = Math.min(unit.maxHp, unit.hp + 20);
      unit.guardTurns = 2;
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Fortify"] = game.getAbilityCooldown(unit, "Fortify");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Sentinel`, ability: "Fortify" });
    },
  }];
})();



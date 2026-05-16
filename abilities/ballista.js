(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Ballista = {
    hp: 50, range: 4, dmg: 30, move: 1, cost: 6,
    class: "Artillery",
    symbol: "\uD83C\uDFAF", ability: "Long range siege",
    rangePattern: "artillery", movePattern: "orthogonal",
    thrower: true,
    cooldowns: { "Set Up": 4 },
    leveling: {
      xpToLevel: { 2: 8, 3: 18 },
      levels: {
        2: [
          { label: "+1 Range", stat: "range", amount: 1 },
        ],
        3: [
          { label: "+10 Damage", stat: "dmg", amount: 10 },
        ],
      },
    },
  };
  window.Abilities = window.Abilities || {};
  window.Abilities.Ballista = [{
    name: "Set Up",
    desc: "Brace for 2 turns. Gain +2 Range, +10 Damage, and cannot move while deployed.",
    duration: 2,
    note: "+2 Range and +10 Damage while deployed. Movement is disabled.",
    requiresTarget: false,
    perform(game, unit) {
      if (unit.siegeTurns > 0) return;
      unit.siegeOriginalStats = {
        range: unit.range,
        dmg: unit.dmg,
        move: unit.move,
      };
      unit.range += 2;
      unit.dmg += 10;
      unit.move = 0;
      unit.siegeTurns = 2;
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Set Up"] = game.getAbilityCooldown(unit, "Set Up");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Ballista`, ability: "Set Up" });
    },
  }];
})();



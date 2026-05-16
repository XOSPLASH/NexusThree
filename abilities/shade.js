// Shade unit and Shadow Realm ability
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Shade = {
    hp: 50,
    range: 1,
    dmg: 30,
    move: 3,
    cost: 5,
    symbol: "\uD83D\uDC64",
    ability: "Shadow Step (Active): enter the Shadow Realm for 3 turns. Untargetable by opponents without Shadow presence.",
    rangePattern: "orthogonal",
    movePattern: "orthogonal",
    leveling: {
      xpToLevel: { 2: 6, 3: 12 },
      levels: {
        2: [ { label: "+10 Damage", stat: "dmg", amount: 10 } ],
        3: [ { label: "+1 Move", stat: "move", amount: 1 } ]
      }
    }
  };

  const makeShadowStep = () => ({
    name: "Shadow Step",
    desc: "Enter the Shadow Realm for 3 turns. While there, enemy teams without Shadow units cannot see you.",
    duration: 3,
    cooldown: 4,
    requiresTarget: false,
    perform(game, unit) {
      if (!unit || !game) return;
      if (!(Config.FEATURES && Config.FEATURES.shadowRealm)) return;
      unit.inShadowRealm = true;
      unit.shadowTurns = this.duration || 3;
      unit.ap = Math.max(0, (unit.ap || 0) - 1);
      const baseCd = game.getAbilityCooldown(unit, this.name);
      unit.abilityCooldowns[this.name] = baseCd;
      game.logEvent({ type: "ability", caster: `${unit.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${unit.type}`, ability: this.name, msg: `Entered Shadow Realm for ${unit.shadowTurns} turns` });
      game.renderEntities();
      game.updateUnitPanel(unit);
    }
  });

  window.Abilities = window.Abilities || {};
  window.Abilities.Shade = [ makeShadowStep() ];
})();



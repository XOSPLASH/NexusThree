(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Avenger = {
    hp: 40, range: 1, dmg: 20, move: 2, cost: 2,
    symbol: "\uD83E\uDD85", ability: "Gain buffs from ally deaths",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Vengeance": 4 },
    leveling: {
      xpToLevel: { 2: 6, 3: 12 },
      levels: {
        2: [
          { label: "+10 Damage", stat: "dmg", amount: 10 },
          { label: "+10 Max HP", stat: "maxHp", amount: 10, heal: 10 },
        ],
        3: [
          { label: "+1 Move", stat: "move", amount: 1 },
        ],
      },
    },
  };
  const makeVengeance = () => ({
    name: "Vengeance",
    desc: "Active: Gain +10 damage, +10 HP, and +10 max HP per ally death.",
    requiresTarget: false,
    perform(game, unit) {
      const deaths = (game.teamDeaths && game.teamDeaths[unit.team]) || 0;
      if (deaths <= 0) {
        unit.ap = Math.max(0, unit.ap - 1);
        return;
      }
      unit.dmg += deaths * 10;
      unit.maxHp += deaths * 10;
      unit.hp = Math.min(unit.maxHp, unit.hp + (deaths * 10));
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Vengeance"] = game.getAbilityCooldown(unit, "Vengeance");
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Avenger`, ability: "Vengeance", msg: `Buffed by +${deaths * 10}` });
      game.updateUnitPanel(unit);
    },
  });
  window.Abilities.Avenger = [makeVengeance()];
})(); 



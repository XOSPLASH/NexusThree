(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Avenger = {
    hp: 4, range: 1, dmg: 2, move: 2, cost: 2,
    symbol: "🦅", ability: "Gain buffs from ally deaths",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Vengeance": 4 },
    leveling: {
      xpToLevel: { 2: 6, 3: 12 },
      levels: {
        2: [
          { label: "+1 Damage", stat: "dmg", amount: 1 },
          { label: "+1 Max HP", stat: "maxHp", amount: 1, heal: 1 },
        ],
        3: [
          { label: "+1 Move", stat: "move", amount: 1 },
        ],
      },
    },
  };
  const makeVengeance = () => ({
    name: "Vengeance",
    desc: "Active: Gain +1 DMG, +1 HP, +1 Max HP per ally death.",
    requiresTarget: false,
    perform(game, unit) {
      const deaths = (game.teamDeaths && game.teamDeaths[unit.team]) || 0;
      if (deaths <= 0) {
        unit.ap = Math.max(0, unit.ap - 1);
        return;
      }
      unit.dmg += deaths;
      unit.maxHp += deaths;
      unit.hp = Math.min(unit.maxHp, unit.hp + deaths);
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Vengeance"] = game.getAbilityCooldown(unit, "Vengeance");
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Avenger`, ability: "Vengeance", msg: `Buffed by +${deaths}` });
      game.updateUnitPanel(unit);
    },
  });
  window.Abilities.Avenger = [makeVengeance()];
})(); 

(function() {
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
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Avenger`, ability: "Vengeance", msg: `Buffed by +${deaths}` });
      game.updateUnitPanel(unit);
    },
  });
  window.Abilities.Avenger = [makeVengeance()];
})(); 

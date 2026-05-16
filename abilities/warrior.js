// Warrior abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Warrior = {
    hp: 80, range: 1, dmg: 20, move: 2, cost: 3,
    class: "Fighter",
    role: "Frontline Bruiser",
    symbol: "\u2694\uFE0F", ability: "Piercing frontline strike",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Charge": 3 },
    leveling: {
      xpToLevel: { 2: 5, 3: 11 },
      levels: {
        2: [
          { label: "+10 Damage", stat: "dmg", amount: 10 },
        ],
        3: [
          { label: "+10 Max HP", stat: "maxHp", amount: 10, heal: 10 },
          { label: "+1 Move", stat: "move", amount: 1 },
        ],
      },
    },
  };
  const makeCharge = () => ({
    name: "Charge",
    desc: "Choose any tile in a straight line up to 3. Hit every enemy in that line, then dash to the last open tile before the block. Cooldown 3.",
    range: 3,
    rangePattern: "straight",
    damage: 20,
    piercing: true,
    piercingLabel: "Damages every enemy on the line",
    requiresTarget: true,
    computeTargets(game, unit) { return game.getChargeTargets(unit); },
    perform(game, unit, r, c) {
      const dr = Math.sign(r - unit.row);
      const dc = Math.sign(c - unit.col);
      if (!((dr === 0 && dc !== 0) || (dc === 0 && dr !== 0))) return;
      let lastOpen = null;
      let blockedByUnit = false;
      let rr = unit.row + dr;
      let cc = unit.col + dc;
      while (game.inBounds(rr, cc)) {
        const terr = game.terrain[rr][cc];
        if (terr === "wall" || terr === "water" || terr === "fortwall") break;
        const occ = game.occupants[rr][cc];
        if (occ && occ.team !== unit.team) {
          game.applyDamage(occ, 20, unit);
        }
        if (!occ && !blockedByUnit) lastOpen = [rr, cc];
        if (occ) blockedByUnit = true;
        if (rr === r && cc === c) break;
        rr += dr;
        cc += dc;
      }
      if (lastOpen) game.moveUnit(unit, lastOpen[0], lastOpen[1], { dash: true });
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = game.getAbilityCooldown(unit, "Charge");
      unit.abilityCooldowns["Charge"] = baseCd;
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Warrior`, ability: "Charge", msg: "Piercing line strike" });
    },
  });
  window.Abilities.Warrior = [makeCharge()];
})(); 



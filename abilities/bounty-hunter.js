(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs["Bounty Hunter"] = {
    hp: 70, range: 1, dmg: 30, move: 3, cost: 3,
    class: "Marksman",
    role: "High Risk Carry",
    symbol: "\uD83D\uDCB0", ability: "Simple ranged poke",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    bountyEnergyReward: 5,
    cooldowns: { "Pistol Shot": 2 },
    leveling: {
      xpToLevel: { 2: 6, 3: 12 },
      levels: {
        2: [{ label: "+10 Damage", stat: "dmg", amount: 10 }],
        3: [{ label: "+10 Max HP", stat: "maxHp", amount: 10, heal: 10 }],
      },
    },
  };

  const makePistolShot = () => ({
    name: "Pistol Shot",
    desc: "Deal 20 damage to an enemy within range 2.",
    range: 2,
    rangePattern: "square",
    damage: 20,
    requiresTarget: true,
    computeTargets(game, unit) {
      const tiles = game.getPatternTiles(unit, this.range, this.rangePattern);
      return tiles.filter(([r, c]) => {
        const target = game.occupants[r][c];
        return target && target.kind === "unit" && target.team !== unit.team && game.hasLineOfSight(unit.row, unit.col, r, c);
      });
    },
    perform(game, unit, r, c) {
      const target = game.occupants[r][c];
      if (!target || target.kind !== "unit" || target.team === unit.team) return;
      game.applyDamage(target, 20, unit);
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Pistol Shot"] = game.getAbilityCooldown(unit, "Pistol Shot");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Bounty Hunter`, ability: "Pistol Shot", target: target.type });
    },
  });

  window.Abilities = window.Abilities || {};
  window.Abilities["Bounty Hunter"] = [makePistolShot()];
})();

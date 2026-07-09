(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Plague = {
    hp: 60, range: 3, dmg: 10, move: 2, cost: 7,
    class: "Control",
    symbol: "\u2623",
    ability: "Spreads disease through clustered units",
    role: "Contagion pressure",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Infect": 4 },
    leveling: {
      xpToLevel: { 2: 7, 3: 14 },
      levels: {
        2: [
          { label: "+1 Range", stat: "range", amount: 1 },
        ],
        3: [
          { label: "Infect cooldown -1", stat: "cooldown", ability: "Infect", amount: -1 },
        ],
      },
    },
  };

  const makeInfect = () => ({
    name: "Infect",
    desc: "Afflict an enemy for 3 turns. Diseased units take 10 damage at the start of their turn and spread disease to adjacent units.",
    range: 3,
    rangePattern: "orthogonal",
    requiresTarget: true,
    duration: 3,
    damage: 10,
    computeTargets(game, unit) {
      const tiles = game.getPatternTiles(unit, this.range, this.rangePattern);
      const res = [];
      for (const [r, c] of tiles) {
        const occ = game.occupants[r][c];
        if (!occ || occ.kind !== "unit" || occ.team === unit.team) continue;
        if (game.hasLineOfSight(unit.row, unit.col, r, c)) res.push([r, c]);
      }
      return res;
    },
    perform(game, unit, r, c) {
      const target = game.occupants[r][c];
      if (!target || target.kind !== "unit" || target.team === unit.team) return;
      game.infectUnit(target, this.duration || 3, unit.team);
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Infect"] = game.getAbilityCooldown(unit, "Infect");
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Plague`, ability: "Infect", target: target.type });
      game.updateUnitPanel(target);
    },
  });

  window.Abilities = window.Abilities || {};
  window.Abilities.Plague = [makeInfect()];
})();

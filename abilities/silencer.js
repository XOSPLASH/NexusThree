(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Silencer = {
    hp: 50, range: 2, dmg: 10, move: 2, cost: 4,
    class: "Disruptor",
    role: "Attack Lockdown",
    symbol: "\uD83E\uDD2B", ability: "Stop enemy attacks",
    rangePattern: "square", movePattern: "orthogonal",
    cooldowns: { "Gag Order": 4 },
    leveling: {
      xpToLevel: { 2: 7, 3: 14 },
      levels: {
        2: [{ label: "+1 Range", stat: "range", amount: 1 }],
        3: [{ label: "Gag Order cooldown -1", stat: "cooldown", ability: "Gag Order", amount: -1 }],
      },
    },
  };

  const makeGagOrder = () => ({
    name: "Gag Order",
    desc: "Silence an enemy for 2 turns. Silenced units cannot attack, but can still move.",
    range: 3,
    rangePattern: "square",
    duration: 2,
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
      target.silencedTurns = Math.max(target.silencedTurns || 0, 2);
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Gag Order"] = game.getAbilityCooldown(unit, "Gag Order");
      game.logEvent({ type: "status", msg: `${target.type} cannot attack for 2 turns.` });
      game.renderEntities();
      game.updateUnitPanel(target);
    },
  });

  window.Abilities = window.Abilities || {};
  window.Abilities.Silencer = [makeGagOrder()];
})();


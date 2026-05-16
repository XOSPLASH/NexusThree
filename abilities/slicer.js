(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Slicer = {
    hp: 60, range: 1, dmg: 20, move: 3, cost: 4,
    class: "Breaker",
    role: "Tank Killer",
    symbol: "\uD83E\uDE9A", ability: "Current HP execution pressure",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Rend": 3 },
    leveling: {
      xpToLevel: { 2: 7, 3: 14 },
      levels: {
        2: [{ label: "+1 Move", stat: "move", amount: 1 }],
        3: [
          { label: "+10 Damage", stat: "dmg", amount: 10 },
          { label: "Rend cooldown -1", stat: "cooldown", ability: "Rend", amount: -1 },
        ],
      },
    },
  };

  const makeRend = () => ({
    name: "Rend",
    desc: "Slice an adjacent enemy for 40% of its max HP.",
    range: 1,
    rangePattern: "orthogonal",
    requiresTarget: true,
    note: "Damage scales with max enemy HP.",
    computeTargets(game, unit) {
      const tiles = game.getPatternTiles(unit, this.range, this.rangePattern);
      return tiles.filter(([r, c]) => {
        const target = game.occupants[r][c];
        return target && target.kind === "unit" && target.team !== unit.team;
      });
    },
    perform(game, unit, r, c) {
      const target = game.occupants[r][c];
      if (!target || target.kind !== "unit" || target.team === unit.team) return;
      const damage = Math.max(1, Math.ceil((target.maxHp || 0) * 0.4));
      game.applyDamage(target, damage, unit);
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Rend"] = game.getAbilityCooldown(unit, "Rend");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Slicer`, ability: "Rend", target: target.type });
    },
  });

  window.Abilities = window.Abilities || {};
  window.Abilities.Slicer = [makeRend()];
})();



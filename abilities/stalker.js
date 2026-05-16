(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Stalker = {
    hp: 40, range: 2, dmg: 30, move: 3, cost: 4,
    class: "Assassin",
    symbol: "\uD83E\uDD82", ability: "Forest ambush striker",
    role: "Forest Ambusher",
    rangePattern: "square", movePattern: "orthogonal",
    cooldowns: { "Ambush": 3 },
    leveling: {
      xpToLevel: { 2: 6, 3: 13 },
      levels: {
        2: [
          { label: "+1 Move", stat: "move", amount: 1 },
        ],
        3: [
          { label: "+10 Damage", stat: "dmg", amount: 10 },
          { label: "Ambush cooldown -1", stat: "cooldown", ability: "Ambush", amount: -1 },
        ],
      },
    },
  };

  const canLand = (game, unit, r, c) => {
    if (!game.inBounds(r, c)) return false;
    if (game.occupants[r][c]) return false;
    return game.isTerrainPassableForUnit(game.terrain[r][c], unit);
  };

  window.Abilities = window.Abilities || {};
  window.Abilities.Stalker = [{
    name: "Ambush",
    desc: "Strike an enemy at range 2. From forest, range becomes 3, damage becomes 50, and Stalker dashes adjacent if possible.",
    range: 2,
    rangePattern: "square",
    requiresTarget: true,
    computeTargets(game, unit) {
      const fromForest = game.terrain[unit.row] && game.terrain[unit.row][unit.col] === "forest";
      const range = fromForest ? 3 : 2;
      const targets = [];
      for (const ent of game.entities) {
        if (!ent || ent.team === unit.team) continue;
        if ((!!ent.inShadowRealm) !== (!!unit.inShadowRealm)) continue;
        const dist = Math.max(Math.abs(ent.row - unit.row), Math.abs(ent.col - unit.col));
        if (dist <= range && game.hasLineOfSight(unit.row, unit.col, ent.row, ent.col)) {
          targets.push([ent.row, ent.col]);
        }
      }
      return targets;
    },
    perform(game, unit, r, c) {
      const target = game.occupants[r][c] || game.entities.find(e => e.row === r && e.col === c && e.team !== unit.team);
      if (!target || target.team === unit.team) return;
      const fromForest = game.terrain[unit.row] && game.terrain[unit.row][unit.col] === "forest";
      game.applyDamage(target, fromForest ? 50 : 30, unit);
      if (fromForest) {
        const landings = [];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (canLand(game, unit, nr, nc)) landings.push([nr, nc]);
          }
        }
        landings.sort((a, b) => {
          const af = game.terrain[a[0]][a[1]] === "forest" ? -2 : 0;
          const bf = game.terrain[b[0]][b[1]] === "forest" ? -2 : 0;
          return (Math.abs(a[0] - unit.row) + Math.abs(a[1] - unit.col) + af) -
            (Math.abs(b[0] - unit.row) + Math.abs(b[1] - unit.col) + bf);
        });
        if (landings.length) game.moveUnit(unit, landings[0][0], landings[0][1], { dash: true });
      }
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Ambush"] = game.getAbilityCooldown(unit, "Ambush");
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Stalker`, ability: "Ambush", target: target.kind === "unit" ? target.type : "Base" });
      game.renderEntities();
      game.updateUnitPanel(unit);
    },
  }];
})();



(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Bulwark = {
    hp: 9, range: 1, dmg: 2, move: 2, cost: 4,
    class: "Tank",
    symbol: "🦬", ability: "Protect nearby allies",
    role: "Ally Protector",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Shield Line": 3 },
    leveling: {
      xpToLevel: { 2: 7, 3: 15 },
      levels: {
        2: [
          { label: "+1 Max HP", stat: "maxHp", amount: 1, heal: 1 },
        ],
        3: [
          { label: "+1 Damage", stat: "dmg", amount: 1 },
          { label: "Shield Line cooldown -1", stat: "cooldown", ability: "Shield Line", amount: -1 },
        ],
      },
    },
  };

  window.Abilities = window.Abilities || {};
  window.Abilities.Bulwark = [{
    name: "Shield Line",
    desc: "Brace Bulwark and adjacent allies for 2 turns. Braced units take 1 less damage.",
    duration: 2,
    requiresTarget: false,
    perform(game, unit) {
      const protectedUnits = [unit];
      for (const ent of game.entities) {
        if (!ent || ent.kind !== "unit" || ent.team !== unit.team || ent === unit) continue;
        if (Math.max(Math.abs(ent.row - unit.row), Math.abs(ent.col - unit.col)) <= 1) {
          protectedUnits.push(ent);
        }
      }
      for (const ally of protectedUnits) {
        ally.guardTurns = Math.max(ally.guardTurns || 0, this.duration || 2);
        ally.guardValue = Math.max(ally.guardValue || 0, 1);
        const cell = game.board.getCell(ally.row, ally.col);
        if (cell) {
          cell.classList.add("ability-anim");
          setTimeout(() => cell.classList.remove("ability-anim"), 500);
        }
      }
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Shield Line"] = game.getAbilityCooldown(unit, "Shield Line");
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Bulwark`, ability: "Shield Line", msg: `${protectedUnits.length} unit${protectedUnits.length === 1 ? "" : "s"} braced` });
      game.renderEntities();
      game.updateUnitPanel(unit);
    },
  }];
})();

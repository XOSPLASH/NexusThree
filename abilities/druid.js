(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  
  // Druid Definitions
  window.Entities.unitDefs.Druid = {
    hp: 4, range: 2, dmg: 2, move: 3, cost: 4,
    symbol: "🧙‍♂️", ability: "Shapeshift",
    rangePattern: "self", movePattern: "orthogonal",
    cooldowns: { "Shapeshift": 6 }
  };

  const makeShapeshift = () => ({
    name: "Shapeshift",
    desc: "Transform into a Beast for 2 turns (High HP, Dmg, Speed, Dmg Reduction).",
    range: 0,
    rangePattern: "self",
    requiresTarget: false,
    computeTargets(game, unit) {
      return [[unit.row, unit.col]];
    },
    perform(game, unit, r, c) {
      if (unit.isBeast) return;

      // Store original stats
      unit.originalStats = {
        hp: unit.hp,
        maxHp: unit.maxHp,
        dmg: unit.dmg,
        move: unit.move,
        symbol: unit.symbol,
        range: unit.range
      };

      // Apply Beast Stats
      // Base Druid: HP 4, Dmg 2, Move 3
      // Beast: High HP (8), High Dmg (4), Move +30% (4), 20% Dmg Red (handled in applyDamage)
      unit.isBeast = true;
      unit.beastTurns = 2;
      unit.maxHp = 10;
      unit.hp = Math.min(unit.maxHp, unit.hp + 6); // Heal on transform? Or just increase max? Usually shapeshift heals or adds temp HP. Let's add difference.
      unit.dmg = 5;
      unit.move = 4; // 3 * 1.3 ~= 3.9 -> 4
      unit.symbol = "🐻";
      unit.range = 1; // Melee range in beast form

      // Visuals
      const cell = game.board.getCell(unit.row, unit.col);
      if (cell) {
        cell.classList.add("transform-anim");
        setTimeout(() => cell.classList.remove("transform-anim"), 1500); // 1.5s sequence
      }
      if (game.createParticles) game.createParticles(unit.row, unit.col, "#d946ef");

      // SFX
      if (game.playSfx) game.playSfx("transform");
      
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Druid`, ability: "Shapeshift" });
      
      // Cooldown
      const baseCd = (Entities.unitDefs.Druid.cooldowns && Entities.unitDefs.Druid.cooldowns["Shapeshift"]) || 6;
      unit.abilityCooldowns["Shapeshift"] = baseCd;
      
      game.updateUnitPanel(unit);
      game.renderEntities();
    },
  });

  window.Abilities.Druid = [makeShapeshift()];
})();

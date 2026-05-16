(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  
  // Druid Definitions
  window.Entities.unitDefs.Druid = {
    hp: 40, range: 2, dmg: 20, move: 3, cost: 2,
    symbol: "\uD83E\uDDD9\u200D\u2642\uFE0F", ability: "Temporary Power",
    rangePattern: "self", movePattern: "orthogonal",
    cooldowns: { "Shapeshift": 6 },
    leveling: {
      xpToLevel: { 2: 8, 3: 16 },
      levels: {
        2: [
          { label: "+10 Max HP", stat: "maxHp", amount: 10, heal: 10 },
        ],
        3: [
          { label: "+10 Damage", stat: "dmg", amount: 10 },
          { label: "Shapeshift cooldown -1", stat: "cooldown", ability: "Shapeshift", amount: -1 },
        ],
      },
    },
  };

  const makeShapeshift = () => ({
    name: "Shapeshift",
    desc: "Transform into a Beast for 2 turns (High HP, Dmg, Speed, Dmg Reduction).",
    range: 0,
    rangePattern: "self",
    duration: 2,
    statPreview: [
      ["Max HP", "9"],
      ["Heal", "+5 current HP"],
      ["Damage", "4"],
      ["Move", "4"],
      ["Range", "1 melee"],
      ["Defense", "20% damage reduction"]
    ],
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
      // Base Druid: HP 40, Dmg 20, Move 3
      // Beast: Stronger stats, but still a temporary commitment.
      unit.isBeast = true;
      unit.beastTurns = 2;
      unit.maxHp = 90;
      unit.hp = Math.min(unit.maxHp, unit.hp + 50);
      unit.dmg = 40;
      unit.move = 4; // 3 * 1.3 ~= 3.9 -> 4
      unit.symbol = "\uD83D\uDC3B";
      unit.range = 1; // Melee range in beast form
      unit.ap = Math.max(0, unit.ap - 1);

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



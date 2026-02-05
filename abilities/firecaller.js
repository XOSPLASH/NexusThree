// Firecaller abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Firecaller = {
    hp: 6, range: 3, dmg: 2, move: 2, cost: 4,
    symbol: "🔥", ability: "Ignite 3x3 area (burn)",
    rangePattern: "square", movePattern: "orthogonal",
    cooldowns: { "Ignite": 3 }
  };
  const makeIgnite = () => ({
    name: "Ignite",
    desc: "Set a 3x3 area ablaze for 2 turns (2 dmg on start of turn).",
    range: 3,
    rangePattern: "select",
    requiresTarget: true,
    computeTargets(game, unit) {
      const res = [];
      const maxBox = Math.max(0, this.range || unit.range || 0);
      for (let dr = -maxBox; dr <= maxBox; dr++) {
        for (let dc = -maxBox; dc <= maxBox; dc++) {
          const r = unit.row + dr, c = unit.col + dc;
          if (!game.inBounds(r, c)) continue;
          res.push([r, c]);
        }
      }
      return res;
    },
    perform(game, unit, r, c) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (!game.inBounds(rr, cc)) continue;
          if (game.terrain[rr][cc] === "water") continue;
          game.hazards[rr][cc] = { kind: "fire", turns: 2 };
          const cell = game.board.getCell(rr, cc);
          if (cell) {
            cell.classList.add("ability-anim");
            setTimeout(() => cell.classList.remove("ability-anim"), 900);
          }
        }
      }
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = (Entities.unitDefs.Firecaller.cooldowns && Entities.unitDefs.Firecaller.cooldowns["Ignite"]) || 2;
      unit.abilityCooldowns["Ignite"] = baseCd;
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Firecaller`, ability: "Ignite" });
      game.renderEntities();
    },
  });
  window.Abilities.Firecaller = [makeIgnite()];
})(); 

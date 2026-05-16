// Builder abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Builder = {
    hp: 50, range: 1, dmg: 10, move: 2, cost: 2,
    symbol: "\uD83D\uDEE0\uFE0F", ability: "Terrain transformation",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Construct": 6 },
    leveling: {
      xpToLevel: { 2: 5, 3: 10 },
      levels: {
        2: [
          { label: "+1 Move", stat: "move", amount: 1 },
        ],
        3: [
          { label: "+10 Max HP", stat: "maxHp", amount: 10, heal: 10 },
          { label: "+1 Range", stat: "range", amount: 1 },
        ],
      },
    },
  };

  const makeConstruct = () => ({
    name: "Construct",
    desc: "Place up to 5 tiles (one per click): Wall/Bridge or Clear.",
    range: 3,
    previewSize: 1,
    rangePattern: "select",
    requiresTarget: true,
    computeTargets(game, unit) {
      const res = [];
      const maxBox = Math.max(0, this.range || unit.range || 0);
      for (let dr = -maxBox; dr <= maxBox; dr++) {
        for (let dc = -maxBox; dc <= maxBox; dc++) {
          const r = unit.row + dr, c = unit.col + dc;
          if (!game.inBounds(r, c)) continue;
          
          // Check if occupied by unit
          if (game.occupants[r][c]) continue;
          
          // Check if already has construction site (shouldn't exist anymore, but for safety)
          if (game.constructionSites[r][c]) continue;

          // Valid targets: Empty, Water, Wall, Fortwall, Forest (to clear)
          res.push([r, c]);
        }
      }
      return res;
    },
    perform(game, unit, r, c) {
      if (!game.inBounds(r, c)) return;
      // Initialize multi-place session on first click
      if (!game.abilityMode || !game.abilityMode.constructRemaining) {
        game.abilityMode = { unit, def: this, constructRemaining: 5 };
        unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Construct"] = game.getAbilityCooldown(unit, "Construct");
      }

      const terr = game.terrain[r][c];
      // Apply construction/clear rules
      if (terr === "water") {
        game.terrain[r][c] = "bridge";
      } else if (terr === "wall" || terr === "fortwall" || terr === "forest") {
        game.terrain[r][c] = null; // Clear
      } else if (terr === "bridge") {
        game.terrain[r][c] = "water"; // Clear bridge -> water
      } else if (!terr) {
        game.terrain[r][c] = "fortwall"; // Build wall
      } else {
        // Nothing to do
        return;
      }

      const cell = game.board.getCell(r, c);
      if (cell) {
        cell.classList.add("ability-anim");
        setTimeout(() => cell.classList.remove("ability-anim"), 500);
      }
      if (game.createParticles) game.createParticles(r, c, "#fbbf24");
      game.renderEntities();
      if (game.playSfx) game.playSfx("construct");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Builder`, ability: `Construct (1 tile)` });

      game.abilityMode.constructRemaining -= 1;
      if (game.abilityMode.constructRemaining <= 0) {
        game.abilityMode.done = true;
      } else {
        // Recompute valid targets and keep aiming
        const tiles = this.computeTargets(game, unit);
        game.abilityMode.targets = tiles;
        game.board.clearMarks();
        game.board.markSelected(unit.row, unit.col);
        game.board.markPositions(tiles, "ability-hl");
      }
    },
  });

  window.Abilities = window.Abilities || {};
  window.Abilities.Builder = [makeConstruct()];
})();



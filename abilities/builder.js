// Builder abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Builder = {
    hp: 5, range: 2, dmg: 2, move: 2, cost: 2,
    symbol: "🛠️", ability: "Construct, Repair",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Construct": 1, "Repair": 1 }
  };

  const makeConstruct = () => ({
    name: "Construct",
    desc: "Start construction (Wall/Bridge/Clear). Takes 2 turns.",
    range: 3,
    rangePattern: "select",
    requiresTarget: true,
    computeTargets(game, unit) {
      // Check queue limit (max 3 active sites per player)
      let mySites = 0;
      for (let r = 0; r < game.constructionSites.length; r++) {
        for (let c = 0; c < game.constructionSites[r].length; c++) {
          const site = game.constructionSites[r][c];
          if (site && site.builder && site.builder.team === unit.team) {
            mySites++;
          }
        }
      }
      if (mySites >= 3) return [];

      const res = [];
      const maxBox = Math.max(0, this.range || unit.range || 0);
      for (let dr = -maxBox; dr <= maxBox; dr++) {
        for (let dc = -maxBox; dc <= maxBox; dc++) {
          const r = unit.row + dr, c = unit.col + dc;
          if (!game.inBounds(r, c)) continue;
          
          // Check if occupied by unit
          if (game.occupants[r][c]) continue;
          
          // Check if already has construction site
          if (game.constructionSites[r][c]) continue;

          // Valid targets: Empty, Water, Wall, Fortwall (to clear)
          // We allow clearing/building anywhere within range 3
          res.push([r, c]);
        }
      }
      return res;
    },
    perform(game, unit, r, c) {
      // Determine type based on current terrain
      const terr = game.terrain[r][c];
      let type = "fortwall"; // Default build
      let action = "building";
      
      if (terr === "water") {
        type = "bridge";
      } else if (terr === "wall" || terr === "fortwall") {
        type = null; // Clear
        action = "clearing";
      } else if (terr === "bridge") {
        type = "water"; // Clear bridge -> water? Or just clear?
        // If bridge is cleared, it becomes water.
        // If it was originally water.
        // Let's assume clear bridge -> water.
        action = "clearing";
      }
      
      // Create Construction Site
      // Duration: 2 turns
      
      game.constructionSites[r][c] = {
        type: type,
        turns: 2,
        builder: unit
      };

      const cell = game.board.getCell(r, c);
      if (cell) {
        cell.classList.add("ability-anim");
        setTimeout(() => cell.classList.remove("ability-anim"), 500);
      }
      if (game.createParticles) game.createParticles(r, c, "#fbbf24");
      
      unit.ap = Math.max(0, unit.ap - 1);
      // Low cooldown to allow multiple placements (queueing)
      unit.abilityCooldowns["Construct"] = 1; 
      
      game.renderEntities();
      if (game.playSfx) game.playSfx("construct");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Builder`, ability: `Start ${action}` });
    },
  });

  const makeRepair = () => ({
    name: "Repair",
    desc: "Repair Base (Heal) or Reinforce Wall (50% cost/time).",
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
          
          const ent = game.entities.find(e => e.row === r && e.col === c && e.kind === "base" && e.team === unit.team);
          const terr = game.terrain[r][c];
          
          // Target: Damaged Base OR Wall (to reinforce)
          if (ent && ent.hp < ent.maxHp) {
             res.push([r, c]);
          } else if (terr === "wall") {
             // Can repair/reinforce wall
             res.push([r, c]);
          }
        }
      }
      return res;
    },
    perform(game, unit, r, c) {
       const ent = game.entities.find(e => e.row === r && e.col === c && e.kind === "base" && e.team === unit.team);
       const terr = game.terrain[r][c];
       
       if (ent) {
         // Heal Base
         ent.hp = Math.min(ent.maxHp, ent.hp + 5); // Heal 5 HP
         game.logEvent({ type: "heal", caster: "Builder", target: "Base", amount: 5 });
       } else if (terr === "wall") {
         // Reinforce Wall -> Fortwall
         // "Repair structures for 50% of their original build cost"
         // Build cost is time (2 turns). 50% = 1 turn.
         // We'll make this instant but 1 turn cooldown?
         // Or place a 1-turn site?
         // Let's make it instant for better feel, or 1 turn site.
         // "Repair" implies fixing. Reinforcing is close enough.
         game.terrain[r][c] = "fortwall";
         game.logEvent({ type: "status", msg: "Builder reinforced wall." });
       }

       const cell = game.board.getCell(r, c);
       if (cell) {
         cell.classList.add("heal-anim"); // Reuse heal anim
         setTimeout(() => cell.classList.remove("heal-anim"), 500);
       }
       
       unit.ap = Math.max(0, unit.ap - 1);
       unit.abilityCooldowns["Repair"] = 1;
       game.renderEntities();
       if (game.playSfx) game.playSfx("heal");
    }
  });

  window.Abilities = window.Abilities || {};
  window.Abilities.Builder = [makeConstruct(), makeRepair()];
})();

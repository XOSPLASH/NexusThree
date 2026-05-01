// Firecaller abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Firecaller = {
    hp: 5, range: 3, dmg: 2, move: 2, cost: 4,
    symbol: "🔥", ability: "Area control burst",
    rangePattern: "square", movePattern: "orthogonal",
    cooldowns: { "Ignite": 5 },
    leveling: {
      xpToLevel: { 2: 7, 3: 15 },
      levels: {
        2: [
          { label: "+1 Damage", stat: "dmg", amount: 1 },
        ],
        3: [
          { label: "+1 Range", stat: "range", amount: 1 },
          { label: "Ignite cooldown -1", stat: "cooldown", ability: "Ignite", amount: -1 },
        ],
      },
    },
  };
  const makeIgnite = () => ({
    name: "Ignite",
    desc: "Choose a tile and deal 1 fire damage to every unit in the 3x3 area. Leaves fire for 2 turns. Cooldown 5.",
    range: 3,
    rangePattern: "select",
    damage: 1,
    affectsAll: true,
    area: "3x3",
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
          const occ = game.occupants[rr][cc];
          if (occ) {
            game.applyDamage(occ, 1, occ.team === unit.team ? null : unit);
          }
          if (game.terrain[rr][cc] === "water") continue;
          game.hazards[rr][cc] = { kind: "fire", turns: 2, ownerTeam: unit.team };
          const cell = game.board.getCell(rr, cc);
          if (cell) {
            cell.classList.add("ability-anim");
            setTimeout(() => cell.classList.remove("ability-anim"), 900);
          }
        }
      }
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = game.getAbilityCooldown(unit, "Ignite");
      unit.abilityCooldowns["Ignite"] = baseCd;
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Firecaller`, ability: "Ignite", msg: "Area damage burst" });
      if (game.syncSludgeStatuses) game.syncSludgeStatuses();
      game.renderEntities();
    },
  });
  window.Abilities.Firecaller = [makeIgnite()];
})(); 

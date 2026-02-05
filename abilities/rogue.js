// Rogue abilities
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Rogue = {
    hp: 5, range: 1, dmg: 4, move: 2, cost: 3,
    symbol: "🗡️", ability: "Shadow Strike (Teleport + Dmg)",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    cooldowns: { "Shadow Strike": 2 }
  };
  const makeShadowStrike = () => ({
    name: "Shadow Strike",
    desc: "Teleport adjacent to an enemy within range 4 and deal 3 damage.",
    range: 4,
    rangePattern: "square",
    damage: 3,
    requiresTarget: true,
    computeTargets(game, unit) {
      const res = [];
      const range = 4;
      // Find all enemies in range
      const enemies = [];
      for (let r = unit.row - range; r <= unit.row + range; r++) {
        for (let c = unit.col - range; c <= unit.col + range; c++) {
          if (!game.inBounds(r, c)) continue;
          const occ = game.occupants[r][c];
          if (occ && occ.team !== unit.team) {
            enemies.push(occ);
          }
        }
      }
      
      // For each enemy, find adjacent empty spots that are within teleport range
      for (const enemy of enemies) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = enemy.row + dr, nc = enemy.col + dc;
            if (!game.inBounds(nr, nc)) continue;
            // Must be empty
            if (game.occupants[nr][nc] || game.terrain[nr][nc]) continue;
            // Must be within range 4 of unit
            const dist = Math.max(Math.abs(nr - unit.row), Math.abs(nc - unit.col));
            if (dist <= range) {
              // We store the target as the empty tile to jump to, but we need to know WHICH enemy to hit
              // We'll store it as [r, c, enemyId]
              // Actually the perform needs (r, c). 
              // Standard system expects [r,c]. We'll mark the empty tile as the target.
              // When performing, we'll look for adjacent enemies to hit.
              res.push([nr, nc]); 
            }
          }
        }
      }
      // Deduplicate
      const unique = [];
      const seen = new Set();
      for (const [r, c] of res) {
        const k = `${r},${c}`;
        if (!seen.has(k)) {
          seen.add(k);
          unique.push([r, c]);
        }
      }
      return unique;
    },
    perform(game, unit, r, c) {
      // Teleport
      game.moveUnit(unit, r, c, { dash: true });
      
      // Hit adjacent enemy (prioritize lowest HP)
      const enemies = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (!game.inBounds(nr, nc)) continue;
          const occ = game.occupants[nr][nc];
          if (occ && occ.team !== unit.team) {
            enemies.push(occ);
          }
        }
      }
      enemies.sort((a, b) => a.hp - b.hp);
      if (enemies.length > 0) {
        const target = enemies[0];
        game.applyDamage(target, 3, unit);
        game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Rogue`, ability: "Shadow Strike", target: target.type });
      }
      
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = (Entities.unitDefs.Rogue.cooldowns && Entities.unitDefs.Rogue.cooldowns["Shadow Strike"]) || 2;
      unit.abilityCooldowns["Shadow Strike"] = baseCd;
    },
  });
  window.Abilities.Rogue = [makeShadowStrike()];
})();

// Necromancer: place 3 skeletons on valid adjacent tiles
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Necromancer = {
    hp: 5, range: 2, dmg: 2, move: 2, cost: 4,
    symbol: "☠️", ability: "Unit Control",
    rangePattern: "square", movePattern: "orthogonal",
    cooldowns: { "Raise Dead": 6 },
    leveling: {
      xpToLevel: { 2: 8, 3: 16 },
      levels: {
        2: [
          { label: "+1 Range", stat: "range", amount: 1 },
        ],
        3: [
          { label: "+1 Max HP", stat: "maxHp", amount: 1, heal: 1 },
          { label: "Raise Dead cooldown -1", stat: "cooldown", ability: "Raise Dead", amount: -1 },
        ],
      },
    },
  };
  const makeRaiseDead = () => ({
    name: "Raise Dead",
    desc: "Place 3 skeletons on valid tiles adjacent to the Necromancer.",
    previewSize: 1,
    multiSelect: true,
    maxTargets: 3,
    requiresTarget: true,
    rangePattern: "select",
    computeTargets(game, unit) {
      const targets = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r = unit.row + dr;
          const c = unit.col + dc;
          if (!game.inBounds(r, c)) continue;
          const terr = game.terrain[r][c];
          if (terr === "wall" || terr === "water" || terr === "fortwall") continue;
          if (game.occupants[r][c] != null) continue;
          targets.push([r, c]);
        }
      }
      return targets;
    },
    performSelected(game, unit, tiles) {
      if (!Array.isArray(tiles) || tiles.length === 0) return;
      const uniqueTiles = [];
      const seen = new Set();
      for (const [r, c] of tiles) {
        const key = `${r},${c}`;
        if (seen.has(key)) continue;
        seen.add(key);
        uniqueTiles.push([r, c]);
      }
      if (uniqueTiles.length === 0) return;
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = game.getAbilityCooldown(unit, "Raise Dead");
      unit.abilityCooldowns["Raise Dead"] = baseCd;
      let placed = 0;
      for (const [r, c] of uniqueTiles.slice(0, 3)) {
        if (!game.inBounds(r, c)) continue;
        if (Math.max(Math.abs(r - unit.row), Math.abs(c - unit.col)) > 1) continue;
        if (game.occupants[r][c] != null) continue;
        const terr = game.terrain[r][c];
        if (terr === "wall" || terr === "water" || terr === "fortwall") continue;
        const skel = window.Entities.makeUnit(unit.team, "Skeleton", r, c);
        skel.summonedBy = "Necromancer";
        game.addEntity(skel);
        const cell = game.board.getCell(r, c);
        if (cell) {
          cell.classList.add("ability-anim");
          setTimeout(() => cell.classList.remove("ability-anim"), 500);
        }
        placed++;
      }
      if (placed > 0) {
        game.renderEntities();
        game.updateUnitPanel(unit);
      }
    },
    perform(game, unit, r, c) {
      if (!game.inBounds(r, c)) return;
      if (Math.max(Math.abs(r - unit.row), Math.abs(c - unit.col)) > 1) return;
      if (game.occupants[r][c] != null) return;
      const terr = game.terrain[r][c];
      if (terr === "wall" || terr === "water" || terr === "fortwall") return;
      const skel = window.Entities.makeUnit(unit.team, "Skeleton", r, c);
      skel.summonedBy = "Necromancer";
      game.addEntity(skel);
      game.renderEntities();
      const cell = game.board.getCell(r, c);
      if (cell) {
        cell.classList.add("ability-anim");
        setTimeout(() => cell.classList.remove("ability-anim"), 500);
      }
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = game.getAbilityCooldown(unit, "Raise Dead");
      unit.abilityCooldowns["Raise Dead"] = baseCd;
      if (game.playSfx) game.playSfx("ability");
      game.updateUnitPanel(unit);
    },
  });
  window.Abilities.Necromancer = [makeRaiseDead()];
})();

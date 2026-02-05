// Necromancer: Raise 3 skeletons in 3x3 area centered on caster
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Necromancer = {
    hp: 5, range: 2, dmg: 2, move: 2, cost: 5,
    symbol: "☠️", ability: "Raise 3 skeletons in a 3x3 area",
    rangePattern: "square", movePattern: "orthogonal",
    cooldowns: { "Raise Dead": 3 }
  };
  const makeRaiseDead = () => ({
    name: "Raise Dead",
    desc: "Spawn 3 skeletons in a 3x3 area around you. Place each individually.",
    requiresTarget: true,
    rangePattern: "select",
    computeTargets(game, unit) {
      const targets = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = unit.row + dr, c = unit.col + dc;
          if (!game.inBounds(r, c)) continue;
          const terr = game.terrain[r][c];
          if (terr === "wall" || terr === "water" || terr === "fortwall") continue;
          if (game.occupants[r][c] != null) continue;
          targets.push([r, c]);
        }
      }
      return targets;
    },
    perform(game, unit, r, c) {
      if (!game.inBounds(r, c)) return;
      if (game.occupants[r][c] != null) return;
      const skel = window.Entities.makeUnit(unit.team, "Skeleton", r, c);
      skel.summonedBy = "Necromancer";
      game.addEntity(skel);
      game.renderEntities();
      const cell = game.board.getCell(r, c);
      if (cell) {
        cell.classList.add("ability-anim");
        setTimeout(() => cell.classList.remove("ability-anim"), 500);
      }
      if (!game.abilityMode || !game.abilityMode.summonRemaining) {
        game.abilityMode = { unit, def: this, summonRemaining: 3, targets: [] };
        unit.ap = Math.max(0, unit.ap - 1);
        const baseCd = (Entities.unitDefs.Necromancer.cooldowns && Entities.unitDefs.Necromancer.cooldowns["Raise Dead"]) || 3;
        unit.abilityCooldowns["Raise Dead"] = baseCd;
      }
      game.abilityMode.summonRemaining -= 1;
      if (game.abilityMode.summonRemaining <= 0) {
        game.abilityMode.done = true;
      } else {
        const tiles = this.computeTargets(game, unit);
        game.abilityMode.targets = tiles;
        game.board.clearMarks();
        game.board.markSelected(unit.row, unit.col);
        game.board.markPositions(tiles, "ability-hl");
      }
      if (game.playSfx) game.playSfx("ability");
      game.updateUnitPanel(unit);
    },
  });
  window.Abilities.Necromancer = [makeRaiseDead()];
})(); 

// Builder abilities
(function() {
  const makeConstruct = () => ({
    name: "Construct",
    desc: "Build wall/bridge or clear wall (2x2 area)",
    range: 3,
    rangePattern: "select",
    requiresTarget: true,
    computeTargets(game, unit) {
      const res = [];
      const maxBox = Math.max(0, this.range || unit.range || 0);
      const bases = game.entities.filter(e => e.kind === "base");
      for (let dr = -maxBox; dr <= maxBox; dr++) {
        for (let dc = -maxBox; dc <= maxBox; dc++) {
          const r = unit.row + dr, c = unit.col + dc;
          if (!game.inBounds(r, c)) continue;
          
          // Constraint: Cannot use where units currently are (center of 2x2)
          // Actually, the ability affects a 2x2 area. We should check if ANY of the 2x2 tiles are occupied?
          // The prompt says "can't use his ability where units currently are".
          // If perform modifies 2x2, we should probably check the whole 2x2 or just the target center?
          // Let's assume the target center must be free of units for simplicity, or check the whole area?
          // "make sure the builder can't use his ability where units currently are" implies the result shouldn't overlap units.
          // Since it modifies terrain, units on top is tricky.
          // Let's check the 2x2 area.
          let occupied = false;
          let nearBase = false;
          
          for (let tr = 0; tr < 2; tr++) { // 2x2 from top-left (centered by perform fix)
             // Wait, perform uses dr from -0.5 to 0.5? No, previous fix was:
             // for (let dr = 0; dr < 2; dr++) -> for (let dr = 0; dr < 2; dr++)
             // Wait, I fixed it to match aimed area.
             // Let's look at the perform function below to be consistent.
             // It iterates 0..1 relative to r,c? Or centered?
             // My previous fix was "Fix Builder 2x2 perform to match aimed area".
             // Let's see the perform function in this file first.
          }
          
          // Let's check perform logic first.
          // In the file content I read:
          // perform(game, unit, r, c) {
          //   for (let dr = -1; dr <= 0; dr++) { ... }
          // }
          // This seems to be the "centered" fix (top-left is -1,-1 to 0,0 relative to click?)
          // No, 2x2. -1 to 0 is 2.
          
          for (let subR = -1; subR <= 0; subR++) {
            for (let subC = -1; subC <= 0; subC++) {
               const rr = r + subR, cc = c + subC;
               if (!game.inBounds(rr, cc)) continue;
               if (game.occupants[rr][cc]) occupied = true;
               
               // Check distance to base
               for (const base of bases) {
                 if (Math.abs(base.row - rr) <= 1 && Math.abs(base.col - cc) <= 1) nearBase = true;
               }
            }
          }
          
          if (!occupied && !nearBase) {
             res.push([r, c]);
          }
        }
      }
      return res;
    },
    perform(game, unit, r, c) {
      for (let dr = -1; dr <= 0; dr++) {
        for (let dc = -1; dc <= 0; dc++) {
          const rr = r + dr, cc = c + dc;
          if (!game.inBounds(rr, cc)) continue;
          const terr = game.terrain[rr][cc];
          if (terr == null) {
            game.terrain[rr][cc] = "fortwall";
          } else if (terr === "water") {
            game.terrain[rr][cc] = "bridge";
          } else if (terr === "wall" || terr === "fortwall") {
            game.terrain[rr][cc] = null;
          }
          const cell = game.board.getCell(rr, cc);
          if (cell) {
            cell.classList.add("ability-anim");
            setTimeout(() => cell.classList.remove("ability-anim"), 500);
          }
        }
      }
      unit.ap = Math.max(0, unit.ap - 1);
      const baseCd = (Entities.unitDefs.Builder.cooldowns && Entities.unitDefs.Builder.cooldowns["Construct"]) || 2;
      unit.abilityCooldowns["Construct"] = baseCd;
      game.renderEntities();
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Builder`, ability: "Construct" });
    },
  });
  window.Abilities.Builder = [makeConstruct()];
})();

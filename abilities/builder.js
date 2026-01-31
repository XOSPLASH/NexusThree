// Builder abilities
(function() {
  const makeConstruct = () => ({
    name: "Construct",
    desc: "Build wall/bridge or clear wall (2x2 area)",
    range: 4,
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
      for (let dr = 0; dr <= 1; dr++) {
        for (let dc = 0; dc <= 1; dc++) {
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
      unit.abilityCooldowns["Construct"] = (unit.abilityCooldowns["Construct"] || 0) + 2;
      game.renderEntities();
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Builder`, ability: "Construct" });
    },
  });
  window.Abilities.Builder = [makeConstruct()];
})();

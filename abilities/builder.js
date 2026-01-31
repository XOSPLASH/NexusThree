// Builder abilities
(function() {
  const makeConstruct = () => ({
    name: "Construct",
    desc: "Build wall/bridge or clear wall",
    range: 1,
    rangePattern: "orthogonal",
    requiresTarget: true,
    computeTargets(game, unit) {
      const res = [];
      for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const r = unit.row + dr, c = unit.col + dc;
        if (!game.inBounds(r, c)) continue;
        res.push([r, c]);
      }
      return res;
    },
    perform(game, unit, r, c) {
      const terr = game.terrain[r][c];
      if (terr == null) {
        game.terrain[r][c] = "fortwall";
      } else if (terr === "water") {
        game.terrain[r][c] = "bridge";
      } else if (terr === "wall" || terr === "fortwall") {
        game.terrain[r][c] = null;
      }
      unit.ap = Math.max(0, unit.ap - 1);
      unit.abilityCooldowns["Construct"] = (unit.abilityCooldowns["Construct"] || 0) + 2;
      game.renderEntities();
      const cell = game.board.getCell(r, c);
      if (cell) {
        cell.classList.add("ability-anim");
        setTimeout(() => cell.classList.remove("ability-anim"), 500);
      }
      if (game.playSfx) game.playSfx("ability");
      game.logEvent({ type: "ability", caster: `${unit.team === "P" ? "Player" : "AI"} Builder`, ability: "Construct" });
    },
  });
  window.Abilities.Builder = [makeConstruct()];
})();

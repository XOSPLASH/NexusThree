// Game: owns state, rendering of tokens, interactions, AI, and win condition
class Game {
  constructor(board) {
    this.board = board;
    this.turn = Config.TEAM.PLAYER;
    this.selected = null;
    this.abilityMode = null;
    this.buySelection = null;
    this.overlay = null;
    this.occupants = Array.from({ length: Config.ROWS }, () => Array(Config.COLS).fill(null));
    this.terrain = Array.from({ length: Config.ROWS }, () => Array(Config.COLS).fill(null));
    this.hazards = Array.from({ length: Config.ROWS }, () => Array(Config.COLS).fill(null));
    this.entities = [];
    this.log = [];
    this.energy = { [Config.TEAM.PLAYER]: Config.ENERGY_START_PLAYER, [Config.TEAM.AI]: Config.ENERGY_START_AI };
    this.energyGenerated = { [Config.TEAM.PLAYER]: Config.ENERGY_START_PLAYER, [Config.TEAM.AI]: Config.ENERGY_START_AI };
    this.energyGain = { [Config.TEAM.PLAYER]: Config.ENERGY_START_GAIN, [Config.TEAM.AI]: Config.ENERGY_START_GAIN };
    this.purchasedUnits = { [Config.TEAM.PLAYER]: new Set(), [Config.TEAM.AI]: new Set() };
    this.init();
  }

  init() {
    const [pPos, aPos] = this.pickMirroredBasePositions();
    this.addEntity(Entities.makeBase(Config.TEAM.PLAYER, pPos[0], pPos[1]));
    this.addEntity(Entities.makeBase(Config.TEAM.AI, aPos[0], aPos[1]));

    this.generateTerrain();

    this.renderEntities();
    this.attachEvents();
    this.updateHUD();
    this.updateUnitPanel(null);
    this.renderLog();
    this.ensureOverlay();
    this.renderBuyControls();
  }

  addEntity(ent) {
    this.entities.push(ent);
    this.occupants[ent.row][ent.col] = ent;
  }

  renderEntities() {
    this.board.forEachCell(cell => {
      cell.innerHTML = "";
      cell.style.borderColor = "";
      cell.classList.remove("terrain-water","terrain-wall","terrain-bridge","terrain-fortwall","hazard-fire");
    });
    // Terrain tokens
    for (let r = 0; r < Config.ROWS; r++) {
      for (let c = 0; c < Config.COLS; c++) {
        const t = this.terrain[r][c];
        if (!t) continue;
        const cell = this.board.getCell(r, c);
        if (!cell) continue;
        if (t === "water") cell.classList.add("terrain-water");
        else if (t === "wall") cell.classList.add("terrain-wall");
        else if (t === "fortwall") cell.classList.add("terrain-fortwall");
        else if (t === "bridge") cell.classList.add("terrain-bridge");
        if (t === "wall" || t === "bridge" || t === "fortwall") {
          const terrainIcon = document.createElement("span");
          terrainIcon.className = "terrain-icon";
          terrainIcon.textContent = t === "wall" ? "🧱" : (t === "bridge" ? "🌉" : "🪨");
          cell.appendChild(terrainIcon);
        }
      }
    }
    // Hazards overlay (e.g., fire)
    for (let r = 0; r < Config.ROWS; r++) {
      for (let c = 0; c < Config.COLS; c++) {
        const h = this.hazards[r][c];
        if (!h) continue;
        const cell = this.board.getCell(r, c);
        if (!cell) continue;
        if (h.kind === "fire") cell.classList.add("hazard-fire");
      }
    }
    // Units and bases
    for (const ent of this.entities) {
      const cell = this.board.getCell(ent.row, ent.col);
      if (!cell) continue;
      const span = document.createElement("span");
      span.className = "token";
      span.textContent = ent.symbol;
      cell.appendChild(span);
    }
  }

  attachEvents() {
    const gridEl = this.board.mountEl;
    gridEl.addEventListener("click", async (e) => {
      const target = e.target.closest(".cell");
      if (!target) return;
      const r = Number(target.dataset.row);
      const c = Number(target.dataset.col);
      await this.onCellClicked(r, c);
    });
    document.body.addEventListener("click", (e) => {
      if (e.target.closest(".btn")) this.playSfx && this.playSfx("click");
    }, true);
    gridEl.addEventListener("mousemove", (e) => {
      const target = e.target.closest(".cell");
      if (!target) return;
      if (!(this.abilityMode && this.abilityMode.def && (this.abilityMode.def.rangePattern || "").toLowerCase() === "select")) return;
      const r = Number(target.dataset.row);
      const c = Number(target.dataset.col);
      this.board.clearMarks();
      const u = this.abilityMode.unit;
      this.board.markSelected(u.row, u.col);
      const maxTargets = (this.abilityMode && this.abilityMode.targets) || [];
      if (maxTargets.length) this.board.markPositions(maxTargets, "ability-range-max");
      const area = [];
      const size = (this.abilityMode.def.name === "Construct") ? 2 : 3;
      const half = Math.floor(size / 2);
      for (let dr = -half; dr <= (size - half - 1); dr++) {
        for (let dc = -half; dc <= (size - half - 1); dc++) {
          const rr = r + dr, cc = c + dc;
          if (!this.inBounds(rr, cc)) continue;
          area.push([rr, cc]);
        }
      }
      this.board.markPositions(area, "ability-hl");
    });
    document.body.addEventListener("click", (e) => {
      if (!e.target.closest(".cell") &&
          !e.target.closest(".turnbar") &&
          !e.target.closest(".side") &&
          !e.target.closest(".btn") &&
          !e.target.closest(".app-header")) {
        this.deselect();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.deselect();
    });
    const endBtn = document.getElementById("end-turn");
    if (endBtn) endBtn.addEventListener("click", () => this.endPlayerTurn());
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {}
  }

  updateHUD() {
    const turnEl = document.getElementById("turn-indicator");
    if (turnEl) {
      const p = this.energy[Config.TEAM.PLAYER];
      const a = this.energy[Config.TEAM.AI];
      turnEl.textContent = `Turn: ${this.turn === Config.TEAM.PLAYER ? "Player" : "AI"}`;
      const pEl = document.getElementById("energy-player");
      const aEl = document.getElementById("energy-ai");
      if (pEl) pEl.textContent = `Player: ${p}`;
      if (aEl) aEl.textContent = `AI: ${a}`;
    }
  }

  updateUnitPanel(ent) {
    const iconEl = document.getElementById("unit-icon");
    const nameEl = document.getElementById("unit-name");
    const descEl = document.getElementById("unit-desc");
    const statsEl = document.getElementById("stats-list");
    let abilEl = document.getElementById("abilities-list");
    const unitPanel = document.getElementById("unit-panel");
    const abilitiesPanel = document.getElementById("abilities-panel");
    let btnRow = document.getElementById("ability-buttons-row");
    if (!btnRow) {
      btnRow = document.createElement("div");
      btnRow.id = "ability-buttons-row";
      if (unitPanel) unitPanel.appendChild(btnRow);
    }
    let viewAbBtn = document.getElementById("view-abilities-btn");
    if (!viewAbBtn) {
      viewAbBtn = document.createElement("button");
      viewAbBtn.id = "view-abilities-btn";
      viewAbBtn.className = "btn btn-secondary";
      viewAbBtn.textContent = "View Abilities";
      btnRow.appendChild(viewAbBtn);
    }
    let abilBtn = document.getElementById("ability-btn");
    if (!abilBtn) {
      abilBtn = document.createElement("button");
      abilBtn.id = "ability-btn";
      abilBtn.className = "btn btn-primary";
    }
    if (btnRow && abilBtn.parentElement !== btnRow) btnRow.appendChild(abilBtn);
    if (!iconEl || !nameEl || !descEl || !statsEl || !abilEl) return;
    statsEl.innerHTML = "";
    abilEl.innerHTML = "";
    abilBtn.style.display = "none";
    viewAbBtn.style.display = "none";
    if (unitPanel) {
      const existingRunes = unitPanel.querySelectorAll(".rune-panel");
      existingRunes.forEach(el => el.remove());
    }

    if (!ent) {
      iconEl.textContent = "—";
      nameEl.textContent = "None selected";
      descEl.textContent = "Select a tile or unit to view details.";
      return;
    }
    if (ent.kind === "tile") {
      iconEl.textContent = "□";
      nameEl.textContent = `Empty Tile`;
      descEl.textContent = `Coordinates: (${ent.row}, ${ent.col})`;
        const terrName = ent.terrain === "wall" ? "Wall"
          : ent.terrain === "water" ? "Water"
          : ent.terrain === "fortwall" ? "Fortified Wall"
          : ent.terrain === "bridge" ? "Bridge"
          : "Plain";
        const hz = this.hazards[ent.row][ent.col];
        const hazardName = hz && hz.kind === "fire" ? `Fire (${hz.turns} turn(s))` : "None";
        const stats = [
          ["Terrain", terrName],
          ["Hazard", hazardName],
        ];
      for (const [k, v] of stats) {
        const li = document.createElement("li"); li.textContent = `${k}: ${v}`; statsEl.appendChild(li);
      }
      const ab = document.createElement("li"); ab.textContent = "No active abilities"; abilEl.appendChild(ab);
      return;
    }
    if (ent.kind === "base") {
      iconEl.textContent = ent.symbol;
      nameEl.textContent = `${ent.team === Config.TEAM.PLAYER ? "Player" : "AI"} Base`;
      descEl.textContent = "Your base. If its HP reaches 0, you lose.";
      const stats = [
        ["HP", `${ent.hp}/${ent.maxHp}`],
        ["Defense", "0"],
      ];
      for (const [k, v] of stats) {
        const li = document.createElement("li"); li.textContent = `${k}: ${v}`; statsEl.appendChild(li);
      }
      const ab = document.createElement("li"); ab.textContent = "No active abilities"; abilEl.appendChild(ab);
      return;
    }
    const def = Entities.unitDefs[ent.type];
    iconEl.textContent = ent.symbol;
    nameEl.textContent = `${ent.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${ent.type}`;
    descEl.textContent = def.ability;
    if (ent.kind === "unit") {
      viewAbBtn.style.display = "inline-block";
      viewAbBtn.onclick = () => {
        let overlay = document.getElementById("abilities-overlay");
        if (!overlay) {
          overlay = document.createElement("div");
          overlay.id = "abilities-overlay";
          overlay.className = "overlay";
          document.body.appendChild(overlay);
        }
        overlay.innerHTML = "";
        const panel = document.createElement("div");
        panel.className = "panel";
        const title = document.createElement("div");
        title.className = "panel-title";
        title.textContent = "Abilities";
        const list = document.createElement("ul");
        list.className = "list";
        list.innerHTML = abilEl.innerHTML;
        const closeBtn = document.createElement("button");
        closeBtn.className = "btn btn-secondary";
        closeBtn.textContent = "Close";
        closeBtn.onclick = () => { overlay.classList.add("hidden"); };
        panel.appendChild(title);
        panel.appendChild(list);
        panel.appendChild(closeBtn);
        overlay.appendChild(panel);
        overlay.classList.remove("hidden");
      };
      const runePanel = document.createElement("div");
      runePanel.className = "rune-panel";
      const runeTitle = document.createElement("div");
      runeTitle.className = "unit-name";
      runeTitle.textContent = "Runes";
      runePanel.appendChild(runeTitle);
      const slots = document.createElement("div");
      slots.className = "rune-slots";
      for (let i = 0; i < 3; i++) {
        const slot = document.createElement("div");
        const rune = ent.runes[i];
        if (rune) {
          slot.className = "rune-slot filled";
          slot.textContent = rune.name[0];
          slot.title = `${rune.name}: ${rune.desc}`;
        } else {
          if (ent.team === Config.TEAM.PLAYER) {
            slot.className = "rune-slot empty";
            slot.textContent = "+";
            slot.onclick = () => this.openRuneShop(ent);
          } else {
            slot.className = "rune-slot locked";
            slot.textContent = "";
          }
        }
        slots.appendChild(slot);
      }
      runePanel.appendChild(slots);
      if (unitPanel) {
        const subTitle = unitPanel.querySelector(".panel-subtitle");
        if (subTitle) unitPanel.insertBefore(runePanel, subTitle);
        else unitPanel.appendChild(runePanel);
      }
    }
    const stats = [
      ["HP", `${ent.hp}/${ent.maxHp}`],
      ["Damage", `${ent.dmg}`],
      ["Range", `${ent.range}`],
      ["Move", `${ent.move}`],
      ["Movement", `${((ent.movePattern || "orthogonal").charAt(0).toUpperCase() + (ent.movePattern || "orthogonal").slice(1))}`],
      ["Range Pattern", `${((ent.rangePattern || "square").charAt(0).toUpperCase() + (ent.rangePattern || "square").slice(1))}`],
      ["AP", ent.kind === "unit" ? `${ent.ap}/${ent.apMax}` : "—"],
      ["Defense", "0"],
    ];
    for (const [k, v] of stats) {
      const li = document.createElement("li");
      if (k === "AP" && ent.kind === "unit") {
        const pips = Array.from({ length: ent.apMax }, (_, i) => `<span class="ap-pip${i < ent.ap ? '' : ' used'}"></span>`).join('');
        li.innerHTML = `AP: ${v} <span class="ap-pips">${pips}</span>`;
      } else {
        li.textContent = `${k}: ${v}`;
      }
      statsEl.appendChild(li);
    }
    const abilities = (window.Abilities && window.Abilities[ent.type]) || [];
    if (abilities.length === 0) {
      const sub = document.createElement("div");
      sub.className = "ability-subpanel";
      const p = document.createElement("div"); p.textContent = "No active abilities";
      sub.appendChild(p);
      abilEl.appendChild(sub);
    } else {
      for (const a of abilities) {
        const li = document.createElement("li");
        const title = document.createElement("div");
        title.className = "unit-name";
        title.textContent = a.name;
        const desc = document.createElement("div");
        desc.className = "unit-desc";
        desc.textContent = a.desc;
        const inner = document.createElement("ul");
        inner.className = "list";
        const cd = (ent.abilityCooldowns && ent.abilityCooldowns[a.name]) || 0;
        const baseCd = ((Entities.unitDefs[ent.type] && Entities.unitDefs[ent.type].cooldowns) ? (Entities.unitDefs[ent.type].cooldowns[a.name] || 0) : 0);
        const rng = (a.name === "Catalyze" || a.name === "Construct") ? 1 : ((typeof a.range === "number" && a.range > 0) ? a.range : ent.range);
        const pattern = (a.rangePattern || "radius");
        if (typeof a.damage === "number" && a.damage > 0) {
          const liD = document.createElement("li"); liD.textContent = `Damage: ${a.damage}`;
          inner.appendChild(liD);
        }
        if (typeof a.heal === "number" && a.heal > 0) {
          const liH = document.createElement("li"); liH.textContent = `Heal: ${a.heal}`;
          inner.appendChild(liH);
        }
        if (a.name === "Whirlwind") {
          const liA = document.createElement("li"); liA.textContent = `Area: Adjacent enemies`;
          inner.appendChild(liA);
        }
        const cap = pattern.charAt(0).toUpperCase() + pattern.slice(1);
        const liR = document.createElement("li"); liR.textContent = `Ability Range: ${rng}`;
        const liP = document.createElement("li"); liP.textContent = `Ability Range Pattern: ${cap}`;
        if (a.name === "Construct") {
          const liA = document.createElement("li"); liA.textContent = `Area: 2x2`;
          inner.appendChild(liA);
        }
        if (a.name === "Catalyze") {
          const liA2 = document.createElement("li"); liA2.textContent = `Area: 3x3`;
          inner.appendChild(liA2);
        }
        if (a.name === "Vengeance" && ent.type === "Avenger") {
          const bonus = Math.min(5, (this.teamDeaths && this.teamDeaths[ent.team]) || 0);
          const liV = document.createElement("li"); liV.textContent = `Bonus Damage: +${bonus} (from ally deaths)`;
          inner.appendChild(liV);
        }
        const liC = document.createElement("li"); liC.textContent = `Cooldown: ${cd} (base ${baseCd})`;
        inner.appendChild(liR); inner.appendChild(liP); inner.appendChild(liC);
        li.appendChild(title);
        li.appendChild(desc);
        li.appendChild(inner);
        abilEl.appendChild(li);
      }

      if (ent.kind === "unit") {
        const statusPanel = document.createElement("div");
        statusPanel.className = "ability-subpanel";
        const statusTitle = document.createElement("div");
        statusTitle.className = "unit-name";
        statusTitle.textContent = "Status Effects";
        const statusList = document.createElement("ul");
        statusList.className = "list";
        let any = false;
        if ((ent.stunnedTurns || 0) > 0) {
          const liS = document.createElement("li"); liS.textContent = `Stunned: ${ent.stunnedTurns} turn(s) remaining`;
          statusList.appendChild(liS); any = true;
        }
        if ((ent.burnTurns || 0) > 0) {
          const liB = document.createElement("li"); liB.textContent = `Burn: ${ent.burnTurns} turn(s) remaining`;
          statusList.appendChild(liB); any = true;
        }
        if (!any) {
          const liN = document.createElement("li"); liN.textContent = "None";
          statusList.appendChild(liN);
        }
        statusPanel.appendChild(statusTitle);
        statusPanel.appendChild(statusList);
        abilEl.appendChild(statusPanel);
      }

      

      if (ent.team === Config.TEAM.PLAYER) {
        const def = abilities[0];
        const cd = (ent.abilityCooldowns && ent.abilityCooldowns[def.name]) || 0;
        const isAiming = !!(this.abilityMode && this.abilityMode.unit === ent && this.abilityMode.def && this.abilityMode.def.name === def.name);
        abilBtn.style.display = "inline-block";
        const isPreview = !this.entities.includes(ent);
        abilBtn.disabled = isPreview || cd > 0 || ent.ap < 1;
        abilBtn.className = isAiming ? "btn btn-danger" : "btn btn-primary";
        abilBtn.textContent = isAiming ? "Cancel Ability" : "Use Ability";
        abilBtn.onclick = () => {
          if (isPreview) return;
          if (isAiming) {
            this.abilityMode = null;
            this.board.clearMarks();
            this.updateUnitPanel(ent);
            return;
          }
          if (((ent.abilityCooldowns && ent.abilityCooldowns[def.name]) || 0) > 0) return;
          if (ent.ap < 1) return;
          this.abilityMode = { unit: ent, def };
          this.showAbilityHints(ent, def);
        };
        if (isAiming) {
          abilBtn.textContent = "Cancel Ability";
          abilBtn.className = "btn btn-danger";
          abilBtn.disabled = false;
          abilBtn.onclick = () => {
            this.abilityMode = null;
            this.board.clearMarks();
            this.updateUnitPanel(ent);
          };
        } else {
          abilBtn.textContent = cd > 0 ? "Ability Cooling Down" : "Use Ability";
          abilBtn.className = "btn btn-primary";
          abilBtn.disabled = cd > 0 || ent.ap < 1;
          abilBtn.onclick = () => {
            if (((ent.abilityCooldowns && ent.abilityCooldowns[def.name]) || 0) > 0) return;
            if (ent.ap < 1) return;
            this.abilityMode = { unit: ent, def };
            if (def.requiresTarget) {
              this.showAbilityHints(ent, def);
            } else {
              def.perform(this, ent);
              this.abilityMode = null;
              this.renderEntities();
              this.board.clearMarks();
              this.updateHUD();
              this.updateUnitPanel(ent);
              if (ent.ap > 0) this.showActionHints(ent);
              this.checkWin();
            }
            // Reflect button state change immediately
            this.updateUnitPanel(ent);
          };
        }
      }
    }
  }

  openRuneShop(unit) {
    let shop = document.getElementById("rune-shop");
    if (!shop) {
      shop = document.createElement("div");
      shop.id = "rune-shop";
      shop.className = "overlay";
      document.body.appendChild(shop);
    }
    shop.innerHTML = "";
    const panel = document.createElement("div");
    panel.className = "panel shop-panel";
    
    const title = document.createElement("div");
    title.className = "panel-title";
    title.textContent = "Rune Shop";
    panel.appendChild(title);

    const list = document.createElement("div");
    list.className = "rune-list";
    
    window.RuneDefs.forEach(def => {
      const item = document.createElement("div");
      item.className = "rune-item";
      item.innerHTML = `
        <div class="rune-info">
          <div class="rune-name">${def.name}</div>
          <div class="rune-desc">${def.desc}</div>
        </div>
        <button class="btn btn-sm">Buy (${def.cost} E)</button>
      `;
    const btn = item.querySelector("button");
    const hasRune = unit.runes.some(r => r.id === def.id);
    if (this.energy[Config.TEAM.PLAYER] < def.cost || hasRune || unit.runes.length >= 3) {
      btn.disabled = true;
      btn.textContent = hasRune ? "Owned" : `Cost ${def.cost} E`;
    }
      btn.onclick = () => {
        this.buyRune(unit, def.id);
        shop.classList.add("hidden");
      };
      list.appendChild(item);
    });
    
    const close = document.createElement("button");
    close.className = "btn btn-secondary";
    close.textContent = "Cancel";
    close.style.marginTop = "10px";
    close.onclick = () => shop.classList.add("hidden");
    
    panel.appendChild(list);
    panel.appendChild(close);
    shop.appendChild(panel);
    shop.classList.remove("hidden");
  }

  inBounds(r, c) { return r >= 0 && c >= 0 && r < Config.ROWS && c < Config.COLS; }

  distanceByPattern(unit, dr, dc) {
    const a = Math.abs(dr), b = Math.abs(dc);
    const pattern = (unit.rangePattern || "square").toLowerCase();
    if (pattern === "orthogonal") {
      const aligned = ((a === 0 && b > 0) || (b === 0 && a > 0) || (a === b && a > 0));
      return aligned ? Math.max(a, b) : Infinity;
    }
    if (pattern === "manhattan") return Math.max(a, b);
    if (pattern === "circle" || pattern === "euclidean") return Math.sqrt(dr * dr + dc * dc);
    if (pattern === "straight" || pattern === "thrower") return (a === 0 || b === 0) ? Math.max(a, b) : Infinity;
    return Math.max(a, b);
  }

  getPatternTiles(unit, range, pattern) {
    const res = [];
    const p = (pattern || "radius").toLowerCase();
    if (p === "straight") {
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dr, dc] of dirs) {
        for (let s = 1; s <= range; s++) {
          const r = unit.row + dr * s, c = unit.col + dc * s;
          if (!this.inBounds(r, c)) break;
          res.push([r, c]);
        }
      }
      return res;
    }
    if (p === "orthogonal") {
      const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      for (const [dr, dc] of dirs) {
        for (let s = 1; s <= range; s++) {
          const r = unit.row + dr * s, c = unit.col + dc * s;
          if (!this.inBounds(r, c)) break;
          res.push([r, c]);
        }
      }
      return res;
    }
    for (let dr = -range; dr <= range; dr++) {
      for (let dc = -range; dc <= range; dc++) {
        const r = unit.row + dr, c = unit.col + dc;
        if (!this.inBounds(r, c)) continue;
        if (dr === 0 && dc === 0) continue;
        const dist = Math.max(Math.abs(dr), Math.abs(dc));
        if (dist <= range) res.push([r, c]);
      }
    }
    return res;
  }

  showActionHints(unit) {
    this.board.clearMarks();
    this.board.markSelected(unit.row, unit.col);
    const selCell = this.board.getCell(unit.row, unit.col);
    if (selCell) selCell.classList.add(unit.team === Config.TEAM.PLAYER ? "selected-player" : "selected-enemy");

    const isPlayerUnit = unit.team === Config.TEAM.PLAYER;
    const attackRange = this.getAttackRangeTiles(unit);
    const attacks = this.getAttackTargets(unit);
    this.board.markPositions(attackRange, "attack-range-hl");
    this.board.markPositions(attacks, "attack-hl");
    if (isPlayerUnit) {
      const moves = this.getMoveHintTiles(unit);
      const heals = this.getHealTargets(unit);
      this.board.markPositions(moves, "move-hl");
      this.board.markPositions(heals, "heal-hl");
    }
  }

  getMoveTargets(unit) {
    if (unit.ap < 1) return [];
    const maxSteps = Math.min((unit && unit.move) || 1, Config.MAX_MOVE_PER_ACTION || 3);
    return this.getReachableTiles(unit, maxSteps);
  }

  getMoveHintTiles(unit) {
    const maxSteps = Math.min((unit && unit.move) || 1, Config.MAX_MOVE_PER_ACTION || 3);
    return this.getReachableTiles(unit, maxSteps);
  }

  getReachableTiles(unit, maxSteps) {
    const q = [[unit.row, unit.col, 0]];
    const seen = new Set([`${unit.row},${unit.col}`]);
    const res = [];
    while (q.length) {
      const [r, c, d] = q.shift();
      if (d >= maxSteps) continue;
      const pattern = (unit.movePattern || "orthogonal").toLowerCase();
      const deltas = (pattern === "square" || pattern === "orthogonal")
        ? [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
        : [[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dr, dc] of deltas) {
        const nr = r + dr, nc = c + dc;
        const key = `${nr},${nc}`;
        if (!this.inBounds(nr, nc)) continue;
        if (seen.has(key)) continue;
        const terr = this.terrain[nr][nc];
        if (terr === "wall" || terr === "water" || terr === "fortwall") continue;
        if (this.occupants[nr][nc] != null) continue;
        seen.add(key);
        res.push([nr, nc]);
        q.push([nr, nc, d + 1]);
      }
    }
    return res;
  }

  getAttackTargets(unit) {
    if (unit.ap < 1) return [];
    const res = [];
    for (const ent of this.entities) {
      if (ent.team === unit.team) continue;
      const dist = this.distanceByPattern(unit, ent.row - unit.row, ent.col - unit.col);
      if (dist <= unit.range) res.push([ent.row, ent.col]);
    }
    const isThrower = ((unit.rangePattern || "").toLowerCase() === "thrower");
    if (isThrower) return res;
    return res.filter(([tr, tc]) => this.hasLineOfSight(unit.row, unit.col, tr, tc));
  }

  hasLineOfSight(sr, sc, tr, tc) {
    const cells = this.traceLineSupercover(sr, sc, tr, tc);
    for (const [r, c] of cells) {
      if (this.terrain[r][c] === "wall" || this.terrain[r][c] === "fortwall") return false;
    }
    return true;
  }

  traceLineSupercover(sr, sc, tr, tc) {
    const seen = new Set();
    const steps = Math.max(Math.abs(tr - sr), Math.abs(tc - sc)) * 2 + 1;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const y = sr + (tr - sr) * t;
      const x = sc + (tc - sc) * t;
      const r1 = Math.round(y), c1 = Math.round(x);
      const r2 = Math.floor(y), c2 = Math.floor(x);
      const r3 = Math.ceil(y), c3 = Math.ceil(x);
      [[r1, c1], [r2, c2], [r3, c3]].forEach(([r, c]) => {
        if (!this.inBounds(r, c)) return;
        if (r === tr && c === tc) return;
        seen.add(`${r},${c}`);
      });
    }
    return Array.from(seen).map(s => s.split(",").map(Number));
  }

  getAttackRangeTiles(unit) {
    const res = [];
    for (let dr = -unit.range; dr <= unit.range; dr++) {
      for (let dc = -unit.range; dc <= unit.range; dc++) {
        const r = unit.row + dr;
        const c = unit.col + dc;
        if (!this.inBounds(r, c)) continue;
        if (dr === 0 && dc === 0) continue;
        const dist = this.distanceByPattern(unit, dr, dc);
        if (dist <= unit.range) {
          const isThrower = ((unit.rangePattern || "").toLowerCase() === "thrower");
          if (isThrower || this.hasLineOfSight(unit.row, unit.col, r, c)) res.push([r, c]);
        }
      }
    }
    return res;
  }

  getHealTargets(unit) {
    return [];
  }

  showAbilityHints(unit, def) {
    this.board.clearMarks();
    this.board.markSelected(unit.row, unit.col);
    const tiles = [];
    const pattern = (def.rangePattern || "radius").toLowerCase();
    if (pattern !== "select") {
      const baseRange = typeof def.range === "number" && def.range > 0 ? def.range : unit.range;
      const area = this.getPatternTiles(unit, baseRange, pattern);
      for (const [r, c] of area) tiles.push([r, c]);
    }
    const targets = def && typeof def.computeTargets === "function" ? def.computeTargets(this, unit) : [];
    for (const [r, c] of targets) tiles.push([r, c]);
    const uniq = [];
    const seen = new Set();
    for (const [r, c] of tiles) {
      const k = `${r},${c}`;
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push([r, c]);
    }
    const cls = (pattern === "select") ? "ability-range-max" : "ability-hl";
    this.board.markPositions(uniq, cls);
    if (!this.abilityMode) this.abilityMode = { unit, def };
    this.abilityMode.targets = uniq;
  }

  getChargeTargets(unit) {
    const res = [];
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dr, dc] of dirs) {
      let r = unit.row, c = unit.col;
      for (let step = 0; step < 2; step++) {
        r += dr; c += dc;
        if (!this.inBounds(r, c)) break;
        const terr = this.terrain[r][c];
        if (terr === "wall" || terr === "water") break;
        if (this.occupants[r][c] != null) break;
        res.push([r, c]);
      }
    }
    return res;
  }

  getSnipeTargets(unit) {
    const res = [];
    for (const ent of this.entities) {
      if (ent.team === unit.team) continue;
      const dist = this.distanceByPattern(unit, ent.row - unit.row, ent.col - unit.col);
      if (dist <= unit.range + 1) res.push([ent.row, ent.col]);
    }
    return res;
  }

  getSmiteTargets(unit) {
    const res = [];
    for (const ent of this.entities) {
      if (ent.team === unit.team) continue;
      const dist = this.distanceByPattern(unit, ent.row - unit.row, ent.col - unit.col);
      if (dist <= 2 && this.hasLineOfSight(unit.row, unit.col, ent.row, ent.col)) {
        res.push([ent.row, ent.col]);
      }
    }
    return res;
  }

  getAdjacentEnemyTiles(unit) {
    const res = [];
    const deltas = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dr, dc] of deltas) {
      const r = unit.row + dr, c = unit.col + dc;
      if (!this.inBounds(r, c)) continue;
      const occ = this.occupants[r][c];
      if (occ && occ.kind === "unit" && occ.team !== unit.team) res.push([r, c]);
    }
    return res;
  }

  async onCellClicked(r, c) {
    const clickedEnt = this.occupants[r][c];
    const isPlayerTurn = this.turn === Config.TEAM.PLAYER;
    if (this.isGameOver()) return;

    if (isPlayerTurn && this.buySelection) {
      const base = this.entities.find(e => e.kind === "base" && e.team === Config.TEAM.PLAYER);
      if (base) {
        const positions = this.getBuyPositions(Config.TEAM.PLAYER).map(JSON.stringify);
        const key = JSON.stringify([r, c]);
        if (positions.includes(key)) {
          const type = this.buySelection.type;
          const cost = this.buySelection.cost;
          const hasType = this.entities.some(e => e.kind === "unit" && e.team === Config.TEAM.PLAYER && e.type === type);
          if (!hasType && this.spendEnergy(Config.TEAM.PLAYER, cost)) {
            const u = Entities.makeUnit(Config.TEAM.PLAYER, type, r, c);
            this.addEntity(u);
            this.purchasedUnits[Config.TEAM.PLAYER].add(type);
            this.buySelection = null;
            const cancelBtn = document.getElementById("buy-cancel");
            if (cancelBtn) cancelBtn.style.display = "none";
            this.board.clearMarks();
            this.renderEntities();
            this.updateHUD();
            this.renderBuyControls();
            this.updateUnitPanel(u);
            return;
          }
        }
      }
    }

    if (this.abilityMode && this.abilityMode.unit && this.abilityMode.unit.team === Config.TEAM.PLAYER) {
      const u = this.abilityMode.unit;
      const def = this.abilityMode.def;
      const key = JSON.stringify([r, c]);
      const targets = def.requiresTarget ? (def.computeTargets(this, u).map(JSON.stringify)) : [];
      if (!def.requiresTarget) {
        def.perform(this, u);
        this.abilityMode = null;
      } else if (targets.includes(key)) {
        def.perform(this, u, r, c);
        const tar = this.board.getCell(r, c) || this.board.getCell(u.row, u.col);
        if (tar) {
          tar.classList.add("ability-anim");
          setTimeout(() => tar.classList.remove("ability-anim"), 500);
        }
        this.playSfx && this.playSfx("ability");
        this.abilityMode = null;
      }
      this.renderEntities();
      this.board.clearMarks();
      this.updateHUD();
      this.updateUnitPanel(this.selected);
      if (u.ap > 0) this.showActionHints(u);
      this.checkWin();
      return;
    }
    if (this.selected && clickedEnt === this.selected) {
      this.deselect();
      return;
    }

    if (isPlayerTurn) {
      if (this.selected && this.selected.kind === "unit" && this.selected.team === Config.TEAM.PLAYER) {
        const u = this.selected;
        if (u.ap >= 1) {
          const moveTargets = this.getMoveTargets(u).map(JSON.stringify);
          const attackTargets = this.getAttackTargets(u).map(JSON.stringify);
          const key = JSON.stringify([r, c]);
          let actionTaken = false;
          if (moveTargets.includes(key) && this.occupants[r][c] == null) {
            const maxSteps = Math.min((u && u.move) || 1, Config.MAX_MOVE_PER_ACTION || 3);
            const path = this.getMovePath(u, r, c, maxSteps);
            if (path && path.length) {
              await this.animateMove(u, path, { dash: false, stepDelay: 360 });
              u.ap -= 1;
              actionTaken = true;
            }
          } else if (attackTargets.includes(key) && this.occupants[r][c]) {
            const target = this.occupants[r][c];
            const alsoTargets = this.getAttackTargets(u)
              .filter(([rr, cc]) => rr !== r || cc !== c)
              .map(([rr, cc]) => this.occupants[rr][cc])
              .filter(Boolean)
              .map(t => `${t.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${t.kind === "unit" ? t.type : "Base"}`);
            this.attack(u, target);
            this.logEvent({ type: "attack", attacker: `${u.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${u.type}`,
              target: `${target.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${target.kind === "unit" ? target.type : "Base"}`,
              dmg: u.dmg, alsoTargets });
            u.ap -= 1;
            actionTaken = true;
          }
          if (actionTaken) {
            this.renderEntities();
            this.board.clearMarks();
            this.updateHUD();
            this.updateUnitPanel(this.selected);
            this.checkWin();
            if (u.ap > 0) {
              this.showActionHints(u);
            } else {
              this.board.markSelected(u.row, u.col);
              const selCell = this.board.getCell(u.row, u.col);
              if (selCell) selCell.classList.add("selected-player");
            }
            return;
          }
        }
      }
    }
    this.board.clearMarks();
    if (clickedEnt) {
      this.abilityMode = null;
      this.selected = clickedEnt;
      this.updateHUD();
      this.updateUnitPanel(clickedEnt);
      const cell = this.board.getCell(r, c);
      if (cell) {
        cell.classList.add("selected");
        cell.classList.add(clickedEnt.team === Config.TEAM.PLAYER ? "selected-player" : "selected-enemy");
      }
      if (clickedEnt.kind === "unit") this.showActionHints(clickedEnt);
      return;
    }
    this.selected = { kind: "tile", row: r, col: c, terrain: this.terrain[r][c] };
    this.updateUnitPanel(this.selected);
    const cell = this.board.getCell(r, c);
    if (cell) cell.classList.add("selected", "selected-empty");
  }

  deselect() {
    this.selected = null;
    this.abilityMode = null;
    this.board.clearMarks();
    this.updateUnitPanel(null);
  }

  moveUnit(unit, r, c, opt) {
    const src = this.board.getCell(unit.row, unit.col);
    const dst = this.board.getCell(r, c);
    this.occupants[unit.row][unit.col] = null;
    unit.row = r; unit.col = c;
    this.occupants[r][c] = unit;
    const hz = this.hazards[r][c];
    if (hz && hz.kind === "fire" && this.terrain[r][c] !== "water") {
      unit.burnTurns = Math.max((unit.burnTurns || 0), 1);
    }
    if (dst) {
      dst.classList.add(opt && opt.dash ? "dash-anim" : "move-anim");
      setTimeout(() => dst.classList.remove("dash-anim", "move-anim"), 520);
    }
    if (src) {
      src.classList.add("move-anim");
      setTimeout(() => src.classList.remove("move-anim"), 420);
    }
  }

  getMovePath(unit, tr, tc, maxSteps) {
    const start = [unit.row, unit.col];
    const goalKey = `${tr},${tc}`;
    const seen = new Set([`${start[0]},${start[1]}`]);
    const queue = [[unit.row, unit.col, 0]];
    const parent = {};
    const pattern = (unit.movePattern || "orthogonal").toLowerCase();
    const deltas = (pattern === "square" || pattern === "orthogonal")
      ? [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
      : [[1,0],[-1,0],[0,1],[0,-1]];
    while (queue.length) {
      const [r, c, d] = queue.shift();
      if (d >= maxSteps) continue;
      for (const [dr, dc] of deltas) {
        const nr = r + dr, nc = c + dc;
        const key = `${nr},${nc}`;
        if (!this.inBounds(nr, nc)) continue;
        if (seen.has(key)) continue;
        const terr = this.terrain[nr][nc];
        if (terr === "wall" || terr === "water" || terr === "fortwall") continue;
        if (this.occupants[nr][nc] != null && !(nr === tr && nc === tc)) continue;
        seen.add(key);
        parent[key] = `${r},${c}`;
        if (key === goalKey) {
          const path = [];
          let cur = key;
          while (cur && cur !== `${start[0]},${start[1]}`) {
            const [pr, pc] = cur.split(",").map(Number);
            path.unshift([pr, pc]);
            cur = parent[cur];
          }
          return path;
        }
        queue.push([nr, nc, d + 1]);
      }
    }
    return null;
  }

  async animateMove(unit, path, options) {
    const delay = (options && options.stepDelay) || 360;
    for (const [r, c] of path) {
      this.moveUnit(unit, r, c, { dash: !!(options && options.dash) });
      this.renderEntities();
      this.board.clearMarks();
      await this.delay(delay);
    }
    this.playSfx && this.playSfx(options && options.dash ? "dash" : "move");
  }

  applyDamage(target, dmg, source) {
    const before = target.hp;
    target.hp = Math.max(0, target.hp - dmg);
    const cell = this.board.getCell(target.row, target.col);
    if (cell) {
      cell.classList.add("hit-anim");
      setTimeout(() => cell.classList.remove("hit-anim"), 360);
    }
    this.playSfx && this.playSfx("hit");
    if (target.hp === 0 && before > 0) {
      if (target.kind === "unit") {
        const killer = source ? `${source.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${source.type}` : "Unknown";
        const victim = `${target.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${target.type}`;
        this.logEvent({ type: "death", killer, victim });
        this.teamDeaths = this.teamDeaths || { [Config.TEAM.PLAYER]: 0, [Config.TEAM.AI]: 0 };
        this.teamDeaths[target.team] = (this.teamDeaths[target.team] || 0) + 1;
        this.entities = this.entities.filter(e => e !== target);
        this.occupants[target.row][target.col] = null;
        const wasSelected = this.selected === target;
        const wasAiming = this.abilityMode && this.abilityMode.unit === target;
        if (wasSelected || wasAiming) this.deselect();
      }
    }
  }

  attack(attacker, target) {
    let dmg = attacker.dmg;
    if (attacker.type === "Avenger") {
      this.teamDeaths = this.teamDeaths || { [Config.TEAM.PLAYER]: 0, [Config.TEAM.AI]: 0 };
      const bonus = Math.min(5, this.teamDeaths[attacker.team] || 0);
      dmg += bonus;
    }
    this.applyDamage(target, dmg, attacker);
  }

  heal(mage, ally) {
    if (mage.type !== "Mage") return;
    ally.hp = Math.min(ally.maxHp, ally.hp + 2);
    const cell = this.board.getCell(ally.row, ally.col);
    if (cell) {
      cell.classList.add("heal-anim");
      setTimeout(() => cell.classList.remove("heal-anim"), 640);
    }
    this.playSfx && this.playSfx("heal");
  }

  async endPlayerTurn() {
    if (this.turn !== Config.TEAM.PLAYER) return;
    this.selected = null;
    this.abilityMode = null;
    this.buySelection = null;
    this.board.clearMarks();
    const cancelBtn = document.getElementById("buy-cancel");
    if (cancelBtn) cancelBtn.style.display = "none";
    this.turn = Config.TEAM.AI;
    this.updateHUD();
    this.generateEnergy(Config.TEAM.AI);
    this.resetAPForTeam(Config.TEAM.AI);
    this.applyHazardsForTeam(Config.TEAM.AI);
    this.tickCooldowns(Config.TEAM.AI);
    await this.runAI();
    this.checkWin();
    this.turn = Config.TEAM.PLAYER;
    this.generateEnergy(Config.TEAM.PLAYER);
    this.resetAPForTeam(Config.TEAM.PLAYER);
    this.applyHazardsForTeam(Config.TEAM.PLAYER);
    this.tickCooldowns(Config.TEAM.PLAYER);
    this.abilityMode = null;
    this.updateHUD();
  }

  async runAI() {
    const aiBase = this.entities.find(e => e.kind === "base" && e.team === Config.TEAM.AI);
    if (aiBase && window.Entities && window.Entities.unitDefs) {
      const t = this.chooseAIPurchaseType();
      if (t) {
        const cost = window.Entities.unitDefs[t].cost || 0;
        if (this.energy[Config.TEAM.AI] >= cost) {
          if (this.spawnUnitNearBase(Config.TEAM.AI, t)) {
            this.spendEnergy(Config.TEAM.AI, cost);
          }
        }
      }
      // AI Rune Purchasing
      if (window.RuneDefs && this.energy[Config.TEAM.AI] >= 3) {
        const aiUnits = this.entities.filter(e => e.kind === "unit" && e.team === Config.TEAM.AI && e.runes.length < 3);
        if (aiUnits.length > 0 && Math.random() < 0.4) {
           const unit = aiUnits[Math.floor(Math.random() * aiUnits.length)];
           const runes = window.RuneDefs;
           const rune = runes[Math.floor(Math.random() * runes.length)];
           if (this.energy[Config.TEAM.AI] >= rune.cost) {
             this.buyRune(unit, rune.id);
             this.logEvent({ type: "status", msg: `AI bought ${rune.name} for ${unit.type}` });
           }
        }
      }
    }
    const playerBase = this.entities.find(e => e.kind === "base" && e.team === Config.TEAM.PLAYER);
    const aiUnits = this.entities.filter(e => e.kind === "unit" && e.team === Config.TEAM.AI);
    const playerUnits = this.entities.filter(e => e.kind === "unit" && e.team === Config.TEAM.PLAYER);
    const focus = playerUnits.length ? playerUnits.slice().sort((a, b) => a.hp - b.hp)[0] : playerBase;
    for (const u of aiUnits) {
      while (u.ap > 0) {
        const healTargets = this.getHealTargets(u);
        if (u.type === "Mage" && ((u.abilityCooldowns["Frostbolt"] || 0) === 0)) {
          const def = (window.Abilities && window.Abilities.Mage && window.Abilities.Mage[0]);
          if (def) {
            const targets = def.computeTargets(this, u);
            // Prioritize units with AP > 0 (to stun them) or low HP
            const scored = targets.map(([r, c]) => {
              const target = this.occupants[r][c];
              if (!target) return { r, c, score: 0 };
              let score = 0;
              if (target.kind === "unit") {
                 if ((target.stunnedTurns || 0) > 0) score -= 4;
                 if (target.ap > 0) score += 5;
                 score += (target.maxHp - target.hp); // Finish off weak
              }
              return { r, c, score };
            }).sort((a, b) => b.score - a.score);
            
            if (scored.length > 0) {
              const best = scored[0];
              def.perform(this, u, best.r, best.c);
              await this.delay(320);
              continue;
            }
          }
        }
        if (u.ap >= 1) {
          if (u.type === "Alchemist" && ((u.abilityCooldowns["Catalyze"] || 0) === 0)) {
            const def = (window.Abilities && window.Abilities.Alchemist && window.Abilities.Alchemist[0]);
            if (def) {
              const targets = def.computeTargets(this, u);
              let bestTarget = null;
              let maxHits = 0;
              for (const [r, c] of targets) {
                let hits = 0;
                for (let dr = -1; dr <= 1; dr++) {
                  for (let dc = -1; dc <= 1; dc++) {
                    const rr = r + dr, cc = c + dc;
                    if (!this.inBounds(rr, cc)) continue;
                    const occ = this.occupants[rr][cc];
                    if (occ && occ.team !== u.team) {
                      hits++;
                      if (occ.kind === "base") hits += 2;
                    }
                  }
                }
                if (hits > maxHits) {
                  maxHits = hits;
                  bestTarget = [r, c];
                }
              }
              if (bestTarget && maxHits > 0) {
                def.perform(this, u, bestTarget[0], bestTarget[1]);
                await this.delay(320);
                continue;
              }
            }
          }
          if (u.type === "Firecaller" && ((u.abilityCooldowns["Ignite"] || 0) === 0)) {
            const def = (window.Abilities && window.Abilities.Firecaller && window.Abilities.Firecaller[0]);
            if (def) {
              const targets = def.computeTargets(this, u);
              let bestTarget = null;
              let maxEnemies = 0;
              for (const [r, c] of targets) {
                let enemies = 0;
                for (let dr = -1; dr <= 1; dr++) {
                  for (let dc = -1; dc <= 1; dc++) {
                    const rr = r + dr, cc = c + dc;
                    if (!this.inBounds(rr, cc)) continue;
                    const occ = this.occupants[rr][cc];
                    if (occ && occ.kind === "unit" && occ.team !== u.team) enemies++;
                  }
                }
                if (enemies > maxEnemies) { maxEnemies = enemies; bestTarget = [r, c]; }
              }
              if (bestTarget && maxEnemies > 0) {
                def.perform(this, u, bestTarget[0], bestTarget[1]);
                await this.delay(360);
                continue;
              }
            }
          }
          if (u.type === "Magnet" && ((u.abilityCooldowns["Pull"] || 0) === 0)) {
            const def = (window.Abilities && window.Abilities.Magnet && window.Abilities.Magnet[0]);
            if (def) {
              const targets = def.computeTargets(this, u);
              let best = null;
              let bestGain = -Infinity;
              for (const [r, c] of targets) {
                const occ = this.occupants[r][c];
                if (!occ || occ.team === u.team) continue;
                const stepR = r + Math.sign(u.row - r);
                const stepC = c + Math.sign(u.col - c);
                if (!this.inBounds(stepR, stepC)) continue;
                if (this.occupants[stepR][stepC] != null) continue;
                const terr = this.terrain[stepR][stepC];
                if (terr === "wall" || terr === "water" || terr === "fortwall") continue;
                const before = Math.max(Math.abs(r - u.row), Math.abs(c - u.col));
                const after  = Math.max(Math.abs(stepR - u.row), Math.abs(stepC - u.col));
                const gain = before - after;
                if (gain > bestGain) { bestGain = gain; best = [r, c]; }
              }
              if (best) {
                def.perform(this, u, best[0], best[1]);
                await this.delay(360);
                continue;
              }
            }
          }
          if (u.type === "Berserker" && ((u.abilityCooldowns["Whirlwind"] || 0) === 0)) {
            const adj = this.getAdjacentEnemyTiles(u);
            if (adj.length) {
              for (const [rr, cc] of adj) {
                const t = this.occupants[rr][cc];
                if (t) this.applyDamage(t, u.dmg, u);
              }
              u.ap -= 1;
              u.abilityCooldowns["Whirlwind"] = (u.abilityCooldowns["Whirlwind"] || 0) + 2;
              this.logEvent({ type: "ability", caster: `AI Berserker`, ability: "Whirlwind" });
              await this.delay(320);
              continue;
            }
          }
          if (u.type === "Paladin" && ((u.abilityCooldowns["Smite"] || 0) === 0)) {
            const smites = this.getSmiteTargets(u)
              .map(([r, c]) => this.occupants[r][c])
              .filter(Boolean);
            if (smites.length) {
              smites.sort((a, b) => {
                const sa = (a.kind === "base" ? 100 : 0) + (a.maxHp - a.hp);
                const sb = (b.kind === "base" ? 100 : 0) + (b.maxHp - b.hp);
                return sb - sa;
              });
              const target = smites[0];
              this.applyDamage(target, u.dmg + 1, u);
              u.ap -= 1;
              u.abilityCooldowns["Smite"] = (u.abilityCooldowns["Smite"] || 0) + 2;
              this.logEvent({ type: "ability", caster: `AI Paladin`, ability: "Smite", target: `${target.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${target.kind === "unit" ? target.type : "Base"}` });
              await this.delay(320);
              continue;
            }
          }
          if (u.type === "Archer" && ((u.abilityCooldowns["Snipe"] || 0) === 0)) {
            const snipes = this.getSnipeTargets(u)
              .map(([r, c]) => this.occupants[r][c])
              .filter(Boolean);
            if (snipes.length) {
              snipes.sort((a, b) => {
                const sa = (a.kind === "base" ? 100 : 0) + (a.maxHp - a.hp);
                const sb = (b.kind === "base" ? 100 : 0) + (b.maxHp - b.hp);
                return sb - sa;
              });
              const target = snipes[0];
              this.applyDamage(target, u.dmg + 1, u);
              u.ap -= 1;
              u.abilityCooldowns["Snipe"] = (u.abilityCooldowns["Snipe"] || 0) + 2;
              this.logEvent({ type: "ability", caster: `AI Archer`, ability: "Snipe", target: `${target.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${target.kind === "unit" ? target.type : "Base"}` });
              await this.delay(300);
              continue;
            }
          }
          if (u.type === "Warrior" && ((u.abilityCooldowns["Charge"] || 0) === 0)) {
            const charges = this.getChargeTargets(u);
            if (charges.length) {
              const best = charges
                .map(([r, c]) => ({ r, c, d: Math.abs(focus.row - r) + Math.abs(focus.col - c) }))
                .sort((a, b) => a.d - b.d)[0];
              if (best) {
                const path = [];
                const dr = Math.sign(best.r - u.row), dc = Math.sign(best.c - u.col);
                let cr = u.row, cc = u.col;
                for (let step = 0; step < 2; step++) {
                  cr += dr; cc += dc;
                  if (!this.inBounds(cr, cc)) break;
                  if (this.terrain[cr][cc] || this.occupants[cr][cc] != null) break;
                  path.push([cr, cc]);
                }
                if (path.length) {
                  await this.animateMove(u, path, { dash: true, stepDelay: 120 });
                } else {
                  this.moveUnit(u, best.r, best.c, { dash: true });
                }
                u.ap -= 1;
                u.abilityCooldowns["Charge"] = (u.abilityCooldowns["Charge"] || 0) + 2;
                this.logEvent({ type: "ability", caster: `AI Warrior`, ability: "Charge" });
                await this.delay(320);
                continue;
              }
            }
          }
          if (u.type === "Builder" && ((u.abilityCooldowns["Construct"] || 0) === 0)) {
            const def = (window.Abilities && window.Abilities.Builder && window.Abilities.Builder[0]);
            const playerBase = this.entities.find(e => e.kind === "base" && e.team === Config.TEAM.PLAYER);
            if (def) {
              const targets = def.computeTargets(this, u);
              const candidates = [];
              for (const [r,c] of targets) {
                let blocks = 0;
                for (let dr = -1; dr <= 1; dr++) {
                  for (let dc = -1; dc <= 1; dc++) {
                    const rr = r + dr, cc = c + dc;
                    if (!this.inBounds(rr, cc)) continue;
                    const terr = this.terrain[rr][cc];
                    if (terr === "water" || terr === "wall") blocks++;
                  }
                }
                if (blocks > 0) {
                  const dNow = Math.abs(playerBase.row - u.row) + Math.abs(playerBase.col - u.col);
                  const dCent = Math.abs(playerBase.row - r) + Math.abs(playerBase.col - c);
                  candidates.push({ r, c, blocks, dCent, dNow });
                }
              }
              candidates.sort((a, b) => (b.blocks - a.blocks) || (a.dCent - b.dCent));
              const pick = candidates[0];
              if (pick) {
                def.perform(this, u, pick.r, pick.c);
                await this.delay(320);
                continue;
              }
            }
          }
          if (u.type === "Cleric" && ((u.abilityCooldowns["Mass Heal"] || 0) === 0)) {
            let allies = 0;
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = u.row + dr, c = u.col + dc;
                if (!this.inBounds(r, c)) continue;
                const occ = this.occupants[r][c];
                if (occ && occ.kind === "unit" && occ.team === u.team && occ.hp < occ.maxHp) allies++;
              }
            }
            if (allies > 0) {
               const def = (window.Abilities && window.Abilities.Cleric && window.Abilities.Cleric[0]);
               if (def) {
                 def.perform(this, u);
                 await this.delay(320);
                 continue;
               }
            }
          }
          if (u.type === "Rogue" && ((u.abilityCooldowns["Shadow Strike"] || 0) === 0)) {
            const def = (window.Abilities && window.Abilities.Rogue && window.Abilities.Rogue[0]);
            if (def) {
              const targets = def.computeTargets(this, u);
              const scored = targets.map(([r, c]) => {
                let bestEnemyScore = -1;
                for (let dr = -1; dr <= 1; dr++) {
                  for (let dc = -1; dc <= 1; dc++) {
                     const nr = r + dr, nc = c + dc;
                     if (!this.inBounds(nr, nc)) continue;
                     const occ = this.occupants[nr][nc];
                     if (occ && occ.team !== u.team) {
                        let s = (occ.kind === "base" ? 50 : 0) + (occ.maxHp - occ.hp);
                        if (s > bestEnemyScore) bestEnemyScore = s;
                     }
                  }
                }
                return { r, c, score: bestEnemyScore };
              }).filter(t => t.score >= 0).sort((a, b) => b.score - a.score);

              if (scored.length > 0) {
                 const pick = scored[0];
                 def.perform(this, u, pick.r, pick.c);
                 await this.delay(320);
                 continue;
              }
            }
          }
        }
        const attackables = this.getAttackTargets(u)
          .map(([r, c]) => this.occupants[r][c])
          .filter(Boolean);
        if (attackables.length > 0) {
          attackables.sort((a, b) => {
            const sa = (a.kind === "base" ? 100 : 0) + (a.maxHp - a.hp);
            const sb = (b.kind === "base" ? 100 : 0) + (b.maxHp - b.hp);
            return sb - sa;
          });
          const target = attackables[0];
          const alsoTargets = this.getAttackTargets(u)
            .filter(([rr, cc]) => !(rr === target.row && cc === target.col))
            .map(([rr, cc]) => this.occupants[rr][cc])
            .filter(Boolean)
            .map(t => `${t.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${t.kind === "unit" ? t.type : "Base"}`);
          this.attack(u, target);
          u.ap -= 1;
          this.logEvent({ type: "attack", attacker: `AI ${u.type}`, target: `${target.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${target.kind === "unit" ? target.type : "Base"}`, dmg: u.dmg, alsoTargets });
          await this.delay(280);
          continue;
        }
        const nearestPlayer = playerUnits.slice().sort((a, b) => (Math.abs(a.row - u.row) + Math.abs(a.col - u.col)) - (Math.abs(b.row - u.row) + Math.abs(b.col - u.col)))[0];
        if (u.hp <= 1 && nearestPlayer) {
          const step = this.stepAway(u.row, u.col, nearestPlayer.row, nearestPlayer.col, u);
          if (step) {
            const [nr, nc] = step;
            if (this.occupants[nr][nc] == null) {
              const path = this.getMovePath(u, nr, nc, (u.move || 1));
              if (path && path.length) {
                await this.animateMove(u, path, { dash: false, stepDelay: 140 });
              } else {
                this.moveUnit(u, nr, nc);
              }
            }
            u.ap -= 1;
            await this.delay(260);
            continue;
          }
        }
        const step = this.stepTowardSmart(u.row, u.col, focus.row, focus.col, u);
        if (step) {
          const [nr, nc] = step;
          if (this.occupants[nr][nc] == null) {
            const path = this.getMovePath(u, nr, nc, (u.move || 1));
            if (path && path.length) {
              await this.animateMove(u, path, { dash: false, stepDelay: 140 });
            } else {
              this.moveUnit(u, nr, nc);
            }
          }
          u.ap -= 1;
          await this.delay(260);
          continue;
        }
        break;
      }
    }
    this.renderEntities();
  }

  stepToward(sr, sc, tr, tc, unit) {
    const dummy = { row: sr, col: sc };
    const maxSteps = Math.min((unit && unit.move) || 1, Config.MAX_MOVE_PER_ACTION || 3);
    dummy.movePattern = unit.movePattern || "orthogonal";
    const candidates = this.getReachableTiles(dummy, maxSteps);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => ((Math.abs(tr - a[0]) + Math.abs(tc - a[1])) - (Math.abs(tr - b[0]) + Math.abs(tc - b[1]))));
    return candidates[0] || null;
  }

  stepTowardSmart(sr, sc, tr, tc, unit) {
    const dummy = { row: sr, col: sc };
    const maxSteps = Math.min((unit && unit.move) || 1, Config.MAX_MOVE_PER_ACTION || 3);
    dummy.movePattern = unit.movePattern || "orthogonal";
    const candidates = this.getReachableTiles(dummy, maxSteps);
    if (candidates.length === 0) return null;
    const players = this.entities.filter(e => e.kind === "unit" && e.team === Config.TEAM.PLAYER);
    const scored = candidates.map(([nr, nc]) => {
      let exp = 0;
      for (const p of players) {
        const dist = this.distanceByPattern(p, nr - p.row, nc - p.col);
        if (dist <= p.range && this.hasLineOfSight(p.row, p.col, nr, nc)) exp++;
      }
      const d = Math.abs(tr - nr) + Math.abs(tc - nc);
      return { cell: [nr, nc], exp, d };
    }).sort((a, b) => (a.exp - b.exp) || (a.d - b.d));
    return scored[0].cell;
  }

  stepAway(sr, sc, er, ec, unit) {
    const dummy = { row: sr, col: sc };
    const maxSteps = Math.min((unit && unit.move) || 1, Config.MAX_MOVE_PER_ACTION || 3);
    dummy.movePattern = unit.movePattern || "orthogonal";
    const candidates = this.getReachableTiles(dummy, maxSteps);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => ((Math.abs(er - b[0]) + Math.abs(ec - b[1])) - (Math.abs(er - a[0]) + Math.abs(ec - a[1]))));
    return candidates[0] || null;
  }

  checkWin() {
    const pBase = this.entities.find(e => e.kind === "base" && e.team === Config.TEAM.PLAYER);
    const aBase = this.entities.find(e => e.kind === "base" && e.team === Config.TEAM.AI);
    if (pBase.hp <= 0) {
      this.showOverlay("AI Wins! The player base was destroyed.");
      this.logEvent({ type: "status", msg: "AI Wins!" });
    } else if (aBase.hp <= 0) {
      this.showOverlay("Player Wins! The AI base was destroyed.");
      this.logEvent({ type: "status", msg: "Player Wins!" });
    }
  }

  isGameOver() {
    const o = this.overlay;
    return o && !o.classList.contains("hidden");
  }

  ensureOverlay() {
    let o = document.getElementById("game-overlay");
    if (!o) {
      o = document.createElement("div");
      o.id = "game-overlay";
      o.className = "overlay hidden";
      o.innerHTML = `<div class="panel"><div id="overlay-msg"></div><button id="reset-btn" class="btn">Play Again</button></div>`;
      document.body.appendChild(o);
      const btn = o.querySelector("#reset-btn");
      btn.addEventListener("click", () => location.reload());
    }
    this.overlay = o;
  }

  showOverlay(msg) {
    const o = this.overlay; if (!o) return;
    o.querySelector("#overlay-msg").textContent = msg;
    o.classList.remove("hidden");
  }

  logEvent(event) {
    const ts = new Date().toLocaleTimeString();
    this.log.unshift({ ts, ...event });
    this.renderLog();
  }

  renderLog() {
    const list = document.getElementById("log-list");
    if (!list) return;
    list.innerHTML = "";
    for (const e of this.log.slice(0, 5)) {
      const li = document.createElement("li");
      if (e.type === "attack") {
        const also = e.alsoTargets && e.alsoTargets.length
          ? ` <span class="small">(also in range: ${e.alsoTargets.join(", ")})</span>`
          : "";
        li.innerHTML = `${e.attacker} attacked ${e.target} for ${e.dmg} damage.${also}`;
      } else if (e.type === "ability") {
        li.innerHTML = `${e.caster} used ${e.ability}${e.target ? ` on ${e.target}` : ""}.`;
      } else if (e.type === "death") {
        li.innerHTML = `${e.killer} killed ${e.victim}.`;
      } else if (e.type === "status") {
        li.innerHTML = `${e.msg}`;
      }
      list.appendChild(li);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  tickCooldowns(team) {
    for (const e of this.entities) {
      if (e.kind === "unit" && e.team === team && e.abilityCooldowns) {
        for (const k of Object.keys(e.abilityCooldowns)) {
          e.abilityCooldowns[k] = Math.max(0, e.abilityCooldowns[k] - 1);
        }
      }
    }
  }
}

Game.prototype.resetAPForTeam = function(team) {
  for (const e of this.entities) {
    if (e.kind === "unit" && e.team === team) {
      const st = e.stunnedTurns || 0;
      if (st > 0) {
        e.ap = 0;
        e.stunnedTurns = st - 1;
      } else {
        e.ap = e.apMax;
      }
    }
  }
};

Game.prototype.applyHazardsForTeam = function(team) {
  for (const e of this.entities) {
    if (e.kind === "unit" && e.team === team) {
      const h = this.hazards[e.row][e.col];
      if (h && h.kind === "fire" && this.terrain[e.row][e.col] !== "water") {
        this.applyDamage(e, 2, null);
      }
      if ((e.burnTurns || 0) > 0) {
        this.applyDamage(e, 1, null);
        e.burnTurns = Math.max(0, (e.burnTurns || 0) - 1);
      }
    }
  }
  for (let r = 0; r < Config.ROWS; r++) {
    for (let c = 0; c < Config.COLS; c++) {
      const h = this.hazards[r][c];
      if (!h) continue;
      h.turns -= 1;
      if (h.turns <= 0) this.hazards[r][c] = null;
    }
  }
  this.renderEntities();
};
window.addEventListener("DOMContentLoaded", () => {
  const mountEl = document.getElementById("grid");
  const board = new Board(Config.ROWS, Config.COLS, mountEl);
  const game = new Game(board);
  window.board = board;
  window.game = game;
});
 
// Terrain generation tuned for organic symmetric placement with density
Game.prototype.generateTerrain = function() {
  const totalTiles = Config.ROWS * Config.COLS;
  let target = Math.floor(totalTiles * (Config.TERRAIN_DENSITY || 0.12));
  if (target % 2 !== 0) target -= 1;
  const pairsTarget = Math.max(0, Math.floor(target / 2));
  let pairsPlaced = 0;
  let safety = 0;
  const centerBias = () => {
    let sum = 0;
    for (let i = 0; i < 6; i++) sum += Math.random();
    return (sum / 6);
  };

Game.prototype.playSfx = function(kind) {
  const ctx = this.audioCtx;
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value =
    kind === "hit" ? 320 :
    kind === "heal" ? 520 :
    kind === "ability" ? 420 :
    kind === "click" ? 650 :
    kind === "move" ? 440 :
    kind === "dash" ? 600 : 420;
  g.gain.value = 0.03;
  o.connect(g).connect(ctx.destination);
  o.start();
  setTimeout(() => { o.stop(); o.disconnect(); g.disconnect(); }, 120);
};
  const edgeBiasIndex = (size) => {
    const edgeSide = Math.random() < 0.5 ? 0 : size - 1;
    const jitter = Math.round((Math.random() - 0.5) * size * 0.3);
    return Math.min(size - 1, Math.max(0, edgeSide + jitter));
  };
  const blocked = new Set();
  const pAdj = this.getBuyPositions(Config.TEAM.PLAYER);
  const aAdj = this.getBuyPositions(Config.TEAM.AI);
  for (const [r, c] of pAdj) blocked.add(`${r},${c}`);
  for (const [r, c] of aAdj) blocked.add(`${r},${c}`);
  while (pairsPlaced < pairsTarget && safety < 5000) {
    safety++;
    const useEdge = Math.random() < 0.65;
    const r = useEdge ? edgeBiasIndex(Config.ROWS) : Math.min(Config.ROWS - 1, Math.max(0, Math.floor(centerBias() * Config.ROWS)));
    const c = useEdge ? edgeBiasIndex(Config.COLS) : Math.min(Config.COLS - 1, Math.max(0, Math.floor(centerBias() * Config.COLS)));
    const mr = Config.ROWS - 1 - r;
    const mc = Config.COLS - 1 - c;
    if (r === mr && c === mc) continue;
    if (this.occupants[r][c] != null) continue;
    if (this.occupants[mr][mc] != null) continue;
    if (this.terrain[r][c] != null) continue;
    if (this.terrain[mr][mc] != null) continue;
    if (blocked.has(`${r},${c}`)) continue;
    if (blocked.has(`${mr},${mc}`)) continue;
    let neighborCount = 0;
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nr = r + dr, nc = c + dc;
      if (this.inBounds(nr, nc) && this.terrain[nr][nc]) neighborCount++;
    }
    if (neighborCount > 2 && Math.random() < 0.6) continue;
    const terr = Math.random() < 0.5 ? "wall" : "water";
    this.terrain[r][c] = terr;
    this.terrain[mr][mc] = terr;
    pairsPlaced++;
  }
};

Game.prototype.pickMirroredBasePositions = function() {
  let tries = 0;
  while (tries++ < 200) {
    const r = Math.floor(Config.ROWS * 0.7) + Math.floor(Math.random() * Math.ceil(Config.ROWS * 0.3));
    const c = Math.floor(Math.random() * Math.ceil(Config.COLS * 0.3));
    if (!this.inBounds(r, c)) continue;
    if (this.occupants[r][c] != null) continue;
    const mr = Config.ROWS - 1 - r;
    const mc = Config.COLS - 1 - c;
    if (!this.inBounds(mr, mc)) continue;
    if (this.occupants[mr][mc] != null) continue;
    const d = Math.abs(mr - r) + Math.abs(mc - c);
    if (d < Math.floor((Config.ROWS + Config.COLS) * 0.8)) continue;
    return [[r, c], [mr, mc]];
  }
  return [[Config.ROWS - 1, 0], [0, Config.COLS - 1]];
};

Game.prototype.generateEnergy = function(team) {
  const produced = this.energyGenerated[team];
  const max = Config.ENERGY_MAX_TOTAL;
  if (produced >= max) return;
  const gain = this.energyGain[team];
  const add = Math.min(gain, max - produced);
  this.energy[team] += add;
  this.energyGenerated[team] += add;
  if (this.energyGain[team] < Config.ENERGY_GAIN_CAP) this.energyGain[team] += 1;
  this.updateHUD();
};

Game.prototype.spendEnergy = function(team, amount) {
  if (this.energy[team] < amount) return false;
  this.energy[team] -= amount;
  this.updateHUD();
  // Update Buy Controls to reflect purchase
      this.renderBuyControls();
      return true;
    };

Game.prototype.spawnUnitNearBase = function(team, type) {
  if (this.purchasedUnits[team].has(type)) return false;
  if (this.entities.some(e => e.kind === "unit" && e.team === team && e.type === type)) return false;
  const base = this.entities.find(e => e.kind === "base" && e.team === team);
  if (!base) return false;
  const res = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = base.row + dr, c = base.col + dc;
      if (!this.inBounds(r, c)) continue;
      if (this.terrain[r][c]) continue;
      if (this.occupants[r][c] != null) continue;
      res.push([r, c]);
    }
  }
  if (res.length === 0) return false;
  const [r, c] = res[Math.floor(Math.random() * res.length)];
  const u = Entities.makeUnit(team, type, r, c);
  this.addEntity(u);
  this.purchasedUnits[team].add(type);
  this.renderEntities();
  // If player, refresh buy controls to remove purchased unit
  if (team === Config.TEAM.PLAYER) {
    this.renderBuyControls();
  }
  return true;
};

Game.prototype.buyRune = function(unit, runeId) {
  const rune = window.RuneDefs.find(r => r.id === runeId);
  if (!rune) return;
  if (this.energy[unit.team] < rune.cost) return;
  if (unit.runes.length >= 3) return;
  if (unit.runes.some(r => r.id === runeId)) return;

  this.spendEnergy(unit.team, rune.cost);
  unit.runes.push(rune);
  rune.apply(unit);
  this.playSfx && this.playSfx("heal");
  this.updateUnitPanel(unit);
  this.updateHUD();
};

Game.prototype.getBuyPositions = function(team) {
  const base = this.entities.find(e => e.kind === "base" && e.team === team);
  if (!base) return [];
  const res = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = base.row + dr, c = base.col + dc;
      if (!this.inBounds(r, c)) continue;
      if (this.terrain[r][c]) continue;
      if (this.occupants[r][c] != null) continue;
      res.push([r, c]);
    }
  }
  return res;
};

Game.prototype.renderBuyControls = function() {
  const wrap = document.getElementById("buy-controls");
  if (!wrap || !window.Entities || !window.Entities.unitDefs) return;
  const defs = window.Entities.unitDefs;
  const groups = {};
  Object.keys(defs).forEach(t => {
    const c = defs[t].cost || 0;
    if (!groups[c]) groups[c] = [];
    groups[c].push(t);
  });
  const uniqCosts = Object.keys(groups).map(Number).sort((a, b) => a - b);
  const frag = document.createDocumentFragment();
  uniqCosts.forEach(c => {
    const group = document.createElement("div");
    group.className = "buy-group";
    const header = document.createElement("button");
    header.type = "button";
    header.className = "group-header btn";
    header.textContent = `Cost ${c}`;
    const list = document.createElement("div");
    list.className = "group-list";
    list.style.display = "none";
    header.addEventListener("click", () => {
      list.style.display = list.style.display === "none" ? "block" : "none";
    });
    const remaining = groups[c].filter(t => {
      return !this.purchasedUnits[Config.TEAM.PLAYER].has(t);
    });
    remaining.forEach(t => {
      const def = Entities.unitDefs[t];
      const item = document.createElement("button");
      item.type = "button";
      item.className = "unit-item";
      item.innerHTML = `<div class="unit-title">${def.symbol} ${t}</div><div class="unit-desc-small">${def.ability}</div>`;
      item.title = def.ability;
      item.addEventListener("click", () => {
        if (this.buySelection && this.buySelection.type === t) {
          this.buySelection = null;
          this.board.clearMarks();
          const cancelBtn = document.getElementById("buy-cancel");
          if (cancelBtn) cancelBtn.style.display = "none";
          this.updateUnitPanel(null);
          item.classList.remove("selected");
          return;
        }
        this.buySelection = { type: t, cost: def.cost };
        const pos = this.getBuyPositions(Config.TEAM.PLAYER);
        this.board.clearMarks();
        this.board.markPositions(pos, "buy-hl");
        const cancelBtn = document.getElementById("buy-cancel");
        if (cancelBtn) cancelBtn.style.display = "inline-block";
        document.querySelectorAll(".unit-item.selected").forEach(el => el.classList.remove("selected"));
        item.classList.add("selected");
        const preview = {
          kind: "unit",
          team: Config.TEAM.PLAYER,
          type: t,
          row: 0, col: 0,
          hp: def.hp, maxHp: def.hp, dmg: def.dmg, range: def.range, move: def.move,
          symbol: def.symbol, ability: def.ability, rangePattern: def.rangePattern, movePattern: def.movePattern || "orthogonal",
          abilityCooldowns: {}, runes: [], apMax: 2, ap: 2,
        };
        this.updateUnitPanel(preview);
      });
      list.appendChild(item);
    });
    if (list.childElementCount === 0) return;
    group.appendChild(header);
    group.appendChild(list);
    frag.appendChild(group);
  });
  wrap.innerHTML = "";
  wrap.appendChild(frag);
  const cancelBtn = document.getElementById("buy-cancel");
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      this.buySelection = null;
      this.board.clearMarks();
      cancelBtn.style.display = "none";
      document.querySelectorAll(".unit-item.selected").forEach(el => el.classList.remove("selected"));
      this.updateUnitPanel(null);
    };
  }
};

Game.prototype.chooseAIPurchaseType = function() {
  const defs = window.Entities.unitDefs;
  const affordable = Object.keys(defs).filter(t => this.energy[Config.TEAM.AI] >= (defs[t].cost || 0));
  if (affordable.length === 0) return null;
  const aiUnits = this.entities.filter(e => e.kind === "unit" && e.team === Config.TEAM.AI);
  const playerUnits = this.entities.filter(e => e.kind === "unit" && e.team === Config.TEAM.PLAYER);
  const uniqueAffordable = affordable.filter(t => !this.purchasedUnits[Config.TEAM.AI].has(t));
  const needHealer = aiUnits.some(u => u.hp < u.maxHp);
  if (needHealer && uniqueAffordable.includes("Mage")) return "Mage";
  const preferRanged = playerUnits.length === 0 || playerUnits.some(u => u.type === "Warrior");
  const weights = { Warrior: 1, Archer: 2, Mage: 1, Paladin: 2, Berserker: 2, Builder: 2, Alchemist: 2, Rogue: 2, Cleric: 1 };
  if (preferRanged) { weights.Archer += 1; weights.Paladin += 1; }
  const list = uniqueAffordable.flatMap(t => Array(weights[t]).fill(t));
  return list[Math.floor(Math.random() * list.length)];
};

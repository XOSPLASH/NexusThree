// Game: owns state, rendering of tokens, interactions, AI, and win condition
class Game {
  constructor(board) {
    this.board = board;
    this.turn = Config.TEAM.PLAYER;
    this.selected = null;
    this.abilityMode = null;
    this.buySelection = null;
    this.shopFilters = { filterValue: "all", sort: "cost" };
    this.draftFilters = { filterValue: "all", sort: "cost" };
    this.collectionFilters = { query: "", classValue: "all", costValue: "all", rarityValue: "all", ownership: "owned" };
    this.menuView = "home";
    this.minimumPvpCards = 16;
    this.standardDraftCardsNeeded = 16;
    this.aiDraftLoaners = [];
    this.hoverPreviewKey = "";
    this.overlay = null;
    this.runeTooltip = null;
    this.runeTooltipCleanup = null;
    this.runeTooltipHideTimer = null;
    this.occupants = Array.from({ length: Config.ROWS }, () => Array(Config.COLS).fill(null));
    this.terrain = Array.from({ length: Config.ROWS }, () => Array(Config.COLS).fill(null));
    this.hazards = Array.from({ length: Config.ROWS }, () => Array(Config.COLS).fill(null));
    this.constructionSites = Array.from({ length: Config.ROWS }, () => Array(Config.COLS).fill(null));
    this.biomes = []; // Array of { type, r, c, radius, team, duration, effect }
    this.entities = [];
    this.log = [];
    this.energy = { [Config.TEAM.PLAYER]: Config.ENERGY_START_PLAYER, [Config.TEAM.AI]: Config.ENERGY_START_AI };
    this.energyGenerated = { [Config.TEAM.PLAYER]: Config.ENERGY_START_PLAYER, [Config.TEAM.AI]: Config.ENERGY_START_AI };
    this.energyGainStep = { [Config.TEAM.PLAYER]: 0, [Config.TEAM.AI]: 0 }; // 0->+3, 1->+4, 2->+5, then +6
    this.energyGainSixLeft = { [Config.TEAM.PLAYER]: 6, [Config.TEAM.AI]: 6 }; // next 6 turns at +6
    this.energyDelayOne = { [Config.TEAM.PLAYER]: false, [Config.TEAM.AI]: true }; // delay AI first gain
    this.nexusOwners = Array.from({ length: Config.ROWS }, () => Array(Config.COLS).fill(null));
    this.purchasedUnits = { [Config.TEAM.PLAYER]: new Set(), [Config.TEAM.AI]: new Set() };
    this.progression = window.Progression ? window.Progression.load() : { coins: 0, cards: {}, packResults: [] };
    this.matchResolved = false;
    this.menuOpen = true;
    this.isMultiplayer = false;
    this.playerTeam = Config.TEAM.PLAYER;
    this.shadowRealmView = false;
    this.previewBiomeCenter = null;
    this.teamDeaths = { [Config.TEAM.PLAYER]: 0, [Config.TEAM.AI]: 0 };
    this.draftedUnits = { [Config.TEAM.PLAYER]: new Set(), [Config.TEAM.AI]: new Set() };
    this.draft = {
      active: false,
      completed: false,
      mode: "menu",
      pickCount: 8,
      randomized: false,
      sequence: [],
      currentIndex: 0,
      firstTeam: Config.TEAM.PLAYER,
      secondTeam: Config.TEAM.AI
    };
    this.init();
  }

  init() {
    const [pPos, aPos] = this.pickMirroredBasePositions();
    this.addEntity(Entities.makeBase(Config.TEAM.PLAYER, pPos[0], pPos[1]));
    this.addEntity(Entities.makeBase(Config.TEAM.AI, aPos[0], aPos[1]));

    this.generateTerrain();

    this.renderEntities();
    this.ensureBoardRowLayout();
    this.attachEvents();
    this.updateHUD();
    this.updateUnitPanel(null);
    this.renderLog();
    this.ensureOverlay();
    this.renderBuyControls();
    this.repositionMPUI();
    this.setupDraftSystem();
    this.showMainMenu();
    this.saveProgressionState();
    
    if (window.Multiplayer) {
      window.Multiplayer.init(this);
    }
    // Shadow Realm toggle (top-right). Controlled by feature flag.
    if (Config.FEATURES && Config.FEATURES.shadowRealm) {
      if (!document.getElementById('shadow-toggle')) {
        const btn = document.createElement('button');
        btn.id = 'shadow-toggle';
        btn.className = 'shadow-toggle-btn';
        btn.title = 'Switch Realm View';
        // place next to the board (center-wrap), fallback to body
        const controlRail = document.getElementById('board-controls-rail');
        if (controlRail) controlRail.appendChild(btn);
        else document.body.appendChild(btn);
        btn.onclick = () => {
          this.shadowRealmView = !this.shadowRealmView;
          btn.classList.toggle('active', this.shadowRealmView);
          this.updateShadowToggleButton();
          this.applyBoardPerspective();
          this.renderEntities();
        };
        this.updateShadowToggleButton();
      }
    }
  }

  updateShadowToggleButton() {
    const btn = document.getElementById("shadow-toggle");
    if (!btn) return;
    if (this.shadowRealmView) {
      btn.textContent = "Normal Realm";
      btn.title = "Switch to Normal Realm View";
    } else {
      btn.textContent = "Shadow Realm";
      btn.title = "Switch to Shadow Realm View";
    }
  }

  repositionMPUI() {
    const mpUI = document.querySelector('.multiplayer-footer');
    const centerWrap = document.querySelector(".center-wrap");
    const boardRow = document.getElementById("board-row");
    if (mpUI && centerWrap && boardRow) {
      const shouldMove = mpUI.parentElement !== centerWrap || mpUI.previousElementSibling !== boardRow;
      if (shouldMove) centerWrap.insertBefore(mpUI, boardRow.nextSibling);
    }
  }

  getProgressionState() {
    if (!this.progression) this.progression = window.Progression ? window.Progression.load() : { coins: 0, cards: {}, packResults: [] };
    return this.progression;
  }

  saveProgressionState() {
    if (!window.Progression) return;
    this.progression = window.Progression.save(this.getProgressionState());
  }

  isCardOwned(type) {
    const state = this.getProgressionState();
    return !!(window.Progression && window.Progression.isOwned(state, type));
  }

  isUnitOwned(type) {
    return this.isCardOwned(type);
  }

  getOwnedCardTypes() {
    const state = this.getProgressionState();
    return window.Progression ? window.Progression.getOwnedCards(state) : [];
  }

  getOwnedUnitTypes() {
    const defs = window.Entities && window.Entities.unitDefs ? window.Entities.unitDefs : {};
    return this.getOwnedCardTypes().filter(type => !!defs[type]);
  }

  getOwnedBiomeTypes() {
    const biomeDefs = window.Entities && window.Entities.biomeDefs ? window.Entities.biomeDefs : {};
    return this.getOwnedCardTypes().filter(type => !!biomeDefs[type]);
  }

  getPvpCardShortfall() {
    return Math.max(0, this.minimumPvpCards - this.getOwnedCardTypes().length);
  }

  canStartPvpDraft() {
    return this.getPvpCardShortfall() === 0;
  }

  getCardDef(type) {
    const defs = window.Entities && window.Entities.unitDefs ? window.Entities.unitDefs : {};
    const biomeDefs = window.Entities && window.Entities.biomeDefs ? window.Entities.biomeDefs : {};
    return defs[type] || biomeDefs[type] || null;
  }

  getCardKind(type) {
    if (window.Progression && window.Progression.getCardKind) return window.Progression.getCardKind(type);
    return (window.Entities && window.Entities.biomeDefs && window.Entities.biomeDefs[type]) ? "biome" : "unit";
  }

  getCardRarity(type) {
    if (window.Progression && window.Progression.getCardRarity) return window.Progression.getCardRarity(type);
    return "common";
  }

  formatRarity(type) {
    const rarity = this.getCardRarity(type);
    return rarity.charAt(0).toUpperCase() + rarity.slice(1);
  }

  getCollectionCardTypes() {
    const defs = window.Entities && window.Entities.unitDefs ? window.Entities.unitDefs : {};
    const biomeDefs = window.Entities && window.Entities.biomeDefs ? window.Entities.biomeDefs : {};
    const cards = [
      ...Object.keys(defs).filter((type) => type !== "Skeleton" && !defs[type].hiddenFromShop),
      ...Object.keys(biomeDefs),
    ];
    return cards
      .sort((a, b) => {
        const aOwned = this.isCardOwned(a) ? 0 : 1;
        const bOwned = this.isCardOwned(b) ? 0 : 1;
        if (aOwned !== bOwned) return aOwned - bOwned;
        const aDef = this.getCardDef(a) || {};
        const bDef = this.getCardDef(b) || {};
        const rarityOrder = { common: 0, rare: 1, epic: 2, legendary: 3 };
        const rarityDiff = (rarityOrder[this.getCardRarity(a)] || 0) - (rarityOrder[this.getCardRarity(b)] || 0);
        if (rarityDiff !== 0) return rarityDiff;
        const costDiff = Number(aDef.cost || 0) - Number(bDef.cost || 0);
        if (costDiff !== 0) return costDiff;
        return String(a).localeCompare(String(b));
      });
  }

  getCollectionCardTypesForFilters() {
    const filters = this.collectionFilters || {};
    const query = String(filters.query || "").trim().toLowerCase();
    return this.getCollectionCardTypes().filter((type) => {
      const def = this.getCardDef(type);
      if (!def) return false;
      const owned = this.isCardOwned(type);
      if (filters.ownership === "owned" && !owned) return false;
      if (filters.ownership === "locked" && owned) return false;
      if (query && !String(type).toLowerCase().includes(query)) return false;
      if (filters.rarityValue && filters.rarityValue !== "all" && this.getCardRarity(type) !== filters.rarityValue) return false;
      if (filters.costValue && filters.costValue !== "all" && String(def.cost || 0) !== String(filters.costValue)) return false;
      if (filters.classValue && filters.classValue !== "all") {
        const cardClass = this.getCardKind(type) === "biome" ? "Biome" : this.getUnitClass(type);
        if (cardClass !== filters.classValue) return false;
      }
      return true;
    });
  }

  getCollectionCopyCount(type) {
    const state = this.getProgressionState();
    const entry = state.cards && state.cards[type];
    if (!entry || !entry.owned) return 0;
    return 1 + Math.max(0, Number(entry.duplicates || 0));
  }

  renderCollectionHTML() {
    const cards = this.getCollectionCardTypesForFilters();
    if (!cards.length) {
      return `<div class="menu-empty-state">No cards match those filters.</div>`;
    }
    return cards.map((type) => {
      const def = this.getCardDef(type);
      if (!def) return "";
      const owned = this.isCardOwned(type);
      const copies = this.getCollectionCopyCount(type);
      const duplicateCount = Math.max(0, copies - 1);
      const kind = this.getCardKind(type);
      const rarity = this.getCardRarity(type);
      const role = kind === "biome" ? (def.shopLabel || "Biome") : this.getShopRoleSummary(type);
      const cardClass = kind === "biome" ? "Biome" : this.getUnitClass(type);
      return `
        <div class="menu-card-tile rarity-${rarity}${owned ? "" : " locked"}" data-card-type="${type}">
          <div class="menu-card-head">
            <div class="menu-card-symbol ${this.getUnitVisualClass(type)}">${def.symbol}</div>
            <div>
              <div class="menu-card-name">${type}</div>
              <div class="menu-card-meta">${role} | Cost ${def.cost || 0}</div>
            </div>
          </div>
          <div class="menu-card-meta">${owned ? (def.ability || def.desc || "") : "Locked until opened from a pack."}</div>
          <div class="menu-card-badges">
            <span class="menu-badge">${owned ? `${copies} owned` : "Locked"}</span>
            <span class="menu-badge rarity ${rarity}">${this.formatRarity(type)}</span>
            <span class="menu-badge">${cardClass}</span>
            ${duplicateCount > 0 ? `<span class="menu-badge duplicate">${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"}</span>` : ""}
          </div>
        </div>
      `;
    }).join("");
  }

  renderMenuHomeHTML() {
    return `
      <section class="menu-section">
        <div class="menu-option-grid">
          <button id="menu-vs-ai" class="menu-option">
            <span class="menu-option-kicker">Battle</span>
            <strong>Player vs AI</strong>
            <small>Draft using your unlocked cards.</small>
          </button>
          <button id="menu-random-ai" class="menu-option">
            <span class="menu-option-kicker">Battle</span>
            <strong>Random vs AI</strong>
            <small>Random draft from your unlocked cards.</small>
          </button>
        </div>
      </section>
    `;
  }

  renderPackViewHTML() {
    const state = this.getProgressionState();
    const cost = window.Progression ? window.Progression.packCost : 60;
    const canOpen = (state.coins || 0) >= cost;
    return `
      <section class="menu-section pack-stage">
        <div class="pack-shell${this.packOpening ? " opening" : ""}">
          <div class="pack-stack" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
          <div>
            <div class="menu-card-title">Card Pack</div>
            <div class="pack-title">${canOpen ? "Ready to open" : "Need more coins"}</div>
            <div class="menu-copy">Packs can contain battle cards or biome cards. Rarity controls how often each card appears.</div>
            <button id="menu-open-pack" class="btn btn-primary menu-action" ${canOpen ? "" : "disabled"}>Open Pack (${cost})</button>
          </div>
        </div>
        <div class="menu-pack-result" id="menu-pack-result">${this.renderPackResultHTML()}</div>
      </section>
    `;
  }

  renderPackResultHTML() {
    const state = this.getProgressionState();
    if (!Array.isArray(state.packResults) || !state.packResults.length) {
      return "Open a pack to reveal cards here.";
    }
    return `
      <div class="pack-result-grid">
        ${state.packResults.map((reward) => {
          const def = this.getCardDef(reward.type);
          const rarity = reward.rarity || this.getCardRarity(reward.type);
          return `
            <div class="pack-result-card rarity-${rarity}">
              <div class="menu-card-symbol ${this.getUnitVisualClass(reward.type)}">${def ? def.symbol : "?"}</div>
              <strong>${reward.type}</strong>
              <span>${this.formatRarity(reward.type)} ${reward.duplicate ? "duplicate" : "new card"}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  renderCollectionViewHTML() {
    const cards = this.getCollectionCardTypes();
    const classes = Array.from(new Set(cards.map((type) => this.getCardKind(type) === "biome" ? "Biome" : this.getUnitClass(type)))).sort();
    const costs = Array.from(new Set(cards.map((type) => String((this.getCardDef(type) || {}).cost || 0)))).sort((a, b) => Number(a) - Number(b));
    const filters = this.collectionFilters || {};
    const optionHTML = (values, selected, allLabel) => [`<option value="all">${allLabel}</option>`]
      .concat(values.map(value => `<option value="${value}" ${selected === value ? "selected" : ""}>${String(value).charAt(0).toUpperCase() + String(value).slice(1)}</option>`))
      .join("");
    return `
      <section class="menu-section">
        <div class="menu-card-toolbar">
          <input id="menu-card-search" class="menu-search-input" type="search" placeholder="Search cards" value="${String(filters.query || "").replace(/"/g, "&quot;")}">
          <select id="menu-card-class" class="shop-filter-select">${optionHTML(classes, filters.classValue, "All Classes")}</select>
          <select id="menu-card-cost" class="shop-filter-select">${optionHTML(costs, filters.costValue, "All Costs")}</select>
          <select id="menu-card-rarity" class="shop-filter-select">
            ${optionHTML(["common", "rare", "epic", "legendary"], filters.rarityValue, "All Rarities")}
          </select>
          <select id="menu-card-ownership" class="shop-filter-select">
            <option value="owned" ${filters.ownership === "owned" ? "selected" : ""}>Owned</option>
            <option value="all" ${filters.ownership === "all" ? "selected" : ""}>All Cards</option>
            <option value="locked" ${filters.ownership === "locked" ? "selected" : ""}>Locked</option>
          </select>
        </div>
        <div id="menu-collection" class="menu-collection">${this.renderCollectionHTML()}</div>
      </section>
    `;
  }

  renderPvpViewHTML() {
    const mp = window.Multiplayer;
    const peerId = mp && mp.getPeerId ? mp.getPeerId() : "Loading...";
    const connected = mp && mp.isConnected ? mp.isConnected() : false;
    const canPvp = this.canStartPvpDraft();
    const shortfall = this.getPvpCardShortfall();
    return `
      <section class="menu-section pvp-lobby">
        <div class="pvp-code-panel">
          <div class="menu-card-title">Your Player Code</div>
          <button id="menu-copy-peer-id" class="pvp-code" ${peerId === "Loading..." ? "disabled" : ""}>${peerId}</button>
        </div>
        <div class="pvp-join-panel">
          <div class="menu-card-title">Join Player</div>
          <div class="pvp-join-row">
            <input id="menu-join-id-input" class="menu-search-input" type="text" placeholder="Enter player code" ${canPvp ? "" : "disabled"}>
            <button id="menu-connect-btn" class="btn btn-primary" ${connected || !canPvp ? "disabled" : ""}>${connected ? "Connected" : "Connect"}</button>
          </div>
        </div>
        <div class="menu-pack-result">${canPvp ? (connected ? "Connected. Draft will begin automatically." : "Share your code or enter a code to start a PvP draft.") : `PvP needs at least ${this.minimumPvpCards} owned cards. Open packs or win matches to unlock ${shortfall} more.`}</div>
      </section>
    `;
  }

  renderMainMenu(view) {
    const overlay = document.getElementById("menu-overlay");
    if (!overlay) return;
    this.menuOpen = true;
    if (view) this.menuView = view;
    const state = this.getProgressionState();
    const viewHTML = this.menuView === "collection"
      ? this.renderCollectionViewHTML()
      : (this.menuView === "packs" ? this.renderPackViewHTML() : (this.menuView === "pvp" ? this.renderPvpViewHTML() : this.renderMenuHomeHTML()));
    overlay.innerHTML = `
      <div class="menu-panel">
        <div class="menu-hero">
          <div>
            <div class="menu-kicker">Card Collection</div>
            <div class="menu-title">Menu</div>
            <div class="menu-copy">Spend coins on packs, inspect your cards, and launch a match mode.</div>
          </div>
          <div class="menu-resources">
            <div class="menu-resource">
              <span>Coins</span>
              <strong id="menu-coins">${state.coins || 0}</strong>
            </div>
            <div class="menu-resource">
              <span>Cards Owned</span>
              <strong id="menu-owned-count">${this.getOwnedCardTypes().length}</strong>
            </div>
          </div>
        </div>
        <div class="menu-tabs">
          <button class="menu-tab ${this.menuView === "home" ? "active" : ""}" data-menu-view="home">Home</button>
          <button class="menu-tab ${this.menuView === "packs" ? "active" : ""}" data-menu-view="packs">Packs</button>
          <button class="menu-tab ${this.menuView === "collection" ? "active" : ""}" data-menu-view="collection">Cards</button>
          <button class="menu-tab ${this.menuView === "pvp" ? "active" : ""}" data-menu-view="pvp">PvP</button>
        </div>
        ${viewHTML}
      </div>
    `;
    overlay.classList.remove("hidden");
    const vsAiBtn = document.getElementById("menu-vs-ai");
    const pvpBtn = document.getElementById("menu-pvp");
    const randomBtn = document.getElementById("menu-random-ai");
    const packBtn = document.getElementById("menu-open-pack");
    if (vsAiBtn) vsAiBtn.onclick = () => this.beginFromMenu("ai");
    if (randomBtn) randomBtn.onclick = () => this.beginFromMenu("ai", { randomizeTeams: true });
    if (pvpBtn) pvpBtn.onclick = () => this.renderMainMenu("pvp");
    if (packBtn) packBtn.onclick = () => this.openPackFromMenu();
    const cardsBtn = document.getElementById("menu-view-cards");
    if (cardsBtn) cardsBtn.onclick = () => this.renderMainMenu("collection");
    overlay.querySelectorAll("[data-menu-view]").forEach((btn) => {
      btn.onclick = () => this.renderMainMenu(btn.dataset.menuView || "home");
    });
    this.attachCollectionMenuEvents();
    this.attachPvpMenuEvents();
  }

  showMainMenu() {
    this.renderMainMenu();
  }

  attachCollectionMenuEvents() {
    const query = document.getElementById("menu-card-search");
    const classSelect = document.getElementById("menu-card-class");
    const costSelect = document.getElementById("menu-card-cost");
    const raritySelect = document.getElementById("menu-card-rarity");
    const ownershipSelect = document.getElementById("menu-card-ownership");
    const update = () => {
      this.collectionFilters = {
        query: query ? query.value : "",
        classValue: classSelect ? classSelect.value : "all",
        costValue: costSelect ? costSelect.value : "all",
        rarityValue: raritySelect ? raritySelect.value : "all",
        ownership: ownershipSelect ? ownershipSelect.value : "owned",
      };
      this.renderMainMenu("collection");
    };
    if (query) query.oninput = update;
    if (classSelect) classSelect.onchange = update;
    if (costSelect) costSelect.onchange = update;
    if (raritySelect) raritySelect.onchange = update;
    if (ownershipSelect) ownershipSelect.onchange = update;
    // Add card click handlers
    document.querySelectorAll(".menu-card-tile").forEach((tile) => {
      tile.onclick = (e) => {
        const type = tile.dataset.cardType;
        if (!type) return;
        const kind = this.getCardKind(type);
        if (kind === "biome") {
          const def = window.Entities.biomeDefs[type];
          if (def) {
            this.updateUnitPanel({
              kind: "biome_preview",
              type: type,
              symbol: def.symbol,
              desc: def.desc,
              cost: def.cost,
              duration: def.duration,
              color: def.color
            });
          }
        } else {
          const def = window.Entities.unitDefs[type];
          if (def) {
            this.updateUnitPanel({
              kind: "unit",
              team: Config.TEAM.PLAYER,
              type: type,
              row: 0,
              col: 0,
              hp: def.hp,
              maxHp: def.hp,
              dmg: def.dmg,
              range: def.range,
              move: def.move,
              symbol: def.symbol,
              ability: def.ability,
              rangePattern: def.rangePattern,
              movePattern: def.movePattern || "orthogonal",
              thrower: !!def.thrower,
              abilityCooldowns: {},
              runes: [],
              apMax: def.apMax || 2,
              ap: def.apMax || 2,
              cost: def.cost
            });
          }
        }
      };
    });
  }

  attachPvpMenuEvents() {
    const copyBtn = document.getElementById("menu-copy-peer-id");
    const joinInput = document.getElementById("menu-join-id-input");
    const connectBtn = document.getElementById("menu-connect-btn");
    if (copyBtn) {
      copyBtn.onclick = async () => {
        const code = copyBtn.textContent.trim();
        if (!code || code === "Loading...") return;
        try {
          await navigator.clipboard.writeText(code);
          copyBtn.textContent = "Copied";
          window.setTimeout(() => this.renderMainMenu("pvp"), 900);
        } catch {
          this.logEvent({ type: "error", msg: "Could not copy player code." });
        }
      };
    }
    if (connectBtn) {
      connectBtn.onclick = () => {
        if (!this.canStartPvpDraft()) {
          this.logEvent({ type: "error", msg: `PvP needs at least ${this.minimumPvpCards} owned cards.` });
          this.renderMainMenu("pvp");
          return;
        }
        const code = joinInput ? joinInput.value.trim() : "";
        if (!code) {
          this.logEvent({ type: "error", msg: "Enter a player code first." });
          return;
        }
        if (window.Multiplayer && window.Multiplayer.connectTo) {
          window.Multiplayer.connectTo(code);
          this.renderMainMenu("pvp");
        }
      };
    }
  }

  hideMainMenu() {
    const overlay = document.getElementById("menu-overlay");
    if (overlay) overlay.classList.add("hidden");
    this.menuOpen = false;
  }

  beginFromMenu(mode, options) {
    const opts = options || {};
    if (mode === "pvp") {
      this.renderMainMenu("pvp");
      return;
    }
    this.hideMainMenu();
    this.startDraft(mode, opts);
  }

  openPackFromMenu() {
    const state = this.getProgressionState();
    if (!window.Progression) return;
    const result = window.Progression.openPack(state);
    if (!result.success) {
      this.logEvent({ type: "error", msg: result.reason || "Could not open pack." });
      this.renderMainMenu("packs");
      return;
    }
    this.progression = state;
    this.saveProgressionState();
    const summary = result.rewards.map((reward) => {
      const def = window.Entities && window.Entities.unitDefs && window.Entities.unitDefs[reward.type];
      const label = def ? `${def.symbol} ${reward.type}` : reward.type;
      return `${label}${reward.duplicate ? " (duplicate)" : " (new)"}`;
    }).join(" • ");
    state.packResults = result.rewards;
    this.logEvent({ type: "status", msg: `Pack opened: ${summary}` });
    this.packOpening = true;
    this.renderMainMenu("packs");
    window.setTimeout(() => {
      this.packOpening = false;
      if (this.menuOpen && this.menuView === "packs") this.renderMainMenu("packs");
    }, 760);
    this.updateHUD();
  }

  awardVictoryCoins() {
    if (!window.Progression) return 0;
    const state = this.getProgressionState();
    const amount = window.Progression.grantWinCoins(state);
    this.progression = state;
    this.saveProgressionState();
    return amount;
  }

  isFriendlyTeam(team) {
    const localTeam = this.isMultiplayer ? this.playerTeam : Config.TEAM.PLAYER;
    return team === localTeam;
  }

  applyBoardPerspective() {
    const grid = document.getElementById("grid");
    if (!grid) return;
    grid.classList.toggle("board-flipped", this.isMultiplayer && this.playerTeam === Config.TEAM.AI);
    grid.classList.toggle("shadow-view", !!this.shadowRealmView);
  }

  getDisplayEntitySymbol(ent) {
    if (!ent) return "";
    if (ent.kind === "base" && this.isMultiplayer) {
      return this.isFriendlyTeam(ent.team) ? "🏰" : "⛩️";
    }
    return ent.symbol;
  }

  getDisplayCoords(row, col) {
    return [Config.ROWS - row, col + 1];
  }

  ensureBoardRowLayout() {
    const centerWrap = document.querySelector(".center-wrap");
    const grid = document.getElementById("grid");
    if (!centerWrap || !grid) return;
    let row = document.getElementById("board-row");
    if (!row) {
      row = document.createElement("div");
      row.id = "board-row";
      row.className = "board-row";
      grid.parentElement.insertBefore(row, grid);
    }
    let rail = document.getElementById("board-controls-rail");
    if (!rail) {
      rail = document.createElement("div");
      rail.id = "board-controls-rail";
      rail.className = "board-controls-rail";
      row.appendChild(rail);
    }
    if (grid.parentElement !== row) row.insertBefore(grid, rail);
  }

  getBiomeDistance(rowA, colA, rowB, colB) {
    const dr = rowA - rowB;
    const dc = colA - colB;
    return Math.hypot(dr, dc);
  }

  getUnitClassFor(unit) {
    return unit && unit.kind === "unit" ? this.getUnitClass(unit.type) : "Other";
  }

  canUnitWalkWater(unit) {
    const def = unit && window.Entities && window.Entities.unitDefs && window.Entities.unitDefs[unit.type];
    return !!(unit && (unit.waterWalker || (def && def.waterWalker)) && (Config.FEATURES && Config.FEATURES.marksmanWaterWalker));
  }

  isTerrainBlockingForUnit(terrain, unit) {
    return terrain === "wall" || terrain === "fortwall" || (terrain === "water" && !this.canUnitWalkWater(unit));
  }

  isTerrainPassableForUnit(terrain, unit) {
    return !this.isTerrainBlockingForUnit(terrain, unit);
  }

  doesTerrainBlockLine(terrain) {
    return terrain === "wall" || terrain === "fortwall";
  }

  isWithinBiomeRadius(rowA, colA, rowB, colB, radius) {
    return this.getBiomeDistance(rowA, colA, rowB, colB) <= (radius + 0.35);
  }

  getEffectiveApMax(unit) {
    if (!unit || unit.kind !== "unit") return unit && unit.apMax ? unit.apMax : 0;
    return Math.max(0, (unit.apMax || 0) + (unit.apMaxBonus || 0));
  }

  doesBiomeAffectUnit(def, unit) {
    if (!def || !unit || unit.kind !== "unit") return false;
    return !def.filter || this.getUnitClass(unit.type) === def.filter;
  }

  toBiomeTint(color, alpha) {
    if (!color) return `rgba(99, 102, 241, ${alpha})`;
    if (color.startsWith("#")) {
      const hex = color.slice(1);
      const raw = hex.length === 3
        ? hex.split("").map((ch) => ch + ch).join("")
        : hex;
      const num = Number.parseInt(raw, 16);
      if (!Number.isNaN(num)) {
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
    if (color.startsWith("rgb(")) {
      const inner = color.slice(4, -1);
      return `rgba(${inner}, ${alpha})`;
    }
    if (color.startsWith("rgba(")) {
      return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
    }
    return color;
  }

  getShopRoleSummary(type) {
    const def = window.Entities && window.Entities.unitDefs && window.Entities.unitDefs[type];
    if (def && def.role) return def.role;
    const roles = {
      Warrior: "Frontline Bruiser",
      Archer: "Long-Range Striker",
      Mage: "Burst Caster",
      Paladin: "Shield Anchor",
      Berserker: "Aggro Diver",
      Builder: "Tactical Support",
      Alchemist: "Buff Support",
      Rogue: "Swift Assassin",
      Cleric: "Healing Support",
      Firecaller: "Area Denial",
      Magnet: "Pull Control",
      Avenger: "Scaling Fighter",
      Necromancer: "Minion Summoner",
      Hex: "Debuff Caster",
      Sludge: "Zone Trapper",
      Druid: "Adaptive Support",
      Sentinel: "Frontline Wall",
      Ballista: "Siege Artillery",
      Watchtower: "Long-Range Defense",
      Sanctum: "Healing Support",
      Forge: "Aegis Support",
      Tidewalker: "Water Striker",
      Shade: "Shadow Assassin",
      Bulwark: "Ally Protector",
      Stalker: "Ambusher",
      Slicer: "Tank Killer",
      "Bounty Hunter": "High Risk Carry",
      Silencer: "Attack Lockdown",
      Geomancer: "Board Shifter",
      Plague: "Contagion Control",
    };
    return roles[type] || "Battle Unit";
  }

  getUnitClass(type) {
    const def = window.Entities && window.Entities.unitDefs && window.Entities.unitDefs[type];
    if (def && def.class) return def.class;
    if (def && (def.thrower || String(def.rangePattern || "").toLowerCase() === "thrower")) return "Artillery";
    const classes = {
      // Artillery units
      Alchemist: "Artillery",
      Ballista: "Artillery",
      // Assassin units
      Rogue: "Assassin",
      Shade: "Assassin",
      Stalker: "Assassin",
      // Breaker units
      Slicer: "Breaker",
      // Control units
      Hex: "Control",
      Mage: "Control",
      Necromancer: "Control",
      // Disruptor units
      Firecaller: "Disruptor",
      Magnet: "Disruptor",
      Silencer: "Disruptor",
      Sludge: "Disruptor",
      Plague: "Control",
      // Fighter units
      Avenger: "Fighter",
      Berserker: "Fighter",
      Druid: "Fighter",
      Warrior: "Fighter",
      // Marksman units
      Archer: "Marksman",
      "Bounty Hunter": "Marksman",
      Tidewalker: "Marksman",
      // Support units
      Builder: "Support",
      Cleric: "Support",
      Geomancer: "Support",
      Skeleton: "Support",
      // Tank units
      Bulwark: "Tank",
      Paladin: "Tank",
      Sentinel: "Tank",
    };
    return classes[type] || "Other";
  }

  canActivateAbility(unit, def) {
    if (!unit || !def || unit.kind !== "unit") return false;
    if (!this.entities.includes(unit)) return false;
    if ((unit.ap || 0) < 1) return false;
    const cooldown = (unit.abilityCooldowns && unit.abilityCooldowns[def.name]) || 0;
    return cooldown === 0;
  }

  cancelAbilityMode() {
    this.abilityMode = null;
    this.board.clearMarks();
    this.renderEntities();
    this.updateHUD();
    this.updateUnitPanel(this.selected && this.entities.includes(this.selected) ? this.selected : null);
    if (this.selected && this.selected.kind === "unit" && this.entities.includes(this.selected)) {
      this.showActionHints(this.selected);
    }
  }

  addEntity(ent) {
    if (!ent) return;
    if (ent.kind === "unit" && ent.type === "Skeleton") {
      if (!(ent.summonedBy === "Necromancer")) {
        this.logEvent({ type: "error", msg: "Blocked spawn: Skeleton can only be summoned by Necromancer" });
        return;
      }
    }
    this.entities.push(ent);
    if (ent.row != null && ent.col != null) {
      this.occupants[ent.row][ent.col] = ent;
    }
  }

  renderEntities() {
    this.applyBoardPerspective();
    this.board.forEachCell(cell => {
      cell.innerHTML = "";
      cell.style.borderColor = "";
      cell.classList.remove(
        "terrain-water","terrain-wall","terrain-bridge","terrain-fortwall","terrain-nexus","terrain-nexus-player","terrain-nexus-ai",
          "hazard-fire","hazard-sludge","construction-site","biome-player","biome-ai",
          "unit-player","unit-ai","status-hex","status-stuck","token-player","token-ai","in-shadow",
        "move-hl","attack-hl","heal-hl","ability-hl","attack-range-hl","ability-range-max","selected-empty","selected-target-hl","buy-hl"
      );
    });
    // Terrain tokens
    for (let r = 0; r < Config.ROWS; r++) {
      for (let c = 0; c < Config.COLS; c++) {
        const t = this.terrain[r][c];
        if (!t) continue;
        const cell = this.board.getCell(r, c);
        if (!cell) continue;
        if (t === "water") {
          cell.classList.add("terrain-water");
          const icon = document.createElement("span");
          icon.className = "terrain-icon";
          icon.textContent = "🌊";
          cell.appendChild(icon);
        }
        else if (t === "wall") cell.classList.add("terrain-wall");
        else if (t === "fortwall") cell.classList.add("terrain-fortwall");
        else if (t === "bridge") cell.classList.add("terrain-bridge");
        else if (t === "nexus") {
          cell.classList.add("terrain-nexus");
          const owner = this.nexusOwners[r][c];
          if (owner === Config.TEAM.PLAYER) cell.classList.add("terrain-nexus-player");
          else if (owner === Config.TEAM.AI) cell.classList.add("terrain-nexus-ai");
          const icon = document.createElement("span");
          icon.className = `nexus-icon ${owner == null ? "nexus-neutral" : (owner === Config.TEAM.PLAYER ? "nexus-player" : "nexus-ai")}`;
          icon.textContent = "🔷"; // Larger blue diamond shape
          cell.appendChild(icon);
        }
        if (t === "wall" || t === "bridge" || t === "fortwall") {
          const terrainIcon = document.createElement("span");
          terrainIcon.className = "terrain-icon";
          terrainIcon.textContent = t === "wall" ? "🧱" : (t === "bridge" ? "🌉" : "⬜");
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
        if (h.kind === "fire") {
          cell.classList.add("hazard-fire");
          const icon = document.createElement("span");
          icon.className = "terrain-icon";
          icon.textContent = "🔥";
          cell.appendChild(icon);
          const badge = document.createElement("span");
          badge.className = "status-badge";
          badge.textContent = `${h.turns}T`;
          cell.appendChild(badge);
        } else if (h.kind === "sludge") {
          cell.classList.add("hazard-sludge");
          const icon = document.createElement("span");
          icon.className = "terrain-icon";
          icon.textContent = "🫧";
          cell.appendChild(icon);
          const badge = document.createElement("span");
          badge.className = "status-badge";
          badge.textContent = `${h.turns}T`;
          cell.appendChild(badge);
        }
      }
    }

    // Construction Sites
    for (let r = 0; r < Config.ROWS; r++) {
      for (let c = 0; c < Config.COLS; c++) {
        const cs = this.constructionSites[r][c];
        if (!cs) continue;
        const cell = this.board.getCell(r, c);
        if (!cell) continue;
        cell.classList.add("construction-site");
        const span = document.createElement("span");
        span.className = "terrain-icon construction-icon";
        span.textContent = "🏗️";
        cell.appendChild(span);
        const badge = document.createElement("span");
        badge.className = "status-badge";
        badge.textContent = `${cs.turns}T`;
        cell.appendChild(badge);
      }
    }

    // Biomes
    for (const biome of this.biomes) {
      if (!biome) continue;
      const radius = biome.radius || 0;
      const bDef = window.Entities.biomeDefs[biome.type];
      const color = bDef ? bDef.color : (this.isFriendlyTeam(biome.team) ? "rgba(59, 130, 246, 0.4)" : "rgba(239, 68, 68, 0.4)");
      
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const rr = biome.r + dr, cc = biome.c + dc;
          if (!this.inBounds(rr, cc)) continue;
          if (!this.isWithinBiomeRadius(rr, cc, biome.r, biome.c, radius)) continue;
          const cell = this.board.getCell(rr, cc);
          if (!cell) continue;
          
          cell.style.backgroundColor = this.toBiomeTint(color, 0.2);
          cell.classList.add(this.isFriendlyTeam(biome.team) ? "biome-player" : "biome-ai");
          
          // Only show symbol on the center tile
          if (dr === 0 && dc === 0) {
            const span = document.createElement("span");
            span.className = "biome-icon";
            span.textContent = biome.symbol;
            cell.appendChild(span);
            const badge = document.createElement("span");
            badge.className = "status-badge";
            badge.textContent = `${biome.duration}T`;
            cell.appendChild(badge);
          }
        }
      }
    }

    // Units and bases
    const viewerTeam = this.isMultiplayer ? this.playerTeam : Config.TEAM.PLAYER;
    const viewerHasShadow = this.entities.some(e => e.team === viewerTeam && e.inShadowRealm);
    for (const ent of this.entities) {
      if (!ent || ent.row == null || ent.col == null) continue;
      const cell = this.board.getCell(ent.row, ent.col);
      if (!cell) continue;

      // Shadow visibility: skip entities in shadow that the viewer cannot see
      if (ent.inShadowRealm) {
        // In shadow-view the viewer still must have shadow presence to see the realm
        if (!this.isEntityVisibleToUnit(null, ent)) continue;
      }
      // If Shadow Realm view is toggled, hide non-shadow tiles/entities (except bases — keep bases visible for orientation)
      if (this.shadowRealmView && !ent.inShadowRealm && ent.kind !== 'base') continue;

      // Mark base entities for optional special styling; units keep the unit-player/unit-ai classes
      if (ent.kind === 'base') cell.classList.add('entity-base');
      cell.classList.add(this.isFriendlyTeam(ent.team) ? "unit-player" : "unit-ai");

      const span = document.createElement("span");
      span.className = `token ${this.isFriendlyTeam(ent.team) ? "token-player" : "token-ai"} ${ent.kind === "unit" ? this.getUnitVisualClass(ent.type) : "unit-visual-base"}`;
      span.textContent = this.getDisplayEntitySymbol(ent);
      // Mark and style shadow units when visible
      if (ent.inShadowRealm) {
        cell.classList.add('in-shadow');
        span.classList.add('shadow-token');
      }
      cell.appendChild(span);

      // Water Walker visual indicator (active when standing on water)
      try {
        const terr = this.terrain[ent.row] && this.terrain[ent.row][ent.col];
        const unitDef = (ent.kind === "unit" && window.Entities && window.Entities.unitDefs && window.Entities.unitDefs[ent.type]) || null;
        const isWaterWalker = !!(ent.waterWalker || (unitDef && unitDef.waterWalker));
        if (isWaterWalker && terr === "water") {
          cell.classList.add('water-walker-active');
          const wBadge = document.createElement('span');
          wBadge.className = 'water-walker-badge';
          wBadge.textContent = '💧';
          cell.appendChild(wBadge);
        }
      } catch(e) {}

      // Biome eligibility indicator (existing biomes and preview)
      let eligible = false;
      for (const b of this.biomes) {
        if (!b) continue;
        const bDef = window.Entities && window.Entities.biomeDefs && window.Entities.biomeDefs[b.type];
        if (!bDef) continue;
        if (this.isWithinBiomeRadius(ent.row, ent.col, b.r, b.c, b.radius || 0) && b.team === ent.team) {
          if (this.doesBiomeAffectUnit(bDef, ent)) {
            eligible = true; break;
          }
        }
      }
      if (!eligible && this.biomeSelection && this.previewBiomeCenter) {
        const pbDef = window.Entities && window.Entities.biomeDefs && window.Entities.biomeDefs[this.biomeSelection];
        if (pbDef && this.doesBiomeAffectUnit(pbDef, ent)) {
          if (this.isWithinBiomeRadius(ent.row, ent.col, this.previewBiomeCenter[0], this.previewBiomeCenter[1], pbDef.radius || 0)) eligible = true;
        }
      }
      if (eligible) {
        cell.classList.add('biome-eligible');
        const bBadge = document.createElement('span');
        bBadge.className = 'biome-eligible-badge';
        bBadge.textContent = '★';
        cell.appendChild(bBadge);
      }

      if (ent.hexMarked) {
        const badge = document.createElement("span");
        badge.className = "status-badge hex-badge";
      badge.textContent = "✳";
        cell.appendChild(badge);
        cell.classList.add("status-hex");
    }
      if (ent.diseased && (ent.diseasedTurns || 0) > 0) {
        const badge = document.createElement("span");
        badge.className = "status-badge";
        badge.textContent = "☣";
        cell.appendChild(badge);
      }
      if (ent.stuck) {
        const badge = document.createElement("span");
        badge.className = "status-badge stuck-badge";
      badge.textContent = "◎";
        cell.appendChild(badge);
        cell.classList.add("status-stuck");
    }
    }
  }

  getUnitVisualClass(type) {
    return `unit-visual-${String(type || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
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
      const r = Number(target.dataset.row);
      const c = Number(target.dataset.col);

      if (this.abilityMode && this.abilityMode.def && (this.abilityMode.def.rangePattern || "").toLowerCase() === "select") {
        const selectedCount = ((this.abilityMode && this.abilityMode.selectedTiles) || []).length;
        const previewKey = `ability:${this.abilityMode.def.name}:${r},${c}:${selectedCount}`;
        if (this.hoverPreviewKey === previewKey) return;
        this.hoverPreviewKey = previewKey;
        this.board.clearMarks();
        const u = this.abilityMode.unit;
        this.board.markSelected(u.row, u.col);
        const maxTargets = (this.abilityMode && this.abilityMode.targets) || [];
        if (maxTargets.length) this.board.markPositions(maxTargets, "ability-range-max");
        const selectedTiles = (this.abilityMode && this.abilityMode.selectedTiles) || [];
        if (selectedTiles.length) this.board.markPositions(selectedTiles, "selected-target-hl");
        if (maxTargets.some(([tr, tc]) => tr === r && tc === c)) {
          const area = [];
          const size = Math.max(1, Number(this.abilityMode.def.previewSize) || ((this.abilityMode.def.name === "Construct") ? 1 : 3));
          const half = Math.floor(size / 2);
          for (let dr = -half; dr <= (size - half - 1); dr++) {
            for (let dc = -half; dc <= (size - half - 1); dc++) {
              const rr = r + dr, cc = c + dc;
              if (this.inBounds(rr, cc)) area.push([rr, cc]);
            }
          }
          this.board.markPositions(area, "ability-hl");
        }
      } else if (this.biomeSelection) {
        const biomeDef = window.Entities.biomeDefs[this.biomeSelection];
        if (biomeDef) {
          const previewKey = `biome:${this.biomeSelection}:${r},${c}`;
          if (this.hoverPreviewKey === previewKey) return;
          this.hoverPreviewKey = previewKey;
          const radius = biomeDef.radius || 0;
          const area = [];
          for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
              const rr = r + dr, cc = c + dc;
              if (this.inBounds(rr, cc) && this.isWithinBiomeRadius(rr, cc, r, c, radius)) area.push([rr, cc]);
            }
          }
          // track preview center so UI can mark eligible units
          this.previewBiomeCenter = [r, c];
          this.board.clearMarks();
          // Re-mark available spots
          const pos = [];
          const canAfford = this.energy[this.isMultiplayer ? this.playerTeam : Config.TEAM.PLAYER] >= biomeDef.cost;
          if (canAfford) {
            for (let ar = 0; ar < Config.ROWS; ar++) {
              for (let ac = 0; ac < Config.COLS; ac++) {
                if (this.terrain[ar][ac] !== "nexus") pos.push([ar, ac]);
              }
            }
            this.board.markPositions(pos, "buy-hl");
          }
          // Mark preview area
          this.board.markPositions(area, "ability-hl");
        }
      } else {
        // clear preview center when not previewing a biome
        this.previewBiomeCenter = null;
        this.hoverPreviewKey = "";
      }
    });

    this.board.forEachCell(cell => {
      // Cell specific events removed in favor of grid-level mousemove for better performance
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
      
      if (this.isMultiplayer) {
        const isMyTurn = this.turn === this.playerTeam;
        turnEl.textContent = isMyTurn ? "YOUR TURN" : "ENEMY TURN";
        turnEl.className = isMyTurn ? "turn turn-player" : "turn turn-enemy";
      } else {
        const isPlayerTurn = this.turn === Config.TEAM.PLAYER;
        turnEl.textContent = isPlayerTurn ? "TURN: PLAYER" : "TURN: AI";
        turnEl.className = isPlayerTurn ? "turn turn-player" : "turn turn-enemy";
      }
      
      const pEl = document.getElementById("energy-player");
      const aEl = document.getElementById("energy-ai");
      
      let pLabel = "Player";
      let aLabel = "AI";
      let pValue = p;
      let aValue = a;
      if (this.isMultiplayer) {
        pLabel = "YOU";
        aLabel = "ENEMY";
        pValue = this.energy[this.playerTeam];
        aValue = this.energy[this.playerTeam === Config.TEAM.PLAYER ? Config.TEAM.AI : Config.TEAM.PLAYER];
      }
      
      const pTeam = this.isMultiplayer ? this.playerTeam : Config.TEAM.PLAYER;
      const aTeam = this.isMultiplayer
        ? (this.playerTeam === Config.TEAM.PLAYER ? Config.TEAM.AI : Config.TEAM.PLAYER)
        : Config.TEAM.AI;
      const pNext = this.getUpcomingGoldGain(pTeam);
      const aNext = this.getUpcomingGoldGain(aTeam);
      if (pEl) pEl.textContent = `${pLabel}: 🪙 ${pValue} (+${pNext} next)`;
      if (aEl) aEl.textContent = `${aLabel}: 🪙 ${aValue} (+${aNext} next)`;
      const pLossEl = document.getElementById("losses-player");
      const aLossEl = document.getElementById("losses-ai");
      const coinsEl = document.getElementById("coins-player");
      if (pLossEl) pLossEl.textContent = `${pLabel} Losses: ${this.teamDeaths[pTeam] || 0}`;
      if (aLossEl) aLossEl.textContent = `${aLabel} Losses: ${this.teamDeaths[aTeam] || 0}`;
      if (coinsEl) coinsEl.textContent = `Coins: ${this.getProgressionState().coins || 0}`;
    }
    const cancelBtn = document.getElementById("cancel-ability-btn");
    if (cancelBtn) {
      const active = !!this.abilityMode;
      cancelBtn.style.display = active ? "inline-block" : "none";
      cancelBtn.onclick = active ? () => this.cancelAbilityMode() : null;
    }
  }

  getHazardDescriptor(hazard) {
    if (!hazard) return null;
    if (hazard.kind === "fire") {
      return {
        icon: "🔥",
        name: "Blazing Ground",
        desc: "A burning hazard that scorches units at the start of their turn.",
        notes: [["Hazard", "Fire"], ["Duration", `${hazard.turns} turn${hazard.turns === 1 ? "" : "s"}`]],
        subtype: "fire"
      };
    }
    if (hazard.kind === "sludge") {
      return {
        icon: "🫧",
        name: "Mire",
        desc: "A sludge trap that locks units in place until it fades.",
        notes: [["Hazard", "Sludge Trap"], ["Duration", `${hazard.turns} turn${hazard.turns === 1 ? "" : "s"}`], ["Effect", "Cannot move out"]],
        subtype: "sludge"
      };
    }
    return null;
  }

  getTileDescriptor(row, col) {
    const terrain = this.terrain[row][col];
    const hazard = this.hazards[row][col];
    const terrainInfo = {
      water: { icon: "🌊", name: "Water", desc: "Water blocks most units. Builders can turn it into a bridge.", notes: [["Movement", "Blocked"], ["Builder", "Can bridge"]], subtype: "water" },
      wall: { icon: "🧱", name: "Wall", desc: "A basic wall tile that blocks movement and line paths.", notes: [["Movement", "Blocked"], ["Builder", "Can clear"]], subtype: "wall" },
      fortwall: { icon: "⬜", name: "Fortwall", desc: "A reinforced wall built by the Builder. It blocks movement.", notes: [["Movement", "Blocked"], ["Builder", "Can clear"]], subtype: "fortwall" },
      bridge: { icon: "🌉", name: "Bridge", desc: "A passable bridge over water created by construction.", notes: [["Movement", "Passable"], ["Builder", "Can revert"]], subtype: "bridge" },
      nexus: { icon: "💠", name: "Nexus", desc: "Standing here captures the nexus for your team.", notes: [["Effect", "Capture point"]], subtype: "nexus" },
      grass: { icon: "🟩", name: "Open Ground", desc: "Open ground with no special effect.", notes: [["Movement", "Passable"], ["Effect", "None"]], subtype: "grass" }
    };
    const base = terrainInfo[terrain || "grass"] || terrainInfo.grass;
    const hazardInfo = this.getHazardDescriptor(hazard);
    if (!hazardInfo) return base;
    return {
      icon: hazardInfo.icon,
      name: hazardInfo.name,
      desc: hazardInfo.desc,
      notes: [...hazardInfo.notes, ["Ground", base.name]],
      subtype: hazardInfo.subtype
    };
  }

  formatPatternLabel(pattern) {
    const key = String(pattern || "").toLowerCase();
    if (key === "artillery") return "artillery";
    if (key === "thrower") return "thrower";
    return String(pattern || "").replace(/_/g, " ");
  }

  hideRuneDetails() {
    if (this.runeTooltipHideTimer) {
      clearTimeout(this.runeTooltipHideTimer);
      this.runeTooltipHideTimer = null;
    }
    if (this.runeTooltipCleanup) {
      document.removeEventListener("click", this.runeTooltipCleanup, true);
      this.runeTooltipCleanup = null;
    }
    if (this.runeTooltip) {
      this.runeTooltip.remove();
      this.runeTooltip = null;
    }
  }

  showRuneDetails(rune, anchorEl) {
    if (!rune || !anchorEl) return;
    this.hideRuneDetails();
    const title = `${rune.name || "Rune"}`;
    const progress = this.getRuneProgressLabel(rune);
    const tip = document.createElement("div");
    tip.className = "rune-tooltip";
    tip.innerHTML = `
      <div class="rune-tooltip-name">${title}</div>
      <div class="rune-tooltip-desc">${rune.desc}</div>
      <div class="rune-tooltip-meta">${progress}</div>
    `;
    document.body.appendChild(tip);
    const rect = anchorEl.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const left = Math.min(window.innerWidth - tipRect.width - 12, Math.max(12, rect.left + rect.width / 2 - tipRect.width / 2));
    const top = rect.top - tipRect.height - 10 >= 12
      ? rect.top - tipRect.height - 10
      : rect.bottom + 10;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    const onDocClick = (e) => {
      if (tip.contains(e.target) || anchorEl.contains(e.target)) return;
      this.hideRuneDetails();
    };
    const scheduleHide = () => {
      if (this.runeTooltipHideTimer) clearTimeout(this.runeTooltipHideTimer);
      this.runeTooltipHideTimer = setTimeout(() => {
        const hoveringTrigger = anchorEl.matches(":hover");
        const hoveringTip = tip.matches(":hover");
        if (!hoveringTrigger && !hoveringTip) this.hideRuneDetails();
      }, 80);
    };
    tip.addEventListener("mouseenter", () => {
      if (this.runeTooltipHideTimer) {
        clearTimeout(this.runeTooltipHideTimer);
        this.runeTooltipHideTimer = null;
      }
    });
    tip.addEventListener("mouseleave", scheduleHide);
    anchorEl.onmouseleave = scheduleHide;
    this.runeTooltip = tip;
    this.runeTooltipCleanup = onDocClick;
    setTimeout(() => document.addEventListener("click", onDocClick, true), 0);
  }

  getUnitStatusEntries(unit) {
    if (!unit || unit.kind !== "unit") return [];
    const statuses = [];
    const push = (label, turns) => {
      const count = Number(turns || 0);
      if (count > 0) statuses.push(`${label} (${count})`);
    };
    if (unit.isBeast && (unit.beastTurns || 0) > 0) push("Beast Form", Math.max(1, unit.beastTurns || 0));
    if (unit.hexMarked && (unit.hexTurns || 0) > 0) push("Hexed", Math.max(1, unit.hexTurns || 0));
    if (unit.guardTurns && unit.guardTurns > 0) {
      const gv = (unit.guardValue != null && unit.guardValue !== 0) ? unit.guardValue : 10;
      const label = (gv > 0 && gv < 1) ? `Guarded (-${Math.round(gv * 100)}%)` : `Guarded (-${gv} dmg)`;
      statuses.push(`${label} (${unit.guardTurns})`);
    }
    if (unit.inShadowRealm && (unit.shadowTurns || 0) > 0) {
      statuses.push(`Shadowed (${unit.shadowTurns})`);
    }
    if (unit.siegeTurns && unit.siegeTurns > 0) push("Sieged", unit.siegeTurns);
    if (unit.burnTurns && unit.burnTurns > 0) push("Burning", unit.burnTurns);
    if (unit.diseased && (unit.diseasedTurns || 0) > 0) push("Diseased", unit.diseasedTurns);
    if (unit.stunnedTurns && unit.stunnedTurns > 0) push("Stunned", unit.stunnedTurns);
    if (unit.silencedTurns && unit.silencedTurns > 0) push("Silenced", unit.silencedTurns);
    if ((unit.apMaxBonus || 0) > 0) statuses.push(`Sanctified (+${unit.apMaxBonus} AP Max)`);
    const runeRegen = this.getRuneTurnStartHeal(unit);
    if (runeRegen > 0) statuses.push(`Regenerating (+${runeRegen} HP/turn)`);
    if (unit.type === "Avenger") {
      const pendingDeaths = this.getAvengerPendingDeaths(unit);
      if (pendingDeaths > 0) statuses.push(`Vengeance Ready (+${pendingDeaths * 10} dmg, +${pendingDeaths * 10} HP)`);
      statuses.push(`Fallen Allies (${(this.teamDeaths && this.teamDeaths[unit.team]) || 0})`);
    }
    if (unit.abilityCooldowns) {
      for (const [abilityName, turns] of Object.entries(unit.abilityCooldowns)) {
        if ((turns || 0) > 0) statuses.push(`${abilityName} CD (${turns})`);
      }
    }
    if (unit.stuck) {
      const hazard = this.hazards && this.hazards[unit.row] && this.hazards[unit.row][unit.col];
      const turns = hazard && hazard.kind === "sludge" ? hazard.turns : 0;
      statuses.push(turns > 0 ? `Trapped (${turns})` : `Trapped (Mire)`);
    }

    return statuses;
  }

  getAbilityCooldown(unit, abilityName) {
    const def = window.Entities && window.Entities.unitDefs && window.Entities.unitDefs[unit && unit.type];
    const base = (def && def.cooldowns && def.cooldowns[abilityName]) || 2;
    const mod = (unit && unit.cooldownMods && unit.cooldownMods[abilityName] || 0) + (unit && unit.globalCooldownMod || 0);
    return Math.max(0, base + mod);
  }

  getAbilityDetailLines(unit, def) {
    const cooldown = this.getAbilityCooldown(unit, def.name);
    const range = typeof def.range === "number" ? def.range : unit.range;
    const lines = [];
    lines.push(["Cooldown", `${cooldown} turn${cooldown === 1 ? "" : "s"}`]);
    if (typeof def.damage === "number") lines.push(["Damage", `${def.damage}`]);
    if (typeof def.heal === "number") lines.push(["Heal", `${def.heal}`]);
    if (typeof def.duration === "number") lines.push(["Duration", `${def.duration} turn${def.duration === 1 ? "" : "s"}`]);
    if (def.requiresTarget !== false && typeof range === "number") lines.push(["Range", `${range}`]);
    if (def.rangePattern) lines.push(["Pattern", this.formatPatternLabel(def.rangePattern)]);
    if (def.piercing) lines.push(["Piercing", def.piercingLabel || "Hits each unit in the line"]);
    if (def.affectsAll) lines.push(["Area", def.area || "All units in the target area"]);
    else if (def.multiSelect) lines.push(["Targets", `Choose up to ${def.maxTargets || 1}`]);
    else if (def.requiresTarget) lines.push(["Targets", "Single target tile"]);
    else lines.push(["Targets", "Self"]);
    if (Array.isArray(def.statPreview)) {
      for (const [label, value] of def.statPreview) lines.push([label, value]);
    }
    if (def.note) lines.push(["Note", def.note]);
    return lines;
  }

  getRuneDefById(runeId) {
    return (window.RuneDefs || []).find(r => r.id === runeId) || null;
  }

  createOwnedRune(runeDef) {
    if (!runeDef) return null;
    return {
      id: runeDef.id,
      name: runeDef.name,
      desc: runeDef.desc,
    };
  }

  syncOwnedRunePresentation(ownedRune, runeDef) {
    if (!ownedRune || !runeDef) return ownedRune;
    ownedRune.name = runeDef.name;
    ownedRune.desc = runeDef.desc;
    return ownedRune;
  }

  getRuneProgressLabel(ownedRune) {
    return ownedRune ? "Active" : "";
  }

  getRuneTurnStartHeal(unit) {
    if (!unit || !Array.isArray(unit.runes)) return 0;
    let total = 0;
    for (const rune of unit.runes) {
      const runeDef = this.getRuneDefById(rune.id);
      total += Number((runeDef && runeDef.healPerTurn) || 0);
    }
    return total;
  }

  applyRuneTurnStartEffectsForTeam(team) {
    for (const unit of this.entities) {
      if (!unit || unit.kind !== "unit" || unit.team !== team || !Array.isArray(unit.runes)) continue;
      let healed = false;
      for (const ownedRune of unit.runes) {
        const runeDef = this.getRuneDefById(ownedRune.id);
        if (!runeDef || typeof runeDef.onTurnStart !== "function") continue;
        const beforeHp = unit.hp;
        runeDef.onTurnStart(unit, this);
        healed = healed || unit.hp > beforeHp;
      }
      if (healed) {
        const cell = this.board.getCell(unit.row, unit.col);
        if (cell) {
          cell.classList.add("heal-anim");
          setTimeout(() => cell.classList.remove("heal-anim"), 640);
        }
      }
    }
  }

  getAvengerPendingDeaths(unit) {
    if (!unit || unit.type !== "Avenger") return 0;
    const total = (this.teamDeaths && this.teamDeaths[unit.team]) || 0;
    return Math.max(0, total - Number(unit.avengerConsumedDeaths || 0));
  }

  infectUnit(unit, duration, sourceTeam) {
    if (!unit || unit.kind !== "unit" || unit.hp <= 0) return false;
    unit.diseased = true;
    unit.diseasedTurns = Math.max(Number(unit.diseasedTurns || 0), Number(duration || 0));
    if (sourceTeam) unit.diseaseSourceTeam = sourceTeam;
    return true;
  }

  spreadDiseaseFromUnit(unit, duration) {
    if (!unit || unit.kind !== "unit") return 0;
    let spreadCount = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = unit.row + dr;
        const c = unit.col + dc;
        if (!this.inBounds(r, c)) continue;
        const occ = this.occupants[r][c];
        if (!occ || occ.kind !== "unit" || occ.hp <= 0) continue;
        if (this.infectUnit(occ, duration, unit.diseaseSourceTeam || unit.team)) spreadCount++;
      }
    }
    return spreadCount;
  }

  applyDiseaseEffectsForTeam(team) {
    const diseased = this.entities.filter(ent => ent && ent.kind === "unit" && ent.team === team && ent.diseased && (ent.diseasedTurns || 0) > 0);
    if (!diseased.length) return;
    for (const unit of diseased) this.spreadDiseaseFromUnit(unit, 2);
    for (const unit of diseased) {
      if (!this.entities.includes(unit)) continue;
      this.applyDamage(unit, 10, null);
      if (!this.entities.includes(unit)) continue;
      unit.diseasedTurns = Math.max(0, (unit.diseasedTurns || 0) - 1);
      if (unit.diseasedTurns <= 0) {
        unit.diseased = false;
        unit.diseaseSourceTeam = null;
      }
    }
  }

  advanceRuneProgressForTeam(team) {}

  updateUnitPanel(ent) {
    const iconEl = document.getElementById("unit-icon");
    const nameEl = document.getElementById("unit-name");
    const descEl = document.getElementById("unit-desc");
    const statsEl = document.getElementById("stats-list");
    const unitPanel = document.getElementById("unit-panel");
    const showAbBtn = document.getElementById("show-abilities-btn");
    const abilOverlay = document.getElementById("abilities-overlay");
    const closeAbBtn = document.getElementById("close-abilities-btn");

    if (!iconEl || !nameEl || !descEl || !statsEl) return;
    statsEl.innerHTML = "";
    iconEl.className = "unit-icon";
    if (showAbBtn) showAbBtn.style.display = "none";
    this.hideRuneDetails();

    if (unitPanel) {
      const existingDetails = unitPanel.querySelectorAll(".detail-dynamic");
      existingDetails.forEach(el => el.remove());
      const existingTerr = unitPanel.querySelectorAll(".terr-row");
      existingTerr.forEach(el => el.remove());
    }

    if (!ent) {
      iconEl.textContent = "—";
      nameEl.textContent = "None selected";
      descEl.textContent = "Select a tile or card to view details.";
      this.hideRuneDetails();
      return;
    }

    if (ent.kind === "tile") {
      const info = this.getTileDescriptor(ent.row, ent.col);
      iconEl.innerHTML = `<span>${info.icon}</span>`;
      nameEl.textContent = info.name;
      descEl.textContent = info.desc;
      const [displayRow, displayCol] = this.getDisplayCoords(ent.row, ent.col);
      const rows = [["Tile", `(${displayRow}, ${displayCol})`], ...info.notes];
      // If it's a nexus, add owner info!
      if (this.terrain[ent.row][ent.col] === "nexus") {
        const owner = this.nexusOwners[ent.row][ent.col];
        const ownerLabel = owner == null ? "Neutral" : (owner === Config.TEAM.PLAYER ? "You" : "Enemy");
        rows.push(["Owned By", ownerLabel]);
      }
      for (const [k, v] of rows) {
        const li = document.createElement("li");
        li.textContent = `${k}: ${v}`;
        statsEl.appendChild(li);
      }
      return;
    }

    if (ent.kind === "biome" || ent.kind === "biome_preview") {
      iconEl.textContent = ent.symbol;
      const teamLabel = ent.kind === "biome_preview" ? "Preview" : (this.isMultiplayer ? (ent.team === this.playerTeam ? "Your" : "Enemy") : (ent.team === Config.TEAM.PLAYER ? "Player" : "AI"));
      nameEl.textContent = `${teamLabel} ${ent.type}`;
      descEl.textContent = ent.desc;
      statsEl.innerHTML = `<li>Duration: ${ent.duration} turns</li>${ent.cost ? `<li>Cost: ${ent.cost}⚡</li>` : ""}`;
      return;
    }

    if (ent.kind === "base") {
      iconEl.textContent = this.getDisplayEntitySymbol(ent);
      iconEl.className = "unit-icon unit-visual-base";
      const teamName = this.isMultiplayer ? (ent.team === this.playerTeam ? "Your" : "Enemy") : (ent.team === Config.TEAM.PLAYER ? "Player" : "AI");
      nameEl.textContent = `${teamName} Base`;
      descEl.textContent = ent.team === this.playerTeam ? "Your base. If its HP reaches 0, you lose." : "Enemy base. Destroy it to win!";
      const stats = [["HP", `${ent.hp}/${ent.maxHp}`], ["Defense", "0"]];
      for (const [k, v] of stats) {
        const li = document.createElement("li"); li.textContent = `${k}: ${v}`; statsEl.appendChild(li);
      }
      return;
    }

    const def = Entities.unitDefs[ent.type];
    iconEl.textContent = this.getDisplayEntitySymbol(ent);
    iconEl.className = `unit-icon ${ent.kind === "unit" ? this.getUnitVisualClass(ent.type) : "unit-visual-base"}`;
    const teamName = this.isMultiplayer ? (ent.team === this.playerTeam ? "Your" : "Enemy") : (ent.team === Config.TEAM.PLAYER ? "Player" : "AI");
    nameEl.textContent = `${teamName} ${ent.type}`;
    descEl.textContent = def.ability;

    if (ent.kind === "unit") {
      const def = window.Entities.unitDefs[ent.type];
      if (!def) {
        iconEl.textContent = "—";
        nameEl.textContent = "Error";
        descEl.textContent = "Card data missing.";
        return;
      }

      // Stats
      const base = Entities.unitDefs[ent.type] || {};
      const dmgBonus = this.getBiomeStatBonus(ent, 'dmg');
      const rangeBonus = this.getBiomeStatBonus(ent, 'range');
      const displayedDmg = ent.dmg + dmgBonus;
      const displayedRange = ent.range + rangeBonus;
      const effectiveApMax = this.getEffectiveApMax(ent);
      const rangePatternLabel = this.formatPatternLabel(ent.rangePattern || "square");
      const throwerLabel = ent.thrower ? "thrower (attacks over walls)" : "";
      const rangeSub = throwerLabel ? `${rangePatternLabel} • ${throwerLabel}` : rangePatternLabel;
      const damageValue = ent.type === "Slicer" ? "30%" : `${displayedDmg}`;
      const damageSub = ent.type === "Slicer" ? "current" : "";
      const stats = [
        ["HP", `${ent.hp}/${ent.maxHp}`, base.hp],
        ["Damage", damageValue, base.dmg, damageSub],
        ["Range", `${displayedRange}`, base.range, rangeSub],
        ["Movement", `${ent.move}`, base.move, this.formatPatternLabel(ent.movePattern || "orthogonal")],
        ["AP", `${ent.ap}/${effectiveApMax}`],
      ];
      
      // Add cost if previewing from shop
      if (ent.cost !== undefined) {
        stats.unshift(["Cost", `${ent.cost}⚡`]);
      }
      for (const [k, v, b, sub] of stats) {
        const li = document.createElement("li");
        if (k === "AP") {
          const pips = Array.from({ length: effectiveApMax }, (_, i) => `<span class="ap-pip${i < ent.ap ? '' : ' used'}"></span>`).join('');
          li.className = "stat-card stat-card-ap";
          li.innerHTML = `
            <span class="stat-key">AP</span>
            <span class="stat-value">${v} <span class="ap-pips">${pips}</span></span>
          `;
        } else if (k === "Cost") {
          li.className = "stat-card";
          li.innerHTML = `
            <span class="stat-key">${k}</span>
            <span class="stat-value-wrap">
              <span class="stat-value">${v}</span>
            </span>
          `;
        } else {
          const cur = k === "HP" ? ent.hp : (k === "Damage" ? displayedDmg : (k === "Range" ? displayedRange : ent.move));
          const delta = (typeof b === "number") ? (cur - b) : 0;
          const subLabel = sub ? `<span class="muted-sub">${sub}</span>` : "";
          li.className = `stat-card${sub ? " stat-card-pattern" : ""}`;
          li.innerHTML = `
            <span class="stat-key">${k}</span>
            <span class="stat-value-wrap">
              <span class="stat-value">${v}${delta > 0 ? ` (+${delta})` : ""}</span>
              ${subLabel}
            </span>
          `;
        }
        statsEl.appendChild(li);
      }
      const statuses = this.getUnitStatusEntries(ent);
      if (statuses.length > 0) {
        const statusWrap = document.createElement("div");
        statusWrap.className = "details-section detail-dynamic";
        const statusLabel = document.createElement("div");
        statusLabel.className = "section-label";
        statusLabel.textContent = "Status";
        const statusPanel = document.createElement("div");
        statusPanel.className = "status-panel";
        statusPanel.innerHTML = statuses.map(s => `<span class="status-pill">${s}</span>`).join("");
        statusWrap.appendChild(statusLabel);
        statusWrap.appendChild(statusPanel);
        unitPanel.appendChild(statusWrap);
      }
      if (!this.entities.includes(ent)) {
        const tileInfo = this.getTileDescriptor(ent.row, ent.col);
        const tileRow = document.createElement("li");
        tileRow.className = "stat-card stat-card-tile";
        tileRow.innerHTML = `
          <span class="stat-key">Tile</span>
          <span class="stat-value-wrap">
            <span class="stat-value">${tileInfo.name}</span>
          </span>
        `;
        statsEl.appendChild(tileRow);
      }
      const runeWrap = document.createElement("div");
      runeWrap.className = "details-section detail-dynamic";
      const runeLabel = document.createElement("div");
      runeLabel.className = "section-label";
      runeLabel.textContent = "Runes";
      const runePanel = document.createElement("div");
      runePanel.className = "rune-panel";
      const slots = document.createElement("div");
      slots.className = "rune-slots";
      for (let i = 0; i < 3; i++) {
        const slot = document.createElement("div");
        const rune = ent.runes[i];
        if (rune) {
          const runeDef = this.getRuneDefById(rune.id);
          this.syncOwnedRunePresentation(rune, runeDef);
          slot.className = "rune-slot filled";
          slot.innerHTML = `
            <span class="rune-slot-glyph">${(rune.name || "R")[0]}</span>
          `;
          slot.title = `${rune.name}: ${rune.desc}`;
          slot.onmouseenter = () => this.showRuneDetails(rune, slot);
          slot.onfocus = () => this.showRuneDetails(rune, slot);
          slot.onclick = (e) => { e.stopPropagation(); this.showRuneDetails(rune, slot); };
        } else {
          const myTeam = this.isMultiplayer ? this.playerTeam : Config.TEAM.PLAYER;
          const canUse = ent.team === myTeam;
          if (canUse) {
            slot.className = "rune-slot empty";
            slot.textContent = "+";
            slot.onclick = (e) => { e.stopPropagation(); this.openRuneShop(ent); };
          } else {
            slot.className = "rune-slot locked";
          }
        }
        slots.appendChild(slot);
      }
      const runeSummary = document.createElement("div");
      runeSummary.className = "rune-summary-list";
      if (ent.runes.length) {
        runeSummary.innerHTML = ent.runes.map((rune) => {
          const runeDef = this.getRuneDefById(rune.id);
          this.syncOwnedRunePresentation(rune, runeDef);
          return `
            <div class="rune-summary-item">
              <div class="rune-summary-head">
                <span class="rune-summary-name">${rune.name}</span>
              </div>
              <div class="rune-summary-meta">${rune.desc || ""}</div>
            </div>
          `;
        }).join("");
      } else {
        runeSummary.innerHTML = `<div class="rune-summary-empty">No runes socketed yet.</div>`;
      }
      runePanel.appendChild(slots);
      runePanel.appendChild(runeSummary);
      runeWrap.appendChild(runeLabel);
      runeWrap.appendChild(runePanel);
      unitPanel.appendChild(runeWrap);

      // Abilities Button
      const abilities = (window.Abilities && window.Abilities[ent.type]) || [];
      if (abilities.length > 0 && showAbBtn) {
        showAbBtn.style.display = "block";
        showAbBtn.onclick = () => {
          this.populateAbilitiesOverlay(ent, abilities);
          abilOverlay.classList.remove("hidden");
        };
      }
    }
    
    if (closeAbBtn) closeAbBtn.onclick = () => abilOverlay.classList.add("hidden");
  }

  populateAbilitiesOverlay(ent, abilities) {
    const abilList = document.getElementById("abilities-list");
    const abilBtn = document.getElementById("ability-btn");
    const abilOverlay = document.getElementById("abilities-overlay");
    if (!abilList || !abilBtn) return;

    abilList.innerHTML = "";
    abilBtn.style.display = "none";

    for (const a of abilities) {
      const li = document.createElement("li");
      li.className = "panel";
      li.style.marginBottom = "10px";
      li.style.cursor = "pointer";
      
      const cd = (ent.abilityCooldowns && ent.abilityCooldowns[a.name]) || 0;
      const isMyTeam = this.isMultiplayer ? (ent.team === this.playerTeam) : (ent.team === Config.TEAM.PLAYER);
      const canUse = isMyTeam && this.canActivateAbility(ent, a);
      const detailLines = this.getAbilityDetailLines(ent, a);

      li.innerHTML = `
        <div class="unit-name" style="display:flex; justify-content:space-between;">
          ${a.name}
          ${cd > 0 ? `<span class="status-badge">CD: ${cd}</span>` : ""}
        </div>
        <div class="unit-desc">${a.desc}</div>
        <div class="ability-meta" style="margin-top:8px; display:grid; gap:4px; font-size:11px;"></div>
      `;
      const metaWrap = li.querySelector(".ability-meta");
      if (metaWrap) {
        metaWrap.innerHTML = detailLines.map(([k, v]) => `<div class="ability-meta-row"><span class="ability-meta-key">${k}</span><span class="ability-meta-value">${v}</span></div>`).join("");
      }

      if (canUse) {
          li.onclick = () => {
          if (!this.canActivateAbility(ent, a)) return;
          document.querySelectorAll("#abilities-list li").forEach(el => el.classList.remove("selected"));
          li.classList.add("selected");
          abilBtn.style.display = "block";
          abilBtn.onclick = () => {
            if (!this.canActivateAbility(ent, a)) {
              this.abilityMode = null;
              this.board.clearMarks();
              this.renderEntities();
              this.updateHUD();
              this.updateUnitPanel(ent);
              abilOverlay.classList.add("hidden");
              return;
            }
            this.abilityMode = { unit: ent, def: a };
            if (a.requiresTarget) {
              this.showAbilityHints(ent, a);
              this.updateHUD();
            } else {
              const fromR = ent.row, fromC = ent.col;
              a.perform(this, ent);
              this.abilityMode = null;
              if (this.isMultiplayer) {
                window.Multiplayer.sendPacket('ABILITY', { fromR, fromC, abilityName: a.name, ap: ent.ap });
              }
              this.renderEntities();
              this.updateHUD();
              this.updateUnitPanel(ent);
            }
            abilOverlay.classList.add("hidden");
          };
        };
      } else {
        li.style.opacity = "0.6";
        li.style.cursor = "default";
      }
      abilList.appendChild(li);
    }
  }

  openRuneShop(unit) {
    if (!unit || unit.kind !== "unit" || !this.entities.includes(unit)) return;
    this.hideRuneDetails();
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
    title.textContent = "Runes";
    panel.appendChild(title);

    const list = document.createElement("div");
    list.className = "rune-list";
    
    const myTeam = this.isMultiplayer ? this.playerTeam : Config.TEAM.PLAYER;
    window.RuneDefs.forEach(def => {
      const owned = unit.runes.find(r => r.id === def.id);
      if (owned) this.syncOwnedRunePresentation(owned, def);
      const canBuyFresh = unit.runes.length < 3;
      const canAct = !owned && canBuyFresh;
      const item = document.createElement("div");
      item.className = "rune-item";
      item.innerHTML = `
        <div class="rune-info">
          <div class="rune-name">${(owned ? owned.name : def.name) || "Rune"}</div>
          <div class="rune-desc">${(owned ? owned.desc : def.desc) || ""}</div>
        </div>
        <button class="btn btn-sm">${owned ? "Owned" : `Buy (${def.cost})`}</button>
      `;
      const btn = item.querySelector("button");
      if (!canAct || this.energy[myTeam] < def.cost) {
        btn.disabled = true;
      }
      btn.onclick = () => {
        if (this.buyRune(unit, def.id)) {
          shop.classList.add("hidden");
        }
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
    if (pattern === "straight" || pattern === "artillery" || pattern === "thrower") return (a === 0 || b === 0) ? Math.max(a, b) : Infinity;
    return Math.max(a, b);
  }

  getPatternTiles(unit, range, pattern) {
    const res = [];
    const p = (pattern || "radius").toLowerCase();
    if (p === "straight" || p === "artillery" || p === "thrower") {
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

  getAreaTiles(centerR, centerC, radius) {
    const tiles = [];
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const r = centerR + dr;
        const c = centerC + dc;
        if (!this.inBounds(r, c)) return [];
        tiles.push([r, c]);
      }
    }
    return tiles;
  }

  areasOverlap(centerA, centerB, radius) {
    return Math.abs(centerA[0] - centerB[0]) <= radius * 2 && Math.abs(centerA[1] - centerB[1]) <= radius * 2;
  }

  swapBoardAreas(centerA, centerB, radius) {
    const tilesA = this.getAreaTiles(centerA[0], centerA[1], radius);
    const tilesB = this.getAreaTiles(centerB[0], centerB[1], radius);
    if (!tilesA.length || !tilesB.length || this.areasOverlap(centerA, centerB, radius)) return false;
    const snapA = tilesA.map(([r, c]) => ({
      terrain: this.terrain[r][c],
      hazard: this.hazards[r][c],
      constructionSite: this.constructionSites[r][c],
      nexusOwner: this.nexusOwners[r][c],
      occupant: this.occupants[r][c],
    }));
    const snapB = tilesB.map(([r, c]) => ({
      terrain: this.terrain[r][c],
      hazard: this.hazards[r][c],
      constructionSite: this.constructionSites[r][c],
      nexusOwner: this.nexusOwners[r][c],
      occupant: this.occupants[r][c],
    }));
    for (let i = 0; i < tilesA.length; i++) {
      const [ar, ac] = tilesA[i];
      const [br, bc] = tilesB[i];
      const fromB = snapB[i];
      const fromA = snapA[i];
      this.terrain[ar][ac] = fromB.terrain;
      this.hazards[ar][ac] = fromB.hazard;
      this.constructionSites[ar][ac] = fromB.constructionSite;
      this.nexusOwners[ar][ac] = fromB.nexusOwner;
      this.occupants[ar][ac] = fromB.occupant;
      if (fromB.occupant) {
        fromB.occupant.row = ar;
        fromB.occupant.col = ac;
      }

      this.terrain[br][bc] = fromA.terrain;
      this.hazards[br][bc] = fromA.hazard;
      this.constructionSites[br][bc] = fromA.constructionSite;
      this.nexusOwners[br][bc] = fromA.nexusOwner;
      this.occupants[br][bc] = fromA.occupant;
      if (fromA.occupant) {
        fromA.occupant.row = br;
        fromA.occupant.col = bc;
      }
    }
    for (const biome of this.biomes) {
      const inA = Math.abs(biome.r - centerA[0]) <= radius && Math.abs(biome.c - centerA[1]) <= radius;
      const inB = Math.abs(biome.r - centerB[0]) <= radius && Math.abs(biome.c - centerB[1]) <= radius;
      if (inA) {
        biome.r = centerB[0] + (biome.r - centerA[0]);
        biome.c = centerB[1] + (biome.c - centerA[1]);
      } else if (inB) {
        biome.r = centerA[0] + (biome.r - centerB[0]);
        biome.c = centerA[1] + (biome.c - centerB[1]);
      }
    }
    this.syncSludgeStatuses();
    this.renderEntities();
    return true;
  }

  getBiomeStatBonus(unit, stat) {
    if (!unit || !stat) return 0;
    let bonus = 0;
    const biomeDefs = window.Entities && window.Entities.biomeDefs;
    if (!biomeDefs) return 0;
    for (const b of this.biomes) {
      if (!b || b.team !== unit.team) continue;
      if (!this.isWithinBiomeRadius(unit.row, unit.col, b.r, b.c, b.radius || 0)) continue;
      const def = biomeDefs[b.type];
      if (def && def.effectType === "stat_buff" && def.stat === stat) {
        if (this.doesBiomeAffectUnit(def, unit)) {
          bonus += (def.amount || 0);
        }
      }
    }
    return bonus;
  }

  isEntityVisibleToUnit(attacker, target) {
    if (!target) return false;
    // Non-shadow entities are always visible
    if (!target.inShadowRealm) return true;
    // Viewer must have clicked the shadow toggle to view the realm
    if (!this.shadowRealmView) return false;
    const viewerTeam = attacker ? attacker.team : (this.isMultiplayer ? this.playerTeam : Config.TEAM.PLAYER);
    const viewerHasShadow = this.entities.some(e => e.team === viewerTeam && e.inShadowRealm);
    const targetTeamHasShadow = this.entities.some(e => e.team === target.team && e.inShadowRealm);
    // Only players with units in the Shadow Realm can see Shadow units
    if (!viewerHasShadow) return false;
    // Allies are always visible to each other in the realm when viewer has shadow units
    if (viewerTeam === target.team) return true;
    // Enemies are visible only if both teams have shadow presence
    return targetTeamHasShadow;
  }

  showActionHints(unit) {
    this.board.clearMarks();
    this.board.markSelected(unit.row, unit.col);
    const selCell = this.board.getCell(unit.row, unit.col);
    if (selCell) selCell.classList.add(unit.team === Config.TEAM.PLAYER ? "selected-player" : "selected-enemy");

    const isMyTurn = this.isMultiplayer ? (this.turn === this.playerTeam) : (this.turn === Config.TEAM.PLAYER);
    const isMyUnit = this.isMultiplayer ? (unit.team === this.playerTeam) : (unit.team === Config.TEAM.PLAYER);

    const attackRange = this.getAttackRangeTiles(unit);
    const attacks = this.getAttackTargets(unit);
    this.board.markPositions(attackRange, "attack-range-hl");
    this.board.markPositions(attacks, "attack-hl");
    
    if (isMyUnit && isMyTurn) {
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
    const hSrc = this.hazards[unit.row][unit.col];
    if (hSrc && hSrc.kind === "sludge") return [];
    const res = [];
    const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dr, dc] of dirs) {
      for (let s = 1; s <= maxSteps; s++) {
        const r = unit.row + dr * s;
        const c = unit.col + dc * s;
        if (!this.inBounds(r, c)) break;
        
        // Diagonal restriction: check if moving between two blocked tiles
        if (dr !== 0 && dc !== 0) {
          const rSide = unit.row + dr * (s-1);
          const cSide = unit.col + dc * (s-1);
          // Check the two tiles that form the "gap" for this diagonal step
          const corner1 = this.terrain[rSide + dr][cSide];
          const corner2 = this.terrain[rSide][cSide + dc];
          const isBlocked1 = this.isTerrainBlockingForUnit(corner1, unit);
          const isBlocked2 = this.isTerrainBlockingForUnit(corner2, unit);
          if (isBlocked1 && isBlocked2) break;
        }

        const terr = this.terrain[r][c];
        if (this.isTerrainBlockingForUnit(terr, unit)) break;
        if (this.occupants[r][c] != null) break;
        
        // Sludge entry restriction
        const hDst = this.hazards[r][c];
        if (hDst && hDst.kind === "sludge") break;

        res.push([r, c]);
      }
    }
    return res;
  }

  getAttackTargets(unit) {
    if (unit.ap < 1) return [];
    if ((unit.silencedTurns || 0) > 0) return [];
    const res = [];
    // Biome range bonus (computed centrally)
    const effectiveRange = unit.range + this.getBiomeStatBonus(unit, 'range');

    for (const ent of this.entities) {
      if (!ent || ent.team === unit.team) continue;
      // Only allow interactions within the same realm (shadow vs normal)
      if ((!!ent.inShadowRealm) !== (!!unit.inShadowRealm)) continue;
      const dist = this.distanceByPattern(unit, ent.row - unit.row, ent.col - unit.col);
      if (dist <= effectiveRange) res.push([ent.row, ent.col]);
    }
    const isThrower = !!unit.thrower || ((unit.rangePattern || "").toLowerCase() === "thrower");
    if (isThrower) return res;
    return res.filter(([tr, tc]) => this.hasLineOfSight(unit.row, unit.col, tr, tc));
  }

  hasLineOfSight(sr, sc, tr, tc) {
    const cells = this.traceLineSupercover(sr, sc, tr, tc);
    for (const [r, c] of cells) {
      if (this.doesTerrainBlockLine(this.terrain[r][c])) return false;
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
    if ((unit.silencedTurns || 0) > 0) return [];
    const res = [];
    
    // Biome range bonus (use helper so UI and logic stay in sync)
    const effectiveRange = unit.range + this.getBiomeStatBonus(unit, 'range');

    for (let dr = -effectiveRange; dr <= effectiveRange; dr++) {
      for (let dc = -effectiveRange; dc <= effectiveRange; dc++) {
        const r = unit.row + dr;
        const c = unit.col + dc;
        if (!this.inBounds(r, c)) continue;
        if (dr === 0 && dc === 0) continue;
        const dist = this.distanceByPattern(unit, dr, dc);
        if (dist <= effectiveRange) {
          const isThrower = !!unit.thrower || ((unit.rangePattern || "").toLowerCase() === "thrower");
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
    const pattern = (def.rangePattern || "radius").toLowerCase();
    let toMark = [];
    if (pattern !== "select") {
      const baseRange = typeof def.range === "number" && def.range > 0 ? def.range : unit.range;
      toMark = this.getPatternTiles(unit, baseRange, pattern);
      this.board.markPositions(toMark, "ability-hl");
    } else {
      const baseRange = typeof def.range === "number" && def.range > 0 ? def.range : unit.range;
      const isNecro = (def.name || "").toLowerCase().includes("raise");
      if (!isNecro) {
        const area = this.getPatternTiles(unit, baseRange, "square");
        this.board.markPositions(area, "ability-hl");
        toMark = area;
      }
      const targets = def && typeof def.computeTargets === "function" ? def.computeTargets(this, unit) : [];
      this.board.markPositions(targets, def.multiSelect ? "ability-range-max" : "ability-hl");
      toMark = targets;
    }
    if (!this.abilityMode) this.abilityMode = { unit, def };
    this.abilityMode.targets = toMark;
    if (def.multiSelect) this.abilityMode.selectedTiles = [];
  }

  getPiercingLineTargets(unit, range) {
    const res = [];
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dr, dc] of dirs) {
      for (let step = 1; step <= range; step++) {
        const r = unit.row + dr * step, c = unit.col + dc * step;
        if (!this.inBounds(r, c)) break;
        const terr = this.terrain[r][c];
        if (this.isTerrainBlockingForUnit(terr, unit)) break;
        res.push([r, c]);
      }
    }
    return res;
  }

  getChargeTargets(unit) {
    return this.getPiercingLineTargets(unit, 3);
  }

  getSnipeTargets(unit) {
    const abilityRange = (window.Abilities && window.Abilities.Archer && window.Abilities.Archer[0] && window.Abilities.Archer[0].range) || unit.range;
    return this.getPiercingLineTargets(unit, abilityRange);
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
    let clickedEnt = this.occupants[r][c];
    const isPlayerTurn = this.turn === Config.TEAM.PLAYER;
    const isMyTurn = this.isMultiplayer ? (this.turn === this.playerTeam) : isPlayerTurn;
    if (this.isGameOver()) return;
    if (!this.draft.completed) {
      if (!this.draft.active && this.menuOpen) this.renderMainMenu();
      return;
    }

    // Respect Shadow Realm visibility: treat hidden shadow units as empty tiles for the viewer
    if (clickedEnt && clickedEnt.inShadowRealm && !this.isEntityVisibleToUnit(null, clickedEnt)) {
      clickedEnt = null;
    }

    if (isMyTurn && this.buySelection) {
      const myTeam = this.isMultiplayer ? this.playerTeam : Config.TEAM.PLAYER;
      const type = this.buySelection.type;
      const positions = this.getBuyPositions(myTeam, type).map(JSON.stringify);
      const key = JSON.stringify([r, c]);
      if (positions.includes(key)) {
        const cost = this.buySelection.cost;
        const hasType = this.entities.some(e => e.kind === "unit" && e.team === myTeam && e.type === type);
        if (!this.isUnitDrafted(myTeam, type)) {
          this.logEvent({ type: "error", msg: `${type} was not drafted.` });
          return;
        }
        if (!hasType && this.spendEnergy(myTeam, cost)) {
          const u = Entities.makeUnit(myTeam, type, r, c);
          this.addEntity(u);
          this.purchasedUnits[myTeam].add(type);
          this.buySelection = null;
          const cancelBtn = document.getElementById("buy-cancel");
          if (cancelBtn) cancelBtn.style.display = "none";
          this.board.clearMarks();
          this.renderEntities();
          this.updateHUD();
          this.renderBuyControls();
          this.updateUnitPanel(u);
          
          if (this.isMultiplayer) {
            window.Multiplayer.sendPacket('BUY', { team: myTeam, unitType: type, r, c, energy: this.energy[myTeam] });
          }
          return;
        }
      }
      return;
    }

    if (isMyTurn && this.biomeSelection) {
      const myTeam = this.isMultiplayer ? this.playerTeam : Config.TEAM.PLAYER;
      const type = this.biomeSelection;
      const biomeDef = window.Entities.biomeDefs[type];
      
      if (biomeDef && this.energy[myTeam] >= biomeDef.cost) {
        if (!this.isBiomeDrafted(myTeam, type)) {
          this.logEvent({ type: "error", msg: `${type} was not drafted.` });
          return;
        }
        // Only allow placement on non-nexus tiles (or as specified)
        if (this.terrain[r][c] !== "nexus") {
          this.energy[myTeam] -= biomeDef.cost;
          this.biomes.push({
            type: type,
            r, c,
            radius: biomeDef.radius,
            team: myTeam,
            duration: biomeDef.duration,
            symbol: biomeDef.symbol,
            desc: biomeDef.desc
          });

            // Apply biome effects immediately when placed.
            const placed = this.biomes[this.biomes.length - 1];
            this.applyBiomeToUnits(placed);

            // clear preview marker
            this.previewBiomeCenter = null;

          this.biomeSelection = null;
          const cancelBtn = document.getElementById("buy-cancel");
          if (cancelBtn) cancelBtn.style.display = "none";
          this.board.clearMarks();
          this.renderEntities();
          this.updateHUD();
          this.renderBuyControls();
          this.updateUnitPanel(null);

          if (this.isMultiplayer) {
            // Need a BIOME packet or use ABILITY if adapted, but let's assume a new packet is needed
            // or just use syncState for simplicity in this turn-based context if needed.
            // For now, let's use a SYNC_STATE broadcast if available.
            window.Multiplayer.sendPacket('SYNC_STATE', { 
              terrain: this.terrain,
              nexusOwners: this.nexusOwners,
              biomes: this.biomes,
              basePositions: this.entities.filter(e => e.kind === 'base').map(e => ({ team: e.team, r: e.row, c: e.col }))
            });
          }
          return;
        }
      }
      return;
    }

    if (this.abilityMode && this.abilityMode.unit && (this.isMultiplayer ? this.abilityMode.unit.team === this.playerTeam : this.abilityMode.unit.team === Config.TEAM.PLAYER)) {
      const u = this.abilityMode.unit;
      const def = this.abilityMode.def;
      if (!this.canActivateAbility(u, def) && !this.abilityMode.constructRemaining) {
        this.abilityMode = null;
        this.board.clearMarks();
        this.renderEntities();
        this.updateHUD();
        this.updateUnitPanel(this.selected && this.entities.includes(this.selected) ? this.selected : u);
        return;
      }
      const key = JSON.stringify([r, c]);
      const targets = def.requiresTarget ? (def.computeTargets(this, u).map(JSON.stringify)) : [];
      
      if (def.multiSelect) {
        if (targets.includes(key)) {
          const selected = this.abilityMode.selectedTiles || [];
          const idx = selected.findIndex(p => p[0] === r && p[1] === c);
          if (idx >= 0) selected.splice(idx, 1);
          else if (selected.length < (def.maxTargets || 5)) selected.push([r, c]);
          this.abilityMode.selectedTiles = selected;
          if (selected.length >= (def.maxTargets || 5)) {
            const fromR = u.row, fromC = u.col;
            if (typeof def.performSelected === "function") {
              def.performSelected(this, u, selected.slice());
            } else {
              for (const [sr, sc] of selected) {
                def.perform(this, u, sr, sc);
                this.animateAbilityCast(u, def, sr, sc);
              }
            }
            this.playSfx && this.playSfx("ability");
            if (this.isMultiplayer) {
              window.Multiplayer.sendPacket('ABILITY', { fromR, fromC, targetTiles: selected.slice(), abilityName: def.name, ap: u.ap });
            }
            this.abilityMode = null;
            this.renderEntities();
            this.board.clearMarks();
            this.updateUnitPanel(this.selected && this.entities.includes(this.selected) ? this.selected : u);
            if (u.ap > 0) this.showActionHints(u);
            this.checkWin();
            return;
          }
          this.board.clearMarks();
          this.board.markSelected(u.row, u.col);
          const valid = def.computeTargets(this, u);
          this.board.markPositions(valid, "ability-range-max");
          this.board.markPositions(selected, "selected-target-hl");
          this.updateUnitPanel(u);
          return;
        }
      }

      if (!def.requiresTarget) {
        const fromR = u.row, fromC = u.col;
        def.perform(this, u);
        this.animateAbilityCast(u, def, u.row, u.col);
        if (this.isMultiplayer) {
          window.Multiplayer.sendPacket('ABILITY', { fromR, fromC, abilityName: def.name, ap: u.ap });
        }
      } else if (targets.includes(key)) {
        const targetEnt = this.occupants[r][c] || this.entities.find(e => e.row === r && e.col === c);
        if (targetEnt && (targetEnt.kind === "unit" || targetEnt.kind === "base")) {
          // Disallow cross-realm interactions
          if ((!!targetEnt.inShadowRealm) !== (!!u.inShadowRealm)) return;
          // Disallow targeting hidden shadow enemies (UI visibility rule)
          if (targetEnt.inShadowRealm && targetEnt.team !== u.team && !this.isEntityVisibleToUnit(u, targetEnt)) return;
        }
        const fromR = u.row, fromC = u.col;
        def.perform(this, u, r, c);
        this.animateAbilityCast(u, def, r, c);
        const tar = this.board.getCell(r, c) || this.board.getCell(u.row, u.col);
        if (tar) {
          tar.classList.add("ability-anim");
          setTimeout(() => tar.classList.remove("ability-anim"), 500);
        }
        this.playSfx && this.playSfx("ability");
        if (this.isMultiplayer) {
          const payload = { fromR, fromC, targetR: r, targetC: c, abilityName: def.name, ap: u.ap };
          window.Multiplayer.sendPacket('ABILITY', payload);
        }
      }
      const keepAbilityMode = !!(
        this.abilityMode &&
        this.abilityMode.unit === u &&
        !this.abilityMode.done &&
        (
          this.abilityMode.constructRemaining > 0 ||
          this.abilityMode.summonRemaining > 0 ||
          def.multiSelect
        )
      );
      if (!keepAbilityMode) {
        this.abilityMode = null;
      } else {
        const tiles = def.computeTargets(this, u);
        this.board.clearMarks();
        this.board.markSelected(u.row, u.col);
        this.board.markPositions(tiles, def.multiSelect ? "ability-range-max" : "ability-hl");
        if (def.multiSelect && this.abilityMode.selectedTiles && this.abilityMode.selectedTiles.length) {
          this.board.markPositions(this.abilityMode.selectedTiles, "selected-target-hl");
        }
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

    if (isMyTurn) {
      const myTeam = this.isMultiplayer ? this.playerTeam : Config.TEAM.PLAYER;
      if (this.selected && this.selected.kind === "unit" && this.selected.team === myTeam) {
        const u = this.selected;
        if (u.ap >= 1) {
          const moveTargets = this.getMoveTargets(u).map(JSON.stringify);
          const attackTargets = this.getAttackTargets(u).map(JSON.stringify);
          const key = JSON.stringify([r, c]);
          let actionTaken = false;
          if (moveTargets.includes(key) && this.occupants[r][c] == null) {
            const fromR = u.row, fromC = u.col;
            const maxSteps = Math.min((u && u.move) || 1, Config.MAX_MOVE_PER_ACTION || 3);
            const path = this.getMovePath(u, r, c, maxSteps);
            if (path && path.length) {
              await this.animateMove(u, path, { dash: false, stepDelay: 360 });
              u.ap -= 1;
              actionTaken = true;
              if (this.isMultiplayer) {
                window.Multiplayer.sendPacket('MOVE', { fromR, fromC, toR: r, toC: c, ap: u.ap });
              }
            }
          } else if (attackTargets.includes(key)) {
            const target = this.occupants[r][c] || this.entities.find(e => e.kind === "base" && e.row === r && e.col === c);
            if (target) {
              const fromR = u.row, fromC = u.col;
              this.attack(u, target);
              u.ap -= 1;
              actionTaken = true;
              if (this.isMultiplayer) {
                window.Multiplayer.sendPacket('ATTACK', { fromR, fromC, toR: r, toC: c, ap: u.ap });
              }
            }
          }
          if (actionTaken) {
            this.renderEntities();
            this.board.clearMarks();
            this.updateHUD();
            this.updateUnitPanel(this.selected);
            this.checkWin();
            if (u.ap > 0) this.showActionHints(u);
            else this.board.markSelected(u.row, u.col);
            return;
          }
        }
      }
    }
    this.board.clearMarks();

    // Check for Biome info
    const biome = this.biomes.find(b => {
      if (!b) return false;
      return this.isWithinBiomeRadius(r, c, b.r, b.c, b.radius || 0);
    });
    if (!clickedEnt && biome) {
      const def = window.Entities.biomeDefs[biome.type];
      this.updateUnitPanel({
        kind: "biome",
        type: biome.type,
        team: biome.team,
        symbol: biome.symbol,
        desc: def ? def.desc : "",
        duration: biome.duration
      });
      const cell = this.board.getCell(r, c);
      if (cell) cell.classList.add("selected");
      return;
    }

    if (clickedEnt) {
      this.abilityMode = null;
      this.selected = clickedEnt;
      this.updateHUD();
      this.updateUnitPanel(clickedEnt);
      const cell = this.board.getCell(r, c);
      if (cell) {
        cell.classList.add("selected");
        const isMyUnit = this.isMultiplayer ? (clickedEnt.team === this.playerTeam) : (clickedEnt.team === Config.TEAM.PLAYER);
        cell.classList.add(isMyUnit ? "selected-player" : "selected-enemy");
      }
      if (clickedEnt.kind === "unit") this.showActionHints(clickedEnt);
      return;
    }
    this.selected = { kind: "tile", row: r, col: c };
    this.updateUnitPanel(this.selected);
    const cell = this.board.getCell(r, c);
    if (cell) cell.classList.add("selected", "selected-empty");
  }

  deselect() {
    this.selected = null;
    this.abilityMode = null;
    this.board.clearMarks();
    this.updateUnitPanel(null);
    this.updateHUD();
  }

  moveUnit(unit, r, c, opt) {
    const hSrc = this.hazards[unit.row][unit.col];
    if (hSrc && hSrc.kind === "sludge") return;
    const src = this.board.getCell(unit.row, unit.col);
    const dst = this.board.getCell(r, c);
    this.occupants[unit.row][unit.col] = null;
    unit.row = r; unit.col = c;
    this.occupants[r][c] = unit;
    const hz = this.hazards[r][c];
    if (hz && hz.kind === "fire" && this.terrain[r][c] !== "water") {
      unit.burnTurns = Math.max((unit.burnTurns || 0), 1);
    }
    if (this.terrain[r][c] === "nexus") {
      const prev = this.nexusOwners[r][c];
      if (prev !== unit.team) {
        this.nexusOwners[r][c] = unit.team;
      }
    }
    this.refreshBiomeModifiersForUnit(unit, { grantTurnStart: false, grantImmediateContact: true });
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
    const sr = unit.row, sc = unit.col;

    // Sludge exit restriction: if unit is in sludge, it cannot move out
    const hSrc = this.hazards[sr][sc];
    if (hSrc && hSrc.kind === "sludge") return null;

    const dr = tr - sr, dc = tc - sc;
    const a = Math.abs(dr), b = Math.abs(dc);
    // Must be aligned to one of 8 directions
    if (!((a === 0 && b > 0) || (b === 0 && a > 0) || (a === b && a > 0))) return null;
    const steps = Math.max(a, b);
    if (steps > maxSteps) return null;
    const stepR = Math.sign(dr), stepC = Math.sign(dc);
    const path = [];
    let r = sr, c = sc;
    for (let s = 1; s <= steps; s++) {
      // Diagonal restriction: check if moving between two blocked tiles
      if (stepR !== 0 && stepC !== 0) {
        const rSide = r, cSide = c; // r,c are current pos before adding step
        const corner1 = this.terrain[rSide + stepR][cSide];
        const corner2 = this.terrain[rSide][cSide + stepC];
        const isBlocked1 = this.isTerrainBlockingForUnit(corner1, unit);
        const isBlocked2 = this.isTerrainBlockingForUnit(corner2, unit);
        if (isBlocked1 && isBlocked2) return null;
      }

      r += stepR; c += stepC;
      if (!this.inBounds(r, c)) return null;
      const terr = this.terrain[r][c];
      if (this.isTerrainBlockingForUnit(terr, unit)) return null;
      if (this.occupants[r][c] != null && !(r === tr && c === tc)) return null;
      
      // Sludge entry restriction
      const hDst = this.hazards[r][c];
      if (hDst && hDst.kind === "sludge") return null;

      path.push([r, c]);
    }
    return path;
  }

  async animateMove(unit, path, options) {
    const delay = (options && options.stepDelay) || 360;
    for (const [r, c] of path) {
      const from = { row: unit.row, col: unit.col };
      this.moveUnit(unit, r, c, { dash: !!(options && options.dash) });
      this.spawnMoveFx(from, { row: r, col: c }, !!(options && options.dash));
      this.playSfx && this.playSfx(options && options.dash ? "dash" : "move");
      this.renderEntities();
      this.board.clearMarks();
      await this.delay(delay);
    }
  }

  applyBiomeToUnits(b) {
    if (!b) return;
    const def = window.Entities && window.Entities.biomeDefs && window.Entities.biomeDefs[b.type];
    if (!def) return;
    for (const ent of this.entities) {
      if (!ent || ent.kind !== "unit") continue;
      if (ent.team !== b.team) continue;
      if (!this.isWithinBiomeRadius(ent.row, ent.col, b.r, b.c, b.radius || 0)) continue;
      if (def.effectType === "turn_start_heal" && this.doesBiomeAffectUnit(def, ent)) {
        ent.hp = Math.min(ent.maxHp, ent.hp + (def.amount || 1));
      } else if (def.effectType === "turn_start_support_buff") {
        if (this.doesBiomeAffectUnit(def, ent)) {
          ent.apMaxBonus = Math.max(ent.apMaxBonus || 0, def.amount || 1);
          ent.hp = Math.min(ent.maxHp, ent.hp + (def.amount || 1));
          ent.ap = Math.min(this.getEffectiveApMax(ent), ent.ap + (def.amount || 1));
        }
      } else if (def.effectType === "turn_start_guard" && this.doesBiomeAffectUnit(def, ent)) {
        ent.guardTurns = Math.max(ent.guardTurns || 0, def.amount || 1);
        ent.guardValue = Math.max(ent.guardValue || 0, def.guardValue || 10);
      }
    }
    this.renderEntities();
    this.updateHUD();
  }

  tickTurnEffects() {
    this.tickHazardsForTeam(Config.TEAM.PLAYER);
    this.tickHazardsForTeam(Config.TEAM.AI);
    this.syncSludgeStatuses();
  }

  revertBeastForm(unit) {
    if (!unit || !unit.isBeast || !unit.originalStats) return;
    unit.isBeast = false;
    unit.beastTurns = 0;
    Object.assign(unit, unit.originalStats);
    delete unit.originalStats;
    unit.hp = Math.min(unit.hp, unit.maxHp);
    this.logEvent({ type: "status", msg: `${unit.team === "P" ? "Player" : "AI"} Druid reverted to Human form.` });
    const cell = this.board.getCell(unit.row, unit.col);
    if (cell) {
      cell.classList.add("transform-anim");
      setTimeout(() => cell.classList.remove("transform-anim"), 1500);
    }
    if (this.playSfx) this.playSfx("transform");
  }

  revertSiegeMode(unit) {
    if (!unit || !unit.siegeOriginalStats) return;
    Object.assign(unit, unit.siegeOriginalStats);
    delete unit.siegeOriginalStats;
    unit.siegeTurns = 0;
    this.logEvent({ type: "status", msg: `${unit.team === "P" ? "Player" : "AI"} Ballista redeployed.` });
  }

  syncSludgeStatuses() {
    for (const ent of this.entities) {
      if (ent.kind !== "unit") continue;
      const hazard = this.hazards[ent.row][ent.col];
      ent.stuck = !!(hazard && hazard.kind === "sludge");
    }
  }

  refreshBiomeModifiersForUnit(ent, options) {
    if (!ent || ent.kind !== "unit") return;
    const grantTurnStart = !!(options && options.grantTurnStart);
    const grantImmediateContact = !!(options && options.grantImmediateContact);
    ent.apMaxBonus = 0;
    const biomeDefs = window.Entities.biomeDefs;
    for (const b of this.biomes) {
      if (!b || b.team !== ent.team) continue;
      if (!this.isWithinBiomeRadius(ent.row, ent.col, b.r, b.c, b.radius || 0)) continue;
      const def = biomeDefs[b.type];
      if (!def) continue;
      if (def.effectType === "turn_start_support_buff" && this.doesBiomeAffectUnit(def, ent)) {
        ent.apMaxBonus = Math.max(ent.apMaxBonus || 0, def.amount || 1);
        if (grantImmediateContact) {
          ent.ap = Math.min(this.getEffectiveApMax(ent), ent.ap + (def.amount || 1));
        }
        if (grantTurnStart) {
          ent.hp = Math.min(ent.maxHp, ent.hp + (def.amount || 1));
          ent.ap = Math.min(this.getEffectiveApMax(ent), ent.ap + (def.amount || 1));
        }
      } else if (grantTurnStart && def.effectType === "turn_start_heal" && this.doesBiomeAffectUnit(def, ent)) {
        ent.hp = Math.min(ent.maxHp, ent.hp + (def.amount || 1));
      } else if (grantTurnStart && def.effectType === "turn_start_guard" && this.doesBiomeAffectUnit(def, ent)) {
        ent.guardTurns = Math.max(ent.guardTurns || 0, def.amount || 1);
        ent.guardValue = Math.max(ent.guardValue || 0, def.guardValue || 10);
      }
    }
    ent.ap = Math.min(ent.ap || 0, this.getEffectiveApMax(ent));
  }

  tickHazardsForTeam(team) {
    for (let r = 0; r < Config.ROWS; r++) {
      for (let c = 0; c < Config.COLS; c++) {
        const hazard = this.hazards[r][c];
        if (!hazard || hazard.ownerTeam !== team) continue;
        hazard.turns -= 1;
        if (hazard.turns <= 0) {
          this.hazards[r][c] = null;
        }
      }
    }
    this.syncSludgeStatuses();
  }

  tickTimedStatusesForTeam(team) {
    for (const ent of this.entities) {
      if (!ent || ent.kind !== "unit" || ent.team !== team) continue;
      if ((ent.hexTurns || 0) > 0) {
        ent.hexTurns = Math.max(0, (ent.hexTurns || 0) - 1);
        if (ent.hexTurns <= 0) ent.hexMarked = false;
      }
      if (ent.isBeast) {
        ent.beastTurns = Math.max(0, (ent.beastTurns || 0) - 1);
        if (ent.beastTurns <= 0) this.revertBeastForm(ent);
      }
      if (ent.siegeTurns && ent.siegeTurns > 0) {
        ent.siegeTurns = Math.max(0, ent.siegeTurns - 1);
        if (ent.siegeTurns <= 0) this.revertSiegeMode(ent);
      }
      if (ent.guardTurns && ent.guardTurns > 0) {
        ent.guardTurns = Math.max(0, ent.guardTurns - 1);
      }
      if (ent.silencedTurns && ent.silencedTurns > 0) {
        ent.silencedTurns = Math.max(0, ent.silencedTurns - 1);
      }
      if (ent.shadowTurns && ent.shadowTurns > 0) {
        ent.shadowTurns = Math.max(0, ent.shadowTurns - 1);
        if (ent.shadowTurns <= 0) ent.inShadowRealm = false;
      }
    }
  }

  tickTimedStatusesGlobal() {
    // Called once per full round to decrement all timed statuses across teams
    for (const ent of this.entities) {
      if (!ent || ent.kind !== "unit") continue;
      if ((ent.hexTurns || 0) > 0) {
        ent.hexTurns = Math.max(0, (ent.hexTurns || 0) - 1);
        if (ent.hexTurns <= 0) ent.hexMarked = false;
      }
      if (ent.isBeast) {
        ent.beastTurns = Math.max(0, (ent.beastTurns || 0) - 1);
        if (ent.beastTurns <= 0) this.revertBeastForm(ent);
      }
      if (ent.siegeTurns && ent.siegeTurns > 0) {
        ent.siegeTurns = Math.max(0, ent.siegeTurns - 1);
        if (ent.siegeTurns <= 0) this.revertSiegeMode(ent);
      }
      if (ent.guardTurns && ent.guardTurns > 0) {
        ent.guardTurns = Math.max(0, ent.guardTurns - 1);
      }
      if (ent.silencedTurns && ent.silencedTurns > 0) {
        ent.silencedTurns = Math.max(0, ent.silencedTurns - 1);
      }
      if (ent.shadowTurns && ent.shadowTurns > 0) {
        ent.shadowTurns = Math.max(0, ent.shadowTurns - 1);
        if (ent.shadowTurns <= 0) ent.inShadowRealm = false;
      }
    }
  }

  startTurnForTeam(team) {
    this.generateEnergy(team);
    this.resetAPForTeam(team);
    this.tickHazardsForTeam(team);
    this.tickBiomes(team);
    this.applyHazardsForTeam(team);
    this.applyRuneTurnStartEffectsForTeam(team);
    this.applyDiseaseEffectsForTeam(team);
    this.tickCooldowns(team);
    this.advanceRuneProgressForTeam(team);
    this.renderEntities();
  }

  tickBiomes(team) {
    // 1. Decrement duration for biomes belonging to this team
    for (let i = this.biomes.length - 1; i >= 0; i--) {
      const b = this.biomes[i];
      if (b && b.team === team) {
        b.duration--;
        if (b.duration <= 0) {
          this.biomes.splice(i, 1);
          continue;
        }
      }
    }

    // 2. Apply biome effects to units in range
    // Biomes apply effects at the start of the turn for units of the same team
    for (const ent of this.entities) {
      if (!ent || ent.kind !== "unit" || ent.team !== team) continue;
      this.refreshBiomeModifiersForUnit(ent, { grantTurnStart: true });
    }
  }

  applyDamage(target, dmg, source) {
    // Block cross-realm damage when there is a source unit (global/terrain effects use source=null)
    if (source && source.kind === "unit" && target && ((!!source.inShadowRealm) !== (!!target.inShadowRealm))) {
      return;
    }
    const before = target.hp;
    const bonus = (target.hexMarked ? 10 : 0);
    
    // Biome buffs for source
    let biomeDmgBonus = 0;
    if (source && source.kind === "unit") {
      const biomeDefs = window.Entities.biomeDefs;
      for (const b of this.biomes) {
        if (b && b.team === source.team) {
          if (this.isWithinBiomeRadius(source.row, source.col, b.r, b.c, b.radius || 0)) {
            const def = biomeDefs[b.type];
            if (def && def.effectType === "stat_buff" && def.stat === "dmg") {
              if (this.doesBiomeAffectUnit(def, source)) {
                biomeDmgBonus += (def.amount || 0);
              }
            }
          }
        }
      }
    }

    let effectiveDmg = dmg + bonus + biomeDmgBonus;
    if (target.kind === "unit" && (target.guardTurns || 0) > 0) {
      const gv = (target.guardValue != null && target.guardValue !== 0) ? target.guardValue : 10;
      if (gv > 0 && gv < 1) {
        effectiveDmg = Math.max(1, Math.ceil(effectiveDmg * (1 - gv)));
      } else {
        effectiveDmg = Math.max(1, effectiveDmg - gv);
      }
    }
    if (target.kind === "unit" && target.isBeast) {
        effectiveDmg = Math.max(1, Math.floor(effectiveDmg * 0.8));
    }
    target.hp = Math.max(0, target.hp - effectiveDmg);
    const cell = this.board.getCell(target.row, target.col);
    if (cell) {
      cell.classList.add("hit-anim");
      setTimeout(() => cell.classList.remove("hit-anim"), 360);
    }
    if (target.kind === "base" && target.hp <= 0) {
      this.checkWin();
    }
    this.playSfx && this.playSfx("hit");
    if (target.hp === 0 && before > 0) {
      if (target.kind === "unit") {
        const killer = source ? `${source.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${source.type}` : "Unknown";
        const victim = `${target.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${target.type}`;
        this.logEvent({ type: "death", killer, victim });
        const bountyReward = (window.Entities && window.Entities.unitDefs && window.Entities.unitDefs[target.type] && window.Entities.unitDefs[target.type].bountyEnergyReward) || target.bountyEnergyReward || 0;
        if (bountyReward > 0) {
          const rewardTeam = target.team === Config.TEAM.PLAYER ? Config.TEAM.AI : Config.TEAM.PLAYER;
          this.energy[rewardTeam] = Math.min(Config.ENERGY_MAX_TOTAL || 99, (this.energy[rewardTeam] || 0) + bountyReward);
          this.logEvent({ type: "status", msg: `${rewardTeam === Config.TEAM.PLAYER ? "Player" : "AI"} gained ${bountyReward} gold from the bounty.` });
          this.updateHUD();
        }
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
    if (!attacker || !target) return;
    if ((attacker.silencedTurns || 0) > 0) return;
    // Prevent cross-realm attacks
    if (attacker.kind === "unit" && target && ((!!attacker.inShadowRealm) !== (!!target.inShadowRealm))) return;
    this.animateAttack(attacker, target);
    let damage = attacker.dmg;
    if (attacker.type === "Slicer" && target.kind === "unit") {
      damage = Math.max(1, Math.ceil((target.hp || 0) * 0.3));
    }
    this.applyDamage(target, damage, attacker);
  }

  heal(mage, ally) {
    if (mage.type !== "Mage") return;
    // Healing is realm-locked
    if ((!!mage.inShadowRealm) !== (!!ally.inShadowRealm)) return;
    ally.hp = Math.min(ally.maxHp, ally.hp + 2);
    const cell = this.board.getCell(ally.row, ally.col);
    if (cell) {
      cell.classList.add("heal-anim");
      setTimeout(() => cell.classList.remove("heal-anim"), 640);
    }
    this.playSfx && this.playSfx("heal");
  }

  async endPlayerTurn() {
    if (!this.draft.completed) {
      this.logEvent({ type: "error", msg: "Complete the draft before starting turns." });
      if (!this.draft.active && this.menuOpen) this.renderMainMenu();
      return;
    }
    const isMyTurn = this.isMultiplayer ? (this.turn === this.playerTeam) : (this.turn === Config.TEAM.PLAYER);
    if (!isMyTurn) return;

    this.selected = null;
    this.abilityMode = null;
    this.buySelection = null;
    this.board.clearMarks();

    if (this.isMultiplayer) {
      window.Multiplayer.sendPacket('END_TURN', {});
      this.endTurnPvP();
    } else {
      // 1. Both teams' Nexuses do damage as the current turn ends (every turn)
      this.applyNexusEffects(Config.TEAM.PLAYER);
      this.applyNexusEffects(Config.TEAM.AI);

      this.turn = Config.TEAM.AI;
      this.updateHUD();
      this.startTurnForTeam(Config.TEAM.AI);
      await this.runAI();
      
      // 2. Both teams' Nexuses do damage after AI finishes its turn (every turn)
      this.applyNexusEffects(Config.TEAM.PLAYER);
      this.applyNexusEffects(Config.TEAM.AI);

      // Global status durations tick once per full round (after AI finishes)
      this.tickTimedStatusesGlobal();

      this.checkWin();
      this.turn = Config.TEAM.PLAYER;
      this.startTurnForTeam(Config.TEAM.PLAYER);
      this.abilityMode = null;
      this.updateHUD();
      this.renderEntities();
    }
  }

  async endTurnPvP() {
    const prevTurn = this.turn;
    const nextTurn = prevTurn === Config.TEAM.PLAYER ? Config.TEAM.AI : Config.TEAM.PLAYER;
    
    // Both teams' Nexuses do damage at the end of every PVP turn
    this.applyNexusEffects(Config.TEAM.PLAYER);
    this.applyNexusEffects(Config.TEAM.AI);

    this.turn = nextTurn;
    // If we've just completed the opponent's turn and are returning to Player,
    // that's the end of a full round — tick global status durations once.
    if (nextTurn === Config.TEAM.PLAYER && prevTurn !== Config.TEAM.PLAYER) {
      this.tickTimedStatusesGlobal();
    }

    this.startTurnForTeam(nextTurn);
    
    this.abilityMode = null;
    this.updateHUD();
    this.renderEntities();
    this.checkWin();
  }

  async runAI() {
    try {
    const aiBase = this.entities.find(e => e.kind === "base" && e.team === Config.TEAM.AI);
    if (aiBase && window.Entities && window.Entities.unitDefs) {
      const t = this.chooseAIPurchaseType();
      if (t) {
        const cost = window.Entities.unitDefs[t].cost || 0;
        if (this.energy[Config.TEAM.AI] >= cost) {
          if (this.spawnUnitNearBase(Config.TEAM.AI, t)) {
            this.spendEnergy(Config.TEAM.AI, cost);
            this.logEvent({ type: "status", msg: `AI purchased ${t}` });
          }
        }
      }
      // AI Rune Purchasing
      if (window.RuneDefs && this.energy[Config.TEAM.AI] >= 2) {
        const pick = this.chooseBestAIRunePurchase();
        if (pick && this.buyRune(pick.unit, pick.rune.id)) {
          this.logEvent({ type: "status", msg: `AI bought ${pick.rune.name || "a rune"} for ${pick.unit.type}` });
        }
      }
    }
    const playerBase = this.entities.find(e => e.kind === "base" && e.team === Config.TEAM.PLAYER);
    const aiUnits = this.entities.filter(e => e.kind === "unit" && e.team === Config.TEAM.AI);
    const playerUnits = this.entities.filter(e => e.kind === "unit" && e.team === Config.TEAM.PLAYER);
    for (const u of aiUnits) {
      // Per-unit realm-aware enemy list and focus
      const foes = playerUnits.filter(p => ((!!p.inShadowRealm) === (!!u.inShadowRealm)));
      const focus = foes.length ? foes.slice().sort((a, b) => a.hp - b.hp)[0] : playerBase;
      let aiActionGuard = 0;
      while (u.ap > 0 && aiActionGuard++ < 12) {
        const healTargets = this.getHealTargets(u);
        if (u.type === "Druid" && ((u.abilityCooldowns["Shapeshift"] || 0) === 0) && !u.isBeast) {
          const def = this.getAbilityDefForUnit(u);
          const enemiesNearby = foes.some(p => Math.max(Math.abs(p.row - u.row), Math.abs(p.col - u.col)) <= 2);
          if (def && (u.hp <= Math.ceil(u.maxHp * 0.65) || enemiesNearby)) {
            def.perform(this, u, u.row, u.col);
            this.animateAbilityCast(u, def, u.row, u.col);
            await this.delay(360);
            continue;
          }
        }
        if (u.type === "Sentinel" && ((u.abilityCooldowns["Fortify"] || 0) === 0)) {
          const def = this.getAbilityDefForUnit(u);
          const enemiesNearby = foes.some(p => Math.max(Math.abs(p.row - u.row), Math.abs(p.col - u.col)) <= 2);
          if (def && (u.hp <= Math.ceil(u.maxHp * 0.75) || enemiesNearby)) {
            def.perform(this, u);
            this.animateAbilityCast(u, def, u.row, u.col);
            await this.delay(300);
            continue;
          }
        }
        if (u.type === "Bulwark" && ((u.abilityCooldowns["Shield Line"] || 0) === 0)) {
          const def = this.getAbilityDefForUnit(u);
          const adjacentAllies = this.entities.filter(e => e.kind === "unit" && e.team === u.team && e !== u && Math.max(Math.abs(e.row - u.row), Math.abs(e.col - u.col)) <= 1);
          const enemiesNearby = foes.some(p => Math.max(Math.abs(p.row - u.row), Math.abs(p.col - u.col)) <= 2);
          if (def && (adjacentAllies.length || enemiesNearby || u.hp <= Math.ceil(u.maxHp * 0.7))) {
            def.perform(this, u);
            this.animateAbilityCast(u, def, u.row, u.col);
            await this.delay(300);
            continue;
          }
        }
        if (u.type === "Stalker" && ((u.abilityCooldowns["Ambush"] || 0) === 0)) {
          const def = this.getAbilityDefForUnit(u);
          if (def) {
            const scored = def.computeTargets(this, u).map(([r, c]) => {
              const target = this.occupants[r][c];
              if (!target || target.team === u.team) return { r, c, score: 0, target: null };
              let score = (target.kind === "base" ? 8 : 3 + (target.maxHp - target.hp));
              if (target.hp <= 3) score += 5;
              return { r, c, score, target };
            }).sort((a, b) => b.score - a.score);
            if (scored.length && scored[0].score > 0) {
              def.perform(this, u, scored[0].r, scored[0].c);
              this.animateAbilityCast(u, def, scored[0].r, scored[0].c);
              this.logEvent({ type: "ability", caster: `AI Stalker`, ability: "Ambush", target: scored[0].target ? `${scored[0].target.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${scored[0].target.kind === "unit" ? scored[0].target.type : "Base"}` : "Unknown" });
              await this.delay(320);
              continue;
            }
          }
        }
        if (u.type === "Ballista" && ((u.abilityCooldowns["Set Up"] || 0) === 0) && (u.siegeTurns || 0) === 0) {
          const def = this.getAbilityDefForUnit(u);
          if (def) {
            const distToFocus = focus ? Math.abs(focus.row - u.row) + Math.abs(focus.col - u.col) : 0;
            if (distToFocus > u.range || foes.some(p => Math.abs(p.row - u.row) + Math.abs(p.col - u.col) > u.range)) {
              def.perform(this, u);
              this.animateAbilityCast(u, def, u.row, u.col);
              await this.delay(300);
              continue;
            }
          }
        }
        if (u.type === "Avenger" && ((u.abilityCooldowns["Vengeance"] || 0) === 0) && this.getAvengerPendingDeaths(u) > 0) {
          const def = this.getAbilityDefForUnit(u);
          if (def) {
            def.perform(this, u);
            this.animateAbilityCast(u, def, u.row, u.col);
            await this.delay(320);
            continue;
          }
        }
        if (u.type === "Necromancer" && ((u.abilityCooldowns["Raise Dead"] || 0) === 0)) {
          const def = this.getAbilityDefForUnit(u);
          if (def) {
            const targets = def.computeTargets(this, u)
              .sort((a, b) => (Math.abs(focus.row - a[0]) + Math.abs(focus.col - a[1])) - (Math.abs(focus.row - b[0]) + Math.abs(focus.col - b[1])));
            if (targets.length >= 2) {
              const count = Math.min(3, targets.length);
              const selected = targets.slice(0, count);
              if (typeof def.performSelected === "function") def.performSelected(this, u, selected);
              else {
                for (const [tr, tc] of selected) def.perform(this, u, tr, tc);
              }
              for (const [tr, tc] of selected) this.animateAbilityCast(u, def, tr, tc);
              this.abilityMode = null;
              await this.delay(360);
              continue;
            }
          }
        }
        if (u.type === "Mage" && ((u.abilityCooldowns["Frostbolt"] || 0) === 0)) {
          const def = (window.Abilities && window.Abilities.Mage && window.Abilities.Mage[0]);
          if (def) {
            const targets = def.computeTargets(this, u);
            // Prioritize units with AP > 0 (to stun them), hexed targets, or low HP
            const scored = targets.map(([r, c]) => {
              const target = this.occupants[r][c];
              if (!target) return { r, c, score: 0 };
              let score = 0;
              if (target.kind === "unit") {
                 if ((target.stunnedTurns || 0) > 0) score -= 4;
                 if (target.ap > 0) score += 5;
                 if (target.hexMarked) score += 3;
                 score += (target.maxHp - target.hp); // Finish off weak
              }
              return { r, c, score };
            }).sort((a, b) => b.score - a.score);
            
            if (scored.length > 0) {
              const best = scored[0];
              const target = this.occupants[best.r][best.c];
              def.perform(this, u, best.r, best.c);
              this.animateAbilityCast(u, def, best.r, best.c);
              this.logEvent({ type: "ability", caster: `AI ${u.type}`, ability: "Frostbolt", target: target ? `${target.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${target.kind === "unit" ? target.type : "Base"}` : "Unknown" });
              await this.delay(320);
              continue;
            }
          }
        }
        if (u.type === "Hex" && ((u.abilityCooldowns["Hex"] || 0) === 0)) {
          const def = (window.Abilities && window.Abilities.Hex && window.Abilities.Hex[0]);
          if (def) {
            const targets = def.computeTargets(this, u);
            // Prioritize non-hexed units with high HP or proximity to base
            const scored = targets.map(([r, c]) => {
              const target = this.occupants[r][c];
              if (!target || target.hexMarked) return { r, c, score: 0, target: null };
              let score = 1;
              if (target.kind === "unit") score += target.hp;
              if (target.kind === "base") score += 10;
              return { r, c, score, target };
            }).sort((a, b) => b.score - a.score);
            if (scored.length > 0 && scored[0].score > 0) {
              const target = scored[0].target;
              def.perform(this, u, scored[0].r, scored[0].c);
              this.animateAbilityCast(u, def, scored[0].r, scored[0].c);
              this.logEvent({ type: "ability", caster: `AI ${u.type}`, ability: "Hex", target: `${target.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${target.kind === "unit" ? target.type : "Base"}` });
              await this.delay(320);
              continue;
            }
          }
        }
        if (u.type === "Sludge" && ((u.abilityCooldowns["Mire"] || 0) === 0)) {
          const def = (window.Abilities && window.Abilities.Sludge && window.Abilities.Sludge[0]);
          if (def) {
            const targets = def.computeTargets(this, u);
            // Prioritize areas with most enemies and avoid hitting allies
            const scored = targets.map(([r, c]) => {
              let score = 0;
              for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                  const rr = r + dr, cc = c + dc;
                  if (this.inBounds(rr, cc)) {
                    const occ = this.occupants[rr][cc];
                    if (occ && occ.kind === "unit") {
                      if (occ.team !== u.team) score += 1;
                      else if (occ.team === u.team) score -= 2; // Avoid hitting allies
                    }
                  }
                }
              }
              return { r, c, score };
            }).sort((a, b) => b.score - a.score);
            if (scored.length > 0 && scored[0].score > 0) {
              def.perform(this, u, scored[0].r, scored[0].c);
              this.animateAbilityCast(u, def, scored[0].r, scored[0].c);
              const [displayRow, displayCol] = this.getDisplayCoords(scored[0].r, scored[0].c);
              this.logEvent({ type: "ability", caster: `AI ${u.type}`, ability: "Mire", target: `(${displayRow}, ${displayCol})` });
              await this.delay(320);
              continue;
            }
          }
        }
        if (["Slicer", "Bounty Hunter", "Silencer"].includes(u.type)) {
          const def = this.getAbilityDefForUnit(u);
          if (def && this.canActivateAbility(u, def)) {
            const targets = def.computeTargets(this, u);
            const scored = targets.map(([r, c]) => {
              const target = this.occupants[r][c];
              if (!target || target.team === u.team) return { r, c, score: 0, target: null };
              let score = target.hp || 1;
              if (u.type === "Slicer") score += target.maxHp || 0;
              if (u.type === "Silencer") score += (target.ap || 0) * 3 + (target.dmg || 0);
              if (u.type === "Bounty Hunter") score += target.hp <= 2 ? 6 : 0;
              return { r, c, score, target };
            }).sort((a, b) => b.score - a.score);
            if (scored.length > 0 && scored[0].score > 0) {
              def.perform(this, u, scored[0].r, scored[0].c);
              this.animateAbilityCast(u, def, scored[0].r, scored[0].c);
              this.logEvent({ type: "ability", caster: `AI ${u.type}`, ability: def.name, target: scored[0].target ? scored[0].target.type : "Unknown" });
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
                this.animateAbilityCast(u, def, bestTarget[0], bestTarget[1]);
                this.logEvent({ type: "ability", caster: `AI ${u.type}`, ability: "Catalyze", target: `(${bestTarget[0]}, ${bestTarget[1]})` });
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
              let bestScore = -Infinity;
              for (const [r, c] of targets) {
                let score = 0;
                for (let dr = -1; dr <= 1; dr++) {
                  for (let dc = -1; dc <= 1; dc++) {
                    const rr = r + dr, cc = c + dc;
                    if (!this.inBounds(rr, cc)) continue;
                    const occ = this.occupants[rr][cc];
                    if (occ) {
                      if (occ.team !== u.team) score += occ.kind === "base" ? 4 : 2;
                      else score -= 3;
                    }
                  }
                }
                if (score > bestScore) { bestScore = score; bestTarget = [r, c]; }
              }
              if (bestTarget && bestScore > 0) {
                def.perform(this, u, bestTarget[0], bestTarget[1]);
                this.animateAbilityCast(u, def, bestTarget[0], bestTarget[1]);
                this.logEvent({ type: "ability", caster: `AI ${u.type}`, ability: "Ignite", target: `(${bestTarget[0]}, ${bestTarget[1]})` });
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
                if (this.isTerrainBlockingForUnit(terr, occ)) continue;
                const before = Math.max(Math.abs(r - u.row), Math.abs(c - u.col));
                const after  = Math.max(Math.abs(stepR - u.row), Math.abs(stepC - u.col));
                const gain = (before - after) + (occ.hp <= 2 ? 2 : 0);
                if (gain > bestGain) { bestGain = gain; best = [r, c]; }
              }
              if (best) {
                def.perform(this, u, best[0], best[1]);
                this.animateAbilityCast(u, def, best[0], best[1]);
                this.logEvent({ type: "ability", caster: `AI ${u.type}`, ability: "Pull", target: `(${best[0]}, ${best[1]})` });
                await this.delay(360);
                continue;
              }
            }
          }
          if (u.type === "Berserker" && ((u.abilityCooldowns["Whirlwind"] || 0) === 0)) {
            const def = this.getAbilityDefForUnit(u);
            const adj = this.getAdjacentEnemyTiles(u);
            if (def && adj.length) {
              def.perform(this, u);
              this.animateAbilityCast(u, def, u.row, u.col);
              this.logEvent({ type: "ability", caster: `AI Berserker`, ability: "Whirlwind" });
              await this.delay(320);
              continue;
            }
          }
          if (u.type === "Paladin" && ((u.abilityCooldowns["Smite"] || 0) === 0)) {
            const def = this.getAbilityDefForUnit(u);
            const smites = this.getSmiteTargets(u);
            if (def && smites.length) {
              smites.sort((a, b) => {
                const ta = this.occupants[a[0]][a[1]];
                const tb = this.occupants[b[0]][b[1]];
                const sa = (ta.kind === "base" ? 100 : 0) + (ta.maxHp - ta.hp);
                const sb = (tb.kind === "base" ? 100 : 0) + (tb.maxHp - tb.hp);
                return sb - sa;
              });
              const [tr, tc] = smites[0];
              const target = this.occupants[tr][tc];
              def.perform(this, u, tr, tc);
              this.animateAbilityCast(u, def, tr, tc);
              this.logEvent({ type: "ability", caster: `AI Paladin`, ability: "Smite", target: `${target.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${target.kind === "unit" ? target.type : "Base"}` });
              await this.delay(320);
              continue;
            }
          }
          if (u.type === "Archer" && ((u.abilityCooldowns["Snipe"] || 0) === 0)) {
            const def = this.getAbilityDefForUnit(u);
            const snipes = this.getSnipeTargets(u);
            if (def && snipes.length) {
              const scored = snipes.map(([tr, tc]) => {
                let score = 0;
                const dr = Math.sign(tr - u.row);
                const dc = Math.sign(tc - u.col);
                let rr = u.row + dr;
                let cc = u.col + dc;
                while (this.inBounds(rr, cc)) {
                  const terr = this.terrain[rr][cc];
                  if (this.isTerrainBlockingForUnit(terr, u)) break;
                  const occ = this.occupants[rr][cc];
                  if (occ && occ.team !== u.team) {
                    score += occ.kind === "base" ? 20 : 3 + (occ.maxHp - occ.hp);
                  } else if (occ && occ.team === u.team) {
                    score -= 2;
                  }
                  if (rr === tr && cc === tc) break;
                  rr += dr;
                  cc += dc;
                }
                return { tr, tc, score };
              }).sort((a, b) => b.score - a.score);
              const best = scored[0];
              if (!best || best.score <= 0) continue;
              const target = this.occupants[best.tr][best.tc];
              def.perform(this, u, best.tr, best.tc);
              this.animateAbilityCast(u, def, best.tr, best.tc);
              this.logEvent({ type: "ability", caster: `AI Archer`, ability: "Snipe", target: target ? `${target.team === Config.TEAM.PLAYER ? "Player" : "AI"} ${target.kind === "unit" ? target.type : "Base"}` : `Line (${best.tr}, ${best.tc})` });
              await this.delay(300);
              continue;
            }
          }
          if (u.type === "Warrior" && ((u.abilityCooldowns["Charge"] || 0) === 0)) {
            const def = this.getAbilityDefForUnit(u);
            const charges = this.getChargeTargets(u);
            if (def && charges.length) {
              const best = charges.map(([r, c]) => {
                let score = 0;
                const dr = Math.sign(r - u.row);
                const dc = Math.sign(c - u.col);
                let rr = u.row + dr;
                let cc = u.col + dc;
                while (this.inBounds(rr, cc)) {
                  const terr = this.terrain[rr][cc];
                  if (this.isTerrainBlockingForUnit(terr, u)) break;
                  const occ = this.occupants[rr][cc];
                  if (occ && occ.kind === "unit") {
                    if (occ.team !== u.team) score += 3 + (occ.maxHp - occ.hp);
                    else score -= 2;
                  }
                  if (rr === r && cc === c) break;
                  rr += dr;
                  cc += dc;
                }
                score -= (Math.abs(focus.row - r) + Math.abs(focus.col - c)) * 0.1;
                return { r, c, score };
              }).sort((a, b) => b.score - a.score)[0];
              if (best && best.score > -Infinity) {
                def.perform(this, u, best.r, best.c);
                this.animateAbilityCast(u, def, best.r, best.c);
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
                this.animateAbilityCast(u, def, pick.r, pick.c);
                this.abilityMode = null;
                this.logEvent({ type: "ability", caster: `AI ${u.type}`, ability: "Construct", target: `(${pick.r}, ${pick.c})` });
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
                 this.animateAbilityCast(u, def, u.row, u.col);
                 this.logEvent({ type: "ability", caster: `AI ${u.type}`, ability: "Mass Heal" });
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
                 this.animateAbilityCast(u, def, pick.r, pick.c);
                 this.logEvent({ type: "ability", caster: `AI ${u.type}`, ability: "Shadow Strike", target: `(${pick.r}, ${pick.c})` });
                 await this.delay(320);
                 continue;
              }
            }
          }
        }
        if (u.type === "Plague" && ((u.abilityCooldowns["Infect"] || 0) === 0)) {
          const def = this.getAbilityDefForUnit(u);
          const targets = def ? def.computeTargets(this, u) : [];
          const scored = targets.map(([r, c]) => {
            const target = this.occupants[r][c];
            if (!target || target.team === u.team) return null;
            let cluster = 0;
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const rr = r + dr;
                const cc = c + dc;
                if (!this.inBounds(rr, cc)) continue;
                const occ = this.occupants[rr][cc];
                if (occ && occ.team !== u.team) cluster++;
              }
            }
            return { r, c, score: cluster + (target.diseased ? -3 : 2) + ((target.hp || 0) <= 20 ? 1 : 0) };
          }).filter(Boolean).sort((a, b) => b.score - a.score);
          if (def && scored.length && scored[0].score > 0) {
            def.perform(this, u, scored[0].r, scored[0].c);
            this.animateAbilityCast(u, def, scored[0].r, scored[0].c);
            await this.delay(320);
            continue;
          }
        }
        if (u.type === "Geomancer" && ((u.abilityCooldowns["Reshape"] || 0) === 0)) {
          const def = this.getAbilityDefForUnit(u);
          const targets = def ? def.computeTargets(this, u) : [];
          const aiBase = this.entities.find(e => e.kind === "base" && e.team === Config.TEAM.AI);
          const playerBaseRef = this.entities.find(e => e.kind === "base" && e.team === Config.TEAM.PLAYER);
          let bestPair = null;
          let bestScore = -Infinity;
          for (let i = 0; i < targets.length; i++) {
            for (let j = i + 1; j < targets.length; j++) {
              const a = targets[i];
              const b = targets[j];
              if (this.areasOverlap(a, b, 1)) continue;
              let score = 0;
              for (const [from, to] of [[a, b], [b, a]]) {
                const fromTiles = this.getAreaTiles(from[0], from[1], 1);
                const toTiles = this.getAreaTiles(to[0], to[1], 1);
                for (let k = 0; k < fromTiles.length; k++) {
                  const [fr, fc] = fromTiles[k];
                  const [tr, tc] = toTiles[k];
                  const occ = this.occupants[fr][fc];
                  if (!occ || occ.kind !== "unit") continue;
                  if (occ.team === Config.TEAM.AI) {
                    score += Math.abs(playerBaseRef.row - fr) + Math.abs(playerBaseRef.col - fc);
                    score -= Math.abs(playerBaseRef.row - tr) + Math.abs(playerBaseRef.col - tc);
                  } else {
                    score += Math.abs(aiBase.row - tr) + Math.abs(aiBase.col - tc);
                    score -= Math.abs(aiBase.row - fr) + Math.abs(aiBase.col - fc);
                  }
                }
              }
              if (score > bestScore) {
                bestScore = score;
                bestPair = [a, b];
              }
            }
          }
          if (def && bestPair && bestScore > 3) {
            def.performSelected(this, u, bestPair);
            this.animateAbilityCast(u, def, bestPair[0][0], bestPair[0][1]);
            await this.delay(360);
            continue;
          }
        }
        const attackables = this.getAttackTargets(u)
          .map(([r, c]) => this.occupants[r][c])
          .filter(Boolean);
        if (attackables.length > 0) {
          attackables.sort((a, b) => {
            const sa = (a.kind === "base" ? 100 : 0) + (a.maxHp - a.hp) + (a.hexMarked ? 20 : 0);
            const sb = (b.kind === "base" ? 100 : 0) + (b.maxHp - b.hp) + (b.hexMarked ? 20 : 0);
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
        const nearestPlayer = playerUnits.filter(p => ((!!p.inShadowRealm) === (!!u.inShadowRealm))).slice().sort((a, b) => (Math.abs(a.row - u.row) + Math.abs(a.col - u.col)) - (Math.abs(b.row - u.row) + Math.abs(b.col - u.col)))[0];
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
      if (aiActionGuard >= 12 && u.ap > 0) {
        u.ap = 0;
        this.logEvent({ type: "status", msg: `AI skipped ${u.type} after too many actions.` });
      }
    }
    this.renderEntities();
    } catch (err) {
      console.error("AI Crash:", err);
      this.logEvent({ type: "status", msg: "AI Error: " + err.message });
    }
  }

  stepToward(sr, sc, tr, tc, unit) {
    const dummy = { ...unit, row: sr, col: sc };
    const maxSteps = Math.min((unit && unit.move) || 1, Config.MAX_MOVE_PER_ACTION || 3);
    dummy.movePattern = unit.movePattern || "orthogonal";
    const candidates = this.getReachableTiles(dummy, maxSteps);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => ((Math.abs(tr - a[0]) + Math.abs(tc - a[1])) - (Math.abs(tr - b[0]) + Math.abs(tc - b[1]))));
    return candidates[0] || null;
  }

  stepTowardSmart(sr, sc, tr, tc, unit) {
    const dummy = { ...unit, row: sr, col: sc };
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
      // Sludge avoidance: avoid moving into sludge
      const h = this.hazards[nr][nc];
      if (h && h.kind === "sludge") exp += 10;

      // Nexus attraction: AI units should prefer moving to/staying on Nexuses
      if (this.terrain[nr][nc] === "nexus" && this.nexusOwners[nr][nc] !== unit.team) {
        exp -= 15; // Huge bonus (negative exp = less danger/more attraction)
      }

      const d = Math.abs(tr - nr) + Math.abs(tc - nc);
      return { cell: [nr, nc], exp, d };
    }).sort((a, b) => (a.exp - b.exp) || (a.d - b.d));
    return scored[0].cell;
  }

  stepAway(sr, sc, er, ec, unit) {
    const dummy = { ...unit, row: sr, col: sc };
    const maxSteps = Math.min((unit && unit.move) || 1, Config.MAX_MOVE_PER_ACTION || 3);
    dummy.movePattern = unit.movePattern || "orthogonal";
    const candidates = this.getReachableTiles(dummy, maxSteps);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => ((Math.abs(er - b[0]) + Math.abs(ec - b[1])) - (Math.abs(er - a[0]) + Math.abs(ec - a[1]))));
    return candidates[0] || null;
  }

  checkWin() {
    if (this.matchResolved) return;
    const pBase = this.entities.find(e => e.kind === "base" && e.team === Config.TEAM.PLAYER);
    const aBase = this.entities.find(e => e.kind === "base" && e.team === Config.TEAM.AI);
    if (pBase.hp <= 0) {
      this.matchResolved = true;
      const localWon = this.isMultiplayer ? this.playerTeam === Config.TEAM.AI : false;
      const winner = this.isMultiplayer ? (localWon ? "YOU WIN!" : "ENEMY WINS!") : "AI WINS!";
      if (localWon) {
        const reward = this.awardVictoryCoins();
        this.showOverlay(`${winner} The player base was destroyed. +${reward} coins earned.`);
      } else {
        this.showOverlay(`${winner} The player base was destroyed.`);
      }
      this.logEvent({ type: "status", msg: winner });
    } else if (aBase.hp <= 0) {
      this.matchResolved = true;
      const localWon = this.isMultiplayer ? this.playerTeam === Config.TEAM.PLAYER : true;
      const winner = this.isMultiplayer ? (localWon ? "YOU WIN!" : "ENEMY WINS!") : "PLAYER WINS!";
      if (localWon) {
        const reward = this.awardVictoryCoins();
        this.showOverlay(`${winner} The AI base was destroyed. +${reward} coins earned.`);
      } else {
        this.showOverlay(`${winner} The AI base was destroyed.`);
      }
      this.logEvent({ type: "status", msg: winner });
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
    this.log.push({ ts, ...event });
    this.renderLog();
  }

  renderLog() {
    const list = document.getElementById("log-list");
    if (!list) return;
    list.innerHTML = "";
    for (const e of this.log) {
      const li = document.createElement("li");
      const timeSpan = document.createElement("span");
      timeSpan.className = "log-time";
      timeSpan.textContent = `[${e.ts}] `;
      li.appendChild(timeSpan);
      
      const msgSpan = document.createElement("span");
      if (e.type === "attack") {
        const also = e.alsoTargets && e.alsoTargets.length
          ? ` <span class="small">(also in range: ${e.alsoTargets.join(", ")})</span>`
          : "";
        msgSpan.innerHTML = `${e.attacker} attacked ${e.target} for ${e.dmg} damage.${also}`;
      } else if (e.type === "ability") {
        const extra = e.msg ? ` (${e.msg})` : "";
        msgSpan.innerHTML = `${e.caster} used ${e.ability}${extra}${e.target ? ` on ${e.target}` : ""}.`;
      } else if (e.type === "death") {
        msgSpan.innerHTML = `${e.killer} killed ${e.victim}.`;
      } else if (e.type === "status") {
        msgSpan.innerHTML = `${e.msg}`;
      }
      li.appendChild(msgSpan);
      list.appendChild(li);
    }
    list.scrollTop = list.scrollHeight;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  tickCooldowns(team) {
    for (const e of this.entities) {
      if (e && e.kind === "unit" && e.team === team && e.abilityCooldowns) {
        for (const k of Object.keys(e.abilityCooldowns)) {
          e.abilityCooldowns[k] = Math.max(0, (e.abilityCooldowns[k] || 0) - 1);
        }
      }
    }
  }
}

Game.prototype.resetAPForTeam = function(team) {
  for (const e of this.entities) {
    if (e && e.kind === "unit" && e.team === team) {
      const st = e.stunnedTurns || 0;
      if (st > 0) {
        e.ap = 0;
        e.stunnedTurns = st - 1;
      } else {
        if (typeof this.refreshBiomeModifiersForUnit === "function") {
          this.refreshBiomeModifiersForUnit(e, { grantTurnStart: false });
        }
        e.ap = this.getEffectiveApMax(e);
      }
    }
  }
};

Game.prototype.applyHazardsForTeam = function(team) {
  for (const e of this.entities) {
    if (e && e.kind === "unit" && e.team === team) {
      const h = this.hazards[e.row][e.col];
      if (h && h.kind === "fire" && this.terrain[e.row][e.col] !== "water") {
        this.applyDamage(e, 20, null);
      }
      if (e && (e.burnTurns || 0) > 0) {
        this.applyDamage(e, 10, null);
        e.burnTurns = Math.max(0, (e.burnTurns || 0) - 1);
      }
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
 
// Terrain generation tuned for mirrored, clustered battlefields.
Game.prototype.generateTerrain = function() {
  const totalTiles = Config.ROWS * Config.COLS;
  const targetTiles = Math.max(24, Math.floor(totalTiles * (Config.TERRAIN_DENSITY || 0.2)));
  let placedTiles = 0;
  const blocked = new Set();
  const pAdj = this.getBuyPositions(Config.TEAM.PLAYER);
  const aAdj = this.getBuyPositions(Config.TEAM.AI);
  for (const [r, c] of pAdj) blocked.add(`${r},${c}`);
  for (const [r, c] of aAdj) blocked.add(`${r},${c}`);
  for (const e of this.entities) {
    if (e && e.row != null && e.col != null) blocked.add(`${e.row},${e.col}`);
  }

  const canPlace = (r, c) => {
    if (!this.inBounds(r, c)) return false;
    if (blocked.has(`${r},${c}`)) return false;
    if (this.occupants[r][c] != null) return false;
    return this.terrain[r][c] == null;
  };

  const placeMirrorPair = (r, c, terrain) => {
    const mr = Config.ROWS - 1 - r;
    const mc = Config.COLS - 1 - c;
    if (!canPlace(r, c) || !canPlace(mr, mc)) return false;
    this.terrain[r][c] = terrain;
    this.terrain[mr][mc] = terrain;
    placedTiles += (r === mr && c === mc) ? 1 : 2;
    return true;
  };

  const weightedTerrain = () => {
    const roll = Math.random();
    if (roll < 0.4) return "water";
    return "wall";
  };

  const growCluster = (terrain, startR, startC, size, bias) => {
    const frontier = [[startR, startC]];
    const dirs = bias || [[1,0],[-1,0],[0,1],[0,-1]];
    let attempts = 0;
    while (frontier.length && placedTiles < targetTiles && attempts++ < size * 18) {
      const [r, c] = frontier[Math.floor(Math.random() * frontier.length)];
      if (placeMirrorPair(r, c, terrain)) {
        if (--size <= 0) break;
      }
      const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
      const nr = r + dr + (Math.random() < 0.2 ? Math.sign(Math.random() - 0.5) : 0);
      const nc = c + dc + (Math.random() < 0.2 ? Math.sign(Math.random() - 0.5) : 0);
      if (this.inBounds(nr, nc)) frontier.push([nr, nc]);
      if (frontier.length > 14) frontier.shift();
    }
  };

  const randomNearCenter = (spread) => {
    const r = Math.floor(Config.ROWS / 2 + (Math.random() - 0.5) * spread);
    const c = Math.floor(Config.COLS / 2 + (Math.random() - 0.5) * spread);
    return [
      Math.max(1, Math.min(Config.ROWS - 2, r)),
      Math.max(1, Math.min(Config.COLS - 2, c)),
    ];
  };

  for (let i = 0; i < 2; i++) {
    const [r, c] = randomNearCenter(Config.ROWS);
    growCluster("water", r, c, 3 + Math.floor(Math.random() * 2), Math.random() < 0.5 ? [[1,0],[-1,0],[1,1],[-1,-1]] : [[0,1],[0,-1],[1,1],[-1,-1]]);
  }
  for (let i = 0; i < 2; i++) {
    const [r, c] = randomNearCenter(Config.ROWS - 2);
    growCluster("wall", r, c, 2 + Math.floor(Math.random() * 2), Math.random() < 0.5 ? [[1,0],[-1,0]] : [[0,1],[0,-1]]);
  }

  let safety = 0;
  while (placedTiles < targetTiles && safety++ < 1000) {
    const [r, c] = randomNearCenter(Config.ROWS + 4);
    growCluster(weightedTerrain(), r, c, 1 + Math.floor(Math.random() * 3));
  }
  this.placeNexuses();
};

Game.prototype.createParticles = function(r, c, color) {
  const cell = this.board.getCell(r, c);
  if (!cell) return;
  const count = 12;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.style.backgroundColor = color;
    p.style.left = "50%";
    p.style.top = "50%";
    const angle = Math.random() * 2 * Math.PI;
    const dist = 15 + Math.random() * 35;
    const tx = Math.cos(angle) * dist + "px";
    const ty = Math.sin(angle) * dist + "px";
    p.style.setProperty("--tx", tx);
    p.style.setProperty("--ty", ty);
    cell.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
};

Game.prototype.ensureFxLayer = function() {
  if (!this.board || !this.board.mountEl) return null;
  let layer = this.board.mountEl.querySelector(".fx-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "fx-layer";
    this.board.mountEl.appendChild(layer);
  }
  return layer;
};

Game.prototype.getCellCenter = function(r, c) {
  const cell = this.board.getCell(r, c);
  const grid = this.board.mountEl;
  if (!cell || !grid) return null;
  const cellRect = cell.getBoundingClientRect();
  const gridRect = grid.getBoundingClientRect();
  return {
    x: cellRect.left - gridRect.left + cellRect.width / 2,
    y: cellRect.top - gridRect.top + cellRect.height / 2
  };
};

Game.prototype.spawnBeamFx = function(from, to, className, duration) {
  const layer = this.ensureFxLayer();
  const a = this.getCellCenter(from.row, from.col);
  const b = this.getCellCenter(to.row, to.col);
  if (!layer || !a || !b) return;
  const beam = document.createElement("div");
  beam.className = `fx-beam ${className || ""}`.trim();
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(18, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  beam.style.width = `${length}px`;
  beam.style.left = `${a.x}px`;
  beam.style.top = `${a.y}px`;
  beam.style.setProperty("--fx-angle", `${angle}rad`);
  beam.style.transform = `translateY(-50%) rotate(${angle}rad)`;
  layer.appendChild(beam);
  setTimeout(() => beam.remove(), duration || 420);
};

Game.prototype.spawnBurstFx = function(r, c, className, duration) {
  const layer = this.ensureFxLayer();
  const center = this.getCellCenter(r, c);
  if (!layer || !center) return;
  const burst = document.createElement("div");
  burst.className = `fx-burst ${className || ""}`.trim();
  burst.style.left = `${center.x}px`;
  burst.style.top = `${center.y}px`;
  layer.appendChild(burst);
  setTimeout(() => burst.remove(), duration || 520);
};

Game.prototype.spawnMoveFx = function(from, to, dash) {
  const layer = this.ensureFxLayer();
  const a = this.getCellCenter(from.row, from.col);
  const b = this.getCellCenter(to.row, to.col);
  if (!layer || !a || !b) return;
  const trail = document.createElement("div");
  trail.className = `fx-move-trail${dash ? " dash" : ""}`;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(16, Math.hypot(dx, dy));
  trail.style.width = `${length}px`;
  trail.style.left = `${a.x}px`;
  trail.style.top = `${a.y}px`;
  trail.style.setProperty("--fx-angle", `${Math.atan2(dy, dx)}rad`);
  trail.style.transform = `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`;
  layer.appendChild(trail);
  setTimeout(() => trail.remove(), dash ? 520 : 420);
};

Game.prototype.animateAttack = function(attacker, target) {
  if (!attacker || !target) return;
  const sourceCell = this.board.getCell(attacker.row, attacker.col);
  if (sourceCell) {
    sourceCell.classList.add("attack-lunge");
    setTimeout(() => sourceCell.classList.remove("attack-lunge"), 420);
  }
  const range = Math.max(Math.abs(attacker.row - target.row), Math.abs(attacker.col - target.col));
  if (range <= 1) {
    this.spawnBurstFx(target.row, target.col, "fx-slash", 360);
    this.createParticles(target.row, target.col, "#f87171");
    return;
  }
  this.spawnBeamFx(attacker, target, "fx-arrow", 320);
  this.spawnBurstFx(target.row, target.col, "fx-impact", 380);
};

Game.prototype.animateAbilityCast = function(unit, def, r, c) {
  if (!unit || !def) return;
  const target = { row: typeof r === "number" ? r : unit.row, col: typeof c === "number" ? c : unit.col };
  const source = { row: unit.row, col: unit.col };
  const name = def.name || "";
  if (name === "Shapeshift") {
    this.spawnBurstFx(unit.row, unit.col, "fx-verdant", 900);
    this.createParticles(unit.row, unit.col, "#84cc16");
    return;
  }
  if (name === "Mass Heal") {
    this.spawnBurstFx(unit.row, unit.col, "fx-healwave", 760);
    this.createParticles(unit.row, unit.col, "#38bdf8");
    return;
  }
  if (name === "Ignite") {
    this.spawnBeamFx(source, target, "fx-fire", 340);
    this.spawnBurstFx(target.row, target.col, "fx-fireburst", 760);
    this.createParticles(target.row, target.col, "#fb923c");
    return;
  }
  if (name === "Mire") {
    this.spawnBeamFx(source, target, "fx-sludge", 340);
    this.spawnBurstFx(target.row, target.col, "fx-sludgeburst", 760);
    this.createParticles(target.row, target.col, "#84cc16");
    return;
  }
  if (name === "Hex") {
    this.spawnBeamFx(source, target, "fx-hex", 340);
    this.spawnBurstFx(target.row, target.col, "fx-hexburst", 560);
    return;
  }
  if (name === "Frostbolt") {
    this.spawnBeamFx(source, target, "fx-frost", 340);
    this.spawnBurstFx(target.row, target.col, "fx-frostburst", 620);
    return;
  }
  if (name === "Pull") {
    this.spawnBeamFx(source, target, "fx-magnet", 380);
    this.spawnBurstFx(target.row, target.col, "fx-impact", 420);
    const dest = {
      row: target.row + Math.sign(unit.row - target.row),
      col: target.col + Math.sign(unit.col - target.col)
    };
    if (this.inBounds(dest.row, dest.col)) {
      this.spawnBeamFx(target, dest, "fx-magnet", 260);
    }
    return;
  }
  if (name === "Raise Dead") {
    this.spawnBurstFx(target.row, target.col, "fx-necro", 680);
    return;
  }
  if (name === "Catalyze") {
    this.spawnBeamFx(source, target, "fx-alchemy", 320);
    this.spawnBurstFx(target.row, target.col, "fx-alchemyburst", 700);
    return;
  }
  if (name === "Shadow Strike") {
    this.spawnBurstFx(unit.row, unit.col, "fx-shadow", 540);
    this.spawnBurstFx(target.row, target.col, "fx-shadow", 540);
    return;
  }
  if (name === "Charge") {
    this.spawnBeamFx(source, target, "fx-charge", 260);
    this.spawnBurstFx(target.row, target.col, "fx-impact", 320);
    return;
  }
  if (name === "Smite") {
    this.spawnBeamFx(source, target, "fx-smite", 300);
    this.spawnBurstFx(target.row, target.col, "fx-radiant", 520);
    return;
  }
  if (name === "Snipe") {
    this.spawnBeamFx(source, target, "fx-arrow", 280);
    this.spawnBurstFx(target.row, target.col, "fx-impact", 320);
    return;
  }
  if (name === "Whirlwind") {
    this.spawnBurstFx(unit.row, unit.col, "fx-whirlwind", 600);
    return;
  }
  if (name === "Construct") {
    this.spawnBurstFx(target.row, target.col, "fx-build", 620);
    return;
  }
  if (name === "Fortify") {
    this.spawnBurstFx(unit.row, unit.col, "fx-healwave", 560);
    this.createParticles(unit.row, unit.col, "#60a5fa");
    return;
  }
  if (name === "Set Up") {
    this.spawnBurstFx(unit.row, unit.col, "fx-build", 560);
    this.createParticles(unit.row, unit.col, "#f59e0b");
    return;
  }
  this.spawnBurstFx(target.row, target.col, "fx-impact", 360);
};

Game.prototype.playSfx = function(kind) {
  const ctx = this.audioCtx;
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();

  if (kind === "transform") {
    o.type = "sawtooth";
    o.frequency.setValueAtTime(80, ctx.currentTime);
    o.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.5);
    o.frequency.linearRampToValueAtTime(60, ctx.currentTime + 1.2);
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 1.3);
    return;
  }

  if (kind === "construct") {
    o.type = "square";
    o.frequency.setValueAtTime(150, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.05, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.2);
    return;
  }

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

Game.prototype.placeNexuses = function() {
  let tries = 0;
  const centerRadius = 2;
  const ok = (r, c) => this.inBounds(r, c) && this.occupants[r][c] == null;
  while (tries++ < 1000) {
    const r = Math.floor(Config.ROWS / 2) + (Math.floor(Math.random() * (centerRadius * 2 + 1)) - centerRadius);
    const c = Math.floor(Config.COLS / 2) + (Math.floor(Math.random() * (centerRadius * 2 + 1)) - centerRadius);
    const pts = [
      [r, c],
      [r, Config.COLS - 1 - c],
      [Config.ROWS - 1 - r, c],
      [Config.ROWS - 1 - r, Config.COLS - 1 - c],
    ];
    const spaced = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) >= 2;
    const spacingOk =
      spaced(pts[0], pts[1]) && spaced(pts[0], pts[2]) && spaced(pts[0], pts[3]) &&
      spaced(pts[1], pts[2]) && spaced(pts[1], pts[3]) && spaced(pts[2], pts[3]);
    if (spacingOk && pts.every(([rr, cc]) => ok(rr, cc))) {
      for (const [rr, cc] of pts) {
        this.terrain[rr][cc] = "nexus";
        this.nexusOwners[rr][cc] = null;
      }
      break;
    }
  }
};

Game.prototype.pickMirroredBasePositions = function() {
  const minRow = Math.max(2, Math.floor(Config.ROWS * 0.62));
  const maxRow = Config.ROWS - 2;
  const minCol = 1;
  const maxCol = Math.max(3, Math.floor(Config.COLS * 0.4));
  const minDistance = Math.floor((Config.ROWS + Config.COLS) * 0.7);
  const candidates = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const mr = Config.ROWS - 1 - r;
      const mc = Config.COLS - 1 - c;
      const d = Math.abs(mr - r) + Math.abs(mc - c);
      if (d < minDistance) continue;
      if (!this.inBounds(r, c) || !this.inBounds(mr, mc)) continue;
      if (this.occupants[r][c] != null || this.occupants[mr][mc] != null) continue;
      candidates.push([[r, c], [mr, mc]]);
    }
  }
  if (candidates.length) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  return [[Config.ROWS - 2, 1], [1, Config.COLS - 2]];
};

Game.prototype.generateEnergy = function(team) {
  const produced = this.energyGenerated[team];
  const max = Config.ENERGY_MAX_TOTAL;
  if (produced >= max) return;
  if (this.energyDelayOne && this.energyDelayOne[team]) {
    this.energyDelayOne[team] = false;
    this.updateHUD();
    return;
  }
  let add = 0;
  const step = this.energyGainStep[team];
  if (step === 0) add = 3;
  else if (step === 1) add = 4;
  else if (step === 2) add = 5;
  else {
    add = 6;
    if (this.energyGainSixLeft[team] > 0) {
      this.energyGainSixLeft[team] -= 1;
    }
  }
  this.energyGainStep[team] = step + 1;
  this.energy[team] += add;
  this.energyGenerated[team] += add;
  this.updateHUD();
};

Game.prototype.getUpcomingGoldGain = function(team) {
  if (!team) return 0;
  const produced = this.energyGenerated[team] || 0;
  const max = Config.ENERGY_MAX_TOTAL || 99;
  if (produced >= max) return 0;
  if (this.energyDelayOne && this.energyDelayOne[team]) return 0;
  const step = this.energyGainStep[team] || 0;
  if (step === 0) return 3;
  if (step === 1) return 4;
  if (step === 2) return 5;
  return 6;
};

Game.prototype.applyNexusEffects = function(team) {
  let owned = 0;
  for (let r = 0; r < Config.ROWS; r++) {
    for (let c = 0; c < Config.COLS; c++) {
      if (this.terrain[r][c] === "nexus" && this.nexusOwners[r][c] === team) owned++;
    }
  }
  if (owned <= 0) return;
  const opp = team === Config.TEAM.PLAYER ? Config.TEAM.AI : Config.TEAM.PLAYER;
  const base = this.entities.find(e => e.kind === "base" && e.team === opp);
  if (base) {
    this.applyDamage(base, owned, null);
    let teamName = team === Config.TEAM.PLAYER ? "Player" : "AI";
    let oppName = opp === Config.TEAM.PLAYER ? "Player" : "AI";
    if (this.isMultiplayer) {
      teamName = team === this.playerTeam ? "Your" : "Enemy";
      oppName = opp === this.playerTeam ? "Your" : "Enemy";
    }
    this.logEvent({ type: "nexus", msg: `${teamName} nexus(es) dealt ${owned} damage to ${oppName} base` });
    this.renderEntities(); // Refresh base health bars
  }
};

Game.prototype.spendEnergy = function(team, amount) {
  if (this.energy[team] < amount) return false;
  this.energy[team] -= amount;
  this.updateHUD();
  // Update Buy Controls to reflect purchase
  this.renderBuyControls();
  return true;
};

Game.prototype.spawnUnitNearBase = function(team, type, forcedR, forcedC) {
  if (type === "Skeleton") {
    this.logEvent({ type: "error", msg: "Spawn denied: Skeleton is summon-only" });
    return false;
  }
  if (!this.isUnitDrafted(team, type)) {
    this.logEvent({ type: "error", msg: `Spawn denied: ${type} was not drafted` });
    return false;
  }
  if (this.purchasedUnits[team].has(type)) return false;
  if (this.entities.some(e => e.kind === "unit" && e.team === team && e.type === type)) return false;
  
  let r, c;
  if (forcedR !== undefined && forcedC !== undefined) {
    r = forcedR; c = forcedC;
  } else {
    const base = this.entities.find(e => e.kind === "base" && e.team === team);
    if (!base) return false;
    const res = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const rr = base.row + dr, cc = base.col + dc;
        if (!this.inBounds(rr, cc)) continue;
        
        const t = this.terrain[rr][cc];
        if (t === "water" || t === "wall" || t === "fortwall") continue;
        
        if (this.occupants[rr][cc] != null) continue;
        res.push([rr, cc]);
      }
    }
    if (res.length === 0) return false;
    const pos = res[Math.floor(Math.random() * res.length)];
    r = pos[0]; c = pos[1];
  }
  
  const u = Entities.makeUnit(team, type, r, c);
  this.addEntity(u);
  this.purchasedUnits[team].add(type);
  this.renderEntities();
  this.renderBuyControls();
  return u;
};

Game.prototype.syncState = function(data) {
  this.terrain = data.terrain;
  this.nexusOwners = data.nexusOwners || Array.from({ length: Config.ROWS }, () => Array(Config.COLS).fill(null));
  this.biomes = data.biomes || [];
  this.entities = [];
  this.occupants = Array.from({ length: Config.ROWS }, () => Array(Config.COLS).fill(null));
  
  for (const b of data.basePositions) {
    this.addEntity(Entities.makeBase(b.team, b.r, b.c));
  }
  
  this.renderEntities();
  this.updateHUD();
  this.renderBuyControls();
};

Game.prototype.buyRune = function(unit, runeId) {
  const rune = window.RuneDefs.find(r => r.id === runeId);
  if (!rune) return false;
  if (!unit || unit.kind !== "unit" || !this.entities.includes(unit)) return false;
  if (this.energy[unit.team] < rune.cost) return false;
  if (unit.runes.length >= 3) return false;
  if (unit.runes.some(r => r.id === runeId)) return false;

  this.spendEnergy(unit.team, rune.cost);
  const entry = this.createOwnedRune(rune);
  if (!entry) return false;
  unit.runes.push(entry);
  if (typeof rune.apply === "function") rune.apply(unit);
  this.playSfx && this.playSfx("heal");
  this.updateUnitPanel(unit);
  this.updateHUD();

  if (this.isMultiplayer && unit.team === this.playerTeam) {
    window.Multiplayer.sendPacket('BUY_RUNE', { fromR: unit.row, fromC: unit.col, runeId });
  }
  return true;
};

Game.prototype.setupDraftSystem = function() {
  if (!document.getElementById("menu-overlay")) {
    const overlay = document.createElement("div");
    overlay.id = "menu-overlay";
    overlay.className = "menu-overlay hidden";
    document.body.appendChild(overlay);
  }
  if (!document.getElementById("draft-overlay")) {
    const overlay = document.createElement("div");
    overlay.id = "draft-overlay";
    overlay.className = "draft-overlay";
    document.body.appendChild(overlay);
  }
  const menuBtn = document.getElementById("menu-btn");
  if (menuBtn) menuBtn.onclick = () => window.location.reload();
  this.showMainMenu();
};

Game.prototype.showDraftModeSelect = function() {
  this.renderMainMenu();
};

Game.prototype.startDraft = function(mode, options) {
  const opts = options || {};
  const draftMode = mode || "ai";
  if (draftMode === "pvp" && !this.canStartPvpDraft()) {
    this.logEvent({ type: "error", msg: `PvP needs at least ${this.minimumPvpCards} owned cards.` });
    this.renderMainMenu("pvp");
    return;
  }
  const firstTeam = opts.firstTeam || Config.TEAM.PLAYER;
  const secondTeam = firstTeam === Config.TEAM.PLAYER ? Config.TEAM.AI : Config.TEAM.PLAYER;
  const draftPool = this.getDraftableItems(draftMode);
  const defaultPoolSize = draftPool.length;
  const pickCount = typeof opts.pickCount === "number"
    ? opts.pickCount
    : Math.max(1, Math.min(8, Math.floor(Math.max(0, defaultPoolSize) / 2)));
  this.hideMainMenu();
  this.matchResolved = false;
  this.draftedUnits = { [Config.TEAM.PLAYER]: new Set(), [Config.TEAM.AI]: new Set() };
  this.aiDraftNotes = { summary: "", entries: [] };
  if (draftMode === "ai" && this.aiDraftLoaners.length) {
    this.logEvent({ type: "status", msg: `Training draft added ${this.aiDraftLoaners.length} temporary cards for this match.` });
  }
  this.draft = {
    active: true,
    completed: false,
    mode: draftMode,
    pickCount,
    randomized: !!opts.randomizeTeams,
    sequence: this.getDraftSequence(firstTeam, secondTeam, pickCount),
    currentIndex: 0,
    firstTeam,
    secondTeam
  };
  this.buySelection = null;
  this.biomeSelection = null;
  this.board.clearMarks();
  this.renderDraftOverlay();
  this.renderBuyControls();
  if (opts.randomizeTeams) {
    this.fillRandomDraftPicks();
    return;
  }
  if (this.isMultiplayer && !opts.remote && window.Multiplayer) {
    window.Multiplayer.sendPacket("DRAFT_START", { firstTeam, pickCount: this.draft.pickCount });
  }
  this.maybeRunAIDraftPick();
};

Game.prototype.fillRandomDraftPicks = function() {
  const available = this.getDraftableItems(this.draft.mode).slice();
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  const needed = this.draft.pickCount * 2;
  const picks = available.slice(0, needed);
  for (let i = 0; i < this.draft.pickCount; i++) this.draftedUnits[Config.TEAM.PLAYER].add(picks[i]);
  for (let i = this.draft.pickCount; i < needed; i++) this.draftedUnits[Config.TEAM.AI].add(picks[i]);
  this.draft.currentIndex = this.draft.sequence.length;
  this.logEvent({ type: "status", msg: "Random draft complete. Both rosters were assigned unique picks." });
  this.completeDraft();
};

Game.prototype.getDraftSequence = function(firstTeam, secondTeam, pickCount) {
  const base = [firstTeam, secondTeam, secondTeam, firstTeam];
  const sequence = [];
  while (sequence.filter(t => t === firstTeam).length < pickCount || sequence.filter(t => t === secondTeam).length < pickCount) {
    for (const team of base) {
      if (sequence.filter(t => t === team).length < pickCount) sequence.push(team);
    }
  }
  if (sequence.length >= 2 && sequence[sequence.length - 1] === firstTeam) {
    const previousIndex = sequence.length - 2;
    if (sequence[previousIndex] === secondTeam) {
      sequence[previousIndex] = firstTeam;
      sequence[sequence.length - 1] = secondTeam;
    }
  }
  return sequence;
};

Game.prototype.getDraftableUnits = function(modeOverride) {
  const defs = window.Entities && window.Entities.unitDefs ? window.Entities.unitDefs : {};
  const all = Object.keys(defs).filter(type => type !== "Skeleton" && !defs[type].hiddenFromShop);
  const owned = new Set(this.getOwnedUnitTypes());
  const loaners = modeOverride === "ai" ? new Set(this.aiDraftLoaners || []) : new Set();
  return all.filter(type => owned.has(type) || loaners.has(type));
};

Game.prototype.getDraftableItems = function(modeOverride) {
  const biomeDefs = window.Entities && window.Entities.biomeDefs ? window.Entities.biomeDefs : {};
  const ownedBiomes = new Set(this.getOwnedBiomeTypes());
  const owned = [...this.getDraftableUnits(modeOverride), ...Object.keys(biomeDefs).filter(type => ownedBiomes.has(type))];
  if (modeOverride !== "ai" || owned.length >= this.standardDraftCardsNeeded) {
    if (modeOverride !== "ai") this.aiDraftLoaners = [];
    return owned;
  }
  const all = this.getAllDraftableItems();
  const ownedSet = new Set(owned);
  const loaners = all.filter(type => !ownedSet.has(type)).slice(0, this.standardDraftCardsNeeded - owned.length);
  this.aiDraftLoaners = loaners;
  return [...owned, ...loaners];
};

Game.prototype.getAllDraftableItems = function() {
  const defs = window.Entities && window.Entities.unitDefs ? window.Entities.unitDefs : {};
  const biomeDefs = window.Entities && window.Entities.biomeDefs ? window.Entities.biomeDefs : {};
  return [
    ...Object.keys(defs).filter(type => type !== "Skeleton" && !defs[type].hiddenFromShop),
    ...Object.keys(biomeDefs),
  ];
};

Game.prototype.isDraftedItem = function(team, type) {
  if (!this.draft.completed) return false;
  return !!(this.draftedUnits[team] && this.draftedUnits[team].has(type));
};

Game.prototype.isUnitDrafted = function(team, type) {
  const defs = window.Entities && window.Entities.unitDefs ? window.Entities.unitDefs : {};
  return !!defs[type] && this.isDraftedItem(team, type);
};

Game.prototype.isBiomeDrafted = function(team, type) {
  const biomeDefs = window.Entities && window.Entities.biomeDefs ? window.Entities.biomeDefs : {};
  return !!biomeDefs[type] && this.isDraftedItem(team, type);
};

Game.prototype.renderDraftMapPreviewHTML = function() {
  let html = "";
  for (let r = 0; r < Config.ROWS; r++) {
    for (let c = 0; c < Config.COLS; c++) {
      const base = this.entities.find(e => e.kind === "base" && e.row === r && e.col === c);
      const terrain = this.terrain[r][c] || "plain";
      const label = base ? this.getDisplayEntitySymbol(base) : "";
      const baseClass = base ? ` draft-base-${base.team === (this.isMultiplayer ? this.playerTeam : Config.TEAM.PLAYER) ? "friendly" : "enemy"}` : "";
      html += `<span class="draft-map-cell draft-terrain-${terrain}${baseClass}">${label}</span>`;
    }
  }
  return html;
};

Game.prototype.getDraftTeamLabel = function(team) {
  if (this.isMultiplayer) return team === this.playerTeam ? "You" : "Opponent";
  return team === Config.TEAM.PLAYER ? "Player" : "AI";
};

Game.prototype.getDraftDotClass = function(team) {
  const localTeam = this.isMultiplayer ? this.playerTeam : Config.TEAM.PLAYER;
  return team === localTeam ? "friendly" : "enemy";
};

Game.prototype.renderDraftPicksHTML = function(team) {
  const picks = Array.from(this.draftedUnits[team] || []);
  const defs = window.Entities.unitDefs || {};
  const biomeDefs = window.Entities.biomeDefs || {};
  const slots = [];
  for (let i = 0; i < this.draft.pickCount; i++) {
    const type = picks[i];
    const def = type ? (defs[type] || biomeDefs[type]) : null;
    slots.push(`<div class="draft-pick-slot${type ? " filled" : ""}">${def ? `${def.symbol} ${type}` : "Open"}</div>`);
  }
  return slots.join("");
};

Game.prototype.getDraftAverageCostLabel = function(team) {
  const defs = window.Entities.unitDefs || {};
  const biomeDefs = window.Entities.biomeDefs || {};
  const picks = Array.from(this.draftedUnits[team] || []);
  if (!picks.length) return "Avg Cost: 🪙 --";
  const totalCost = picks.reduce((sum, type) => {
    const def = defs[type] || biomeDefs[type] || {};
    return sum + Number(def.cost || 0);
  }, 0);
  const averageCost = totalCost / picks.length;
  const formattedCost = Number.isInteger(averageCost)
    ? String(averageCost)
    : averageCost.toFixed(1).replace(/\.0$/, "");
  return `Avg Cost: 🪙 ${formattedCost}`;
};

Game.prototype.getDraftClassCounts = function(team) {
  const defs = window.Entities.unitDefs || {};
  const counts = {};
  for (const type of Array.from(this.draftedUnits[team] || [])) {
    if (!defs[type]) continue;
    const cls = this.getUnitClass(type);
    counts[cls] = (counts[cls] || 0) + 1;
  }
  return counts;
};

Game.prototype.describeCounterTarget = function(type) {
  const cls = this.getUnitClass(type);
  if (cls === "Marksman") return "pressure your backline before range snowballs";
  if (cls === "Tank") return "keep stronger control and sustained damage online";
  if (cls === "Support") return "force sharper trades before healing matters";
  if (cls === "Assassin") return "protect softer picks and anchor the lane";
  if (cls === "Control") return "spread threats so one disable matters less";
  if (cls === "Fighter") return "match tempo and punish direct brawls";
  return "keep a flexible board";
};

Game.prototype.getAIDraftStrategySummary = function() {
  const counts = this.getDraftClassCounts(Config.TEAM.AI);
  const parts = [];
  if ((counts.Tank || 0) > 0) parts.push("frontline");
  if ((counts.Marksman || 0) > 0) parts.push("range");
  if ((counts.Artillery || 0) > 0) parts.push("siege range");
  if ((counts.Support || 0) > 0) parts.push("sustain");
  if ((counts.Control || 0) > 0) parts.push("control");
  if ((counts.Assassin || 0) > 0) parts.push("pick pressure");
  if ((counts.Fighter || 0) > 0) parts.push("tempo");
  if (!parts.length) return "Still feeling out the draft.";
  const core = parts.slice(0, 3).join(", ");
  // Detect if we're committing to a class (>=2 pieces)
  let committedClass = null;
  let maxCount = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > maxCount) {
      maxCount = v;
      committedClass = k;
    }
  }
  if (maxCount >= 2) {
    return `Committed: ${committedClass}-leaning. Current plan: ${core}.`;
  }
  return `Current plan: ${core}.`;
};

Game.prototype.pushAIDraftNote = function(kind, text) {
  if (this.draft.mode !== "ai" || !text) return;
  this.aiDraftNotes.summary = this.getAIDraftStrategySummary();
  this.aiDraftNotes.entries.unshift({ kind, text });
  this.aiDraftNotes.entries = this.aiDraftNotes.entries.slice(0, 6);
};

Game.prototype.getAIDraftScoredCandidates = function() {
  const defs = window.Entities.unitDefs || {};
  const biomeDefs = window.Entities.biomeDefs || {};
  const picked = new Set([...this.draftedUnits[Config.TEAM.PLAYER], ...this.draftedUnits[Config.TEAM.AI]]);
  const ownPicks = Array.from(this.draftedUnits[Config.TEAM.AI]);
  const ownUnitPicks = ownPicks.filter(type => defs[type]);
  const ownClasses = ownPicks.filter(type => defs[type]).map(type => this.getUnitClass(type));
  const ownCosts = ownUnitPicks.map(type => Number((defs[type] && defs[type].cost) || 0)).filter(n => n > 0);
  const ownLowCostCount = ownCosts.filter(c => c <= 2).length;
  const ownEarlyCurveCount = ownCosts.filter(c => c <= 3).length;
  const ownBiomeCount = ownPicks.filter(type => biomeDefs[type]).length;
  const wantedClasses = ["Tank", "Assassin", "Breaker", "Marksman", "Artillery", "Support", "Disruptor", "Control", "Fighter"];
  const available = this.getDraftableItems(this.draft.mode).filter(type => !picked.has(type));
  if (!available.length) return [];
  const playerClassCounts = this.getDraftClassCounts(Config.TEAM.PLAYER) || {};
  const classCounters = {
    Marksman: ["Assassin", "Stalker", "Disruptor"],
    Tank: ["Breaker", "Control", "Marksman"],
    Support: ["Disruptor", "Assassin", "Paladin"],
    Assassin: ["Sentinel", "Paladin", "Marksman"],
    Control: ["Marksman", "Assassin", "Disruptor"],
    Fighter: ["Marksman", "Control", "Breaker"],
    Breaker: ["Marksman", "Control", "Disruptor"],
    Disruptor: ["Assassin", "Marksman", "Breaker"]
  };
  const scored = available.map(type => {
    const isBiome = !!biomeDefs[type];
    const def = defs[type] || biomeDefs[type];
    const cls = isBiome ? "Biome" : this.getUnitClass(type);
    const cost = Number(def.cost || 0);
    let score = cost * 0.35;

    if (isBiome) {
      score += ownBiomeCount < 2 ? 4 : -5;
      if (ownPicks.length < 5) score -= 4;
      if (type === "Forge" && ownClasses.includes("Tank")) score += 3;
      if (type === "Watchtower" && ownClasses.includes("Marksman")) score += 3;
      if (type === "Sanctum" && ownClasses.includes("Support")) score += 3;
      if (type === "Boxing Arena" && ownClasses.includes("Fighter")) score += 3;
    } else {
      // Prefer filling missing wanted classes
      if (wantedClasses.includes(cls) && !ownClasses.includes(cls)) score += 4;

      // Add small situational bonuses based on player picks (counters)
      for (const [pcls, cnt] of Object.entries(playerClassCounts || {})) {
        if (!cnt) continue;
        if (classCounters[pcls] && classCounters[pcls].includes(cls)) {
          score += 3 * cnt; // scale with how many of that class the player has
        }
        // Discourage direct mirroring of the player's dominant class
        if (pcls === cls) score -= 1.5 * cnt;
      }

      // Minor context-sensitive boosts
      if (this.draftedUnits[Config.TEAM.PLAYER].has("Warrior") && cls === "Marksman") score += 1.5;
      if (this.draftedUnits[Config.TEAM.PLAYER].has("Archer") && cls === "Assassin") score += 1.5;

      // Tight curve so AI can play turn 1 and turn 2.
      if (ownPicks.length < 3) {
        if (cost <= 2) score += 7;
        else if (cost <= 3) score += 3;
        else if (cost >= 5) score -= 5;
      }
      if (ownPicks.length < 5 && ownLowCostCount < 1 && cost <= 2) score += 8;
      if (ownPicks.length < 6 && ownEarlyCurveCount < 2 && cost <= 3) score += 5;

      // Avoid over-committing one class too early.
      const sameClassCount = ownClasses.filter(c => c === cls).length;
      if (sameClassCount >= 2 && ownPicks.length < 6) score -= 4;

      // Explicit synergy structure.
      if (ownClasses.includes("Tank") && (cls === "Marksman" || cls === "Artillery")) score += 2.5;
      if (ownClasses.includes("Control") && (cls === "Marksman" || cls === "Assassin" || cls === "Artillery")) score += 2;
      if (ownClasses.includes("Support") && (cls === "Tank" || cls === "Fighter" || cls === "Breaker")) score += 1.5;
      if (ownClasses.includes("Artillery") && cls === "Tank") score += 2;

      // Avoid too many expensive-only picks.
      if (cost >= 5 && ownCosts.filter(c => c >= 5).length >= 2 && ownPicks.length < 6) score -= 6;
    }
    return { type, score, cost };
  }).sort((a, b) => b.score - a.score);
  return scored;
};

Game.prototype.getAIDraftCurrentThought = function() {
  if (this.draft.mode !== "ai") return "";
  // Prefer the most-recent AI note if present (this captures the rationale after a pick)
  if (this.aiDraftNotes && Array.isArray(this.aiDraftNotes.entries) && this.aiDraftNotes.entries.length) {
    const topEntry = this.aiDraftNotes.entries[0];
    if (topEntry && topEntry.text) return topEntry.text;
  }
  const scored = this.getAIDraftScoredCandidates();
  if (!scored || !scored.length) return "No good options remain.";
  const top = scored[0];
  const alternates = scored.slice(1, 4).map(s => s.type);
  const commentary = this.getAIDraftPickCommentary(top.type) || "This is attractive for multiple reasons.";
  let thought = `Considering ${top.type}: ${commentary}`;
  if (alternates.length) thought += ` Alternatives: ${alternates.join(", ")}.`;
  return thought;
};

Game.prototype.pickDraftPhrase = function(options, seed) {
  if (!options || !options.length) return "";
  const text = String(seed || "");
  let hash = (this.draft && this.draft.currentIndex) || 0;
  for (let i = 0; i < text.length; i++) hash += text.charCodeAt(i) * (i + 1);
  return options[Math.abs(hash) % options.length];
};

Game.prototype.joinDraftList = function(items) {
  const clean = (items || []).filter(Boolean);
  if (clean.length <= 1) return clean[0] || "";
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
};

Game.prototype.getAIDraftCounterMap = function() {
  return {
    Marksman: ["Assassin", "Fighter", "Disruptor"],
    Tank: ["Breaker", "Control", "Marksman"],
    Support: ["Disruptor", "Assassin", "Marksman"],
    Assassin: ["Tank", "Marksman", "Support"],
    Control: ["Marksman", "Assassin", "Disruptor"],
    Fighter: ["Marksman", "Control", "Breaker"],
    Breaker: ["Marksman", "Control", "Disruptor"],
    Disruptor: ["Assassin", "Marksman", "Breaker"],
    Artillery: ["Assassin", "Disruptor", "Marksman"]
  };
};

Game.prototype.getAIDraftRolePhrase = function(type) {
  const biomeDefs = window.Entities.biomeDefs || {};
  if (biomeDefs[type]) {
    const biomeRoles = {
      Watchtower: "stretch the fight into safer firing lanes",
      Forge: "make frontliners harder to dislodge",
      Sanctum: "turn close trades into longer sustain fights",
      "Boxing Arena": "reward early brawling and tight-space pressure"
    };
    return biomeRoles[type] || "change which units scale best on this map";
  }
  const cls = this.getUnitClass(type);
  const roles = {
    Tank: "give the draft a real anchor",
    Marksman: "create ranged pressure that punishes slow setups",
    Support: "make longer fights safer for the pieces I already have",
    Assassin: "threaten the backline instead of letting it free-fire",
    Control: "break up your clean turns and force awkward trades",
    Fighter: "contest space early and keep tempo from slipping away",
    Breaker: "open a way through bulky targets",
    Disruptor: "cut into synergy before it gets comfortable",
    Artillery: "apply long-range pressure while ignoring wall lines"
  };
  return roles[cls] || "keep the draft flexible";
};

Game.prototype.getAIDraftCounterTargetsForPick = function(type) {
  const defs = window.Entities.unitDefs || {};
  if (!defs[type]) return [];
  const cls = this.getUnitClass(type);
  const counters = this.getAIDraftCounterMap();
  const playerCounts = this.getDraftClassCounts(Config.TEAM.PLAYER) || {};
  return Object.entries(playerCounts)
    .filter(([pcls, count]) => count > 0 && (counters[pcls] || []).includes(cls))
    .map(([pcls, count]) => count > 1 ? `${pcls} stack` : pcls);
};

Game.prototype.getAIDraftSynergiesForPick = function(type) {
  const cls = this.getUnitClass(type);
  const ownPicks = Array.from(this.draftedUnits[Config.TEAM.AI] || []);
  const synergies = [];
  if (ownPicks.includes("Watchtower") && cls === "Marksman") synergies.push("Watchtower lanes");
  if (ownPicks.includes("Forge") && (cls === "Tank" || cls === "Breaker")) synergies.push("Forge durability");
  if (ownPicks.includes("Sanctum") && cls === "Support") synergies.push("Sanctum sustain");
  if (ownPicks.includes("Boxing Arena") && cls === "Fighter") synergies.push("Boxing Arena tempo");
  if (ownPicks.some(p => this.getUnitClass(p) === "Tank") && cls === "Marksman") synergies.push("frontline cover");
  if (ownPicks.some(p => this.getUnitClass(p) === "Control") && (cls === "Marksman" || cls === "Assassin")) synergies.push("control setup");
  if (ownPicks.some(p => this.getUnitClass(p) === "Support") && (cls === "Tank" || cls === "Fighter")) synergies.push("sustain backing");
  return Array.from(new Set(synergies)).slice(0, 2);
};

Game.prototype.getAIDraftPlanDevelopment = function(type) {
  const biomeDefs = window.Entities.biomeDefs || {};
  if (biomeDefs[type]) {
    return this.pickDraftPhrase([
      `That nudges the whole plan toward ${this.getAIDraftRolePhrase(type)}.`,
      `The map is now part of the win condition, not just scenery.`,
      `I can draft around that board texture from here.`
    ], type);
  }

  const cls = this.getUnitClass(type);
  const counts = this.getDraftClassCounts(Config.TEAM.AI) || {};
  const count = counts[cls] || 0;
  if (count <= 1) {
    return this.pickDraftPhrase([
      `This opens a ${cls} line I did not have before.`,
      `I am adding ${cls} tools without locking the whole draft yet.`,
      `This broadens the plan so I am not relying on one angle.`
    ], `${type}-first`);
  }
  if (count === 2) {
    return this.pickDraftPhrase([
      `Now the ${cls} plan is real enough to build around.`,
      `This turns ${cls} from a splash into a clear lane.`,
      `I am starting to commit: future picks can support this ${cls} core.`
    ], `${type}-second`);
  }
  return this.pickDraftPhrase([
    `At this point I am leaning hard into ${cls} and forcing you to answer it.`,
    `This is a commitment pick: the rest of my draft should protect this ${cls} identity.`,
    `I am doubling down because the board is giving this ${cls} plan room.`
  ], `${type}-stack`);
};

Game.prototype.getAIDraftPickRationale = function(type) {
  const biomeDefs = window.Entities.biomeDefs || {};
  const isBiome = !!biomeDefs[type];
  const scored = this.getAIDraftScoredCandidates() || [];
  const counters = isBiome ? [] : this.getAIDraftCounterTargetsForPick(type);
  const synergies = isBiome ? [] : this.getAIDraftSynergiesForPick(type);
  const alternatives = scored.filter(s => s.type !== type).slice(0, 2).map(s => s.type);
  const role = this.getAIDraftRolePhrase(type);
  const plan = this.getAIDraftPlanDevelopment(type);
  const opener = this.pickDraftPhrase([
    `I am taking ${type} to ${role}.`,
    `${type} fits here because it helps me ${role}.`,
    `The ${type} pick is about one thing first: ${role}.`
  ], `${type}-opener`);
  const details = [];

  if (counters.length) {
    const targets = this.joinDraftList(counters);
    details.push(this.pickDraftPhrase([
      `It also gives me a cleaner answer into your ${targets}.`,
      `That matters because your ${targets} was starting to shape the draft.`,
      `I am not letting your ${targets} become the only story on the board.`
    ], `${type}-counter-${targets}`));
  }

  if (synergies.length) {
    const synergyText = this.joinDraftList(synergies);
    details.push(this.pickDraftPhrase([
      `It links up with my ${synergyText}, so the pieces are starting to talk to each other.`,
      `The nice part is the overlap with ${synergyText}; that makes the plan less scattered.`,
      `This is not isolated value either: ${synergyText} makes it easier to use.`
    ], `${type}-synergy-${synergyText}`));
  }

  if (!details.length && alternatives.length) {
    details.push(this.pickDraftPhrase([
      `I looked at ${this.joinDraftList(alternatives)}, but this keeps the plan cleaner.`,
      `${this.joinDraftList(alternatives)} were live options; this one gives me the clearer next step.`,
      `Rather than chase ${this.joinDraftList(alternatives)}, I am tightening the shape of my board.`
    ], `${type}-alts-${alternatives.join("-")}`));
  }

  if (!details.length) details.push(this.getAIDraftPickCommentary(type));
  return `${opener} ${details[0]} ${plan}`;
};

Game.prototype.getAIReactionRationaleForPlayerPick = function(type) {
  const biomeDefs = window.Entities.biomeDefs || {};
  const isBiome = !!biomeDefs[type];
  const cls = isBiome ? "Biome" : this.getUnitClass(type);
  const base = this.getAIReactionToPlayerPick(type) || "";
  const scored = this.getAIDraftScoredCandidates() || [];
  const responses = scored.slice(0, 2).map(s => s.type);
  const responseText = responses.length
    ? this.pickDraftPhrase([
      `My next looks are ${this.joinDraftList(responses)} if they stay open.`,
      `That pushes ${this.joinDraftList(responses)} higher on my board.`,
      `I am now checking whether ${this.joinDraftList(responses)} gives the cleanest reply.`
    ], `${type}-response-${responses.join("-")}`)
    : "I will keep the next pick flexible because the board is almost empty.";
  const opener = isBiome
    ? `You picked ${type}, so the map is becoming part of your plan.`
    : `You picked ${type}, which reads as a ${cls} signal.`;
  return `${opener} ${base} ${responseText}`;
};

Game.prototype.getAIDraftPickCommentary = function(type) {
  const defs = window.Entities.unitDefs || {};
  const biomeDefs = window.Entities.biomeDefs || {};
  const isBiome = !!biomeDefs[type];
  if (isBiome) {
    if (type === "Watchtower") return "I can turn range into a safer win condition from there.";
    if (type === "Forge") return "That makes durable units more annoying to remove.";
    if (type === "Sanctum") return "That rewards me for dragging fights out instead of coin-flipping bursts.";
    if (type === "Boxing Arena") return "That gives brawlers a reason to meet in the middle.";
    return "That changes which pieces are worth building around.";
  }
  const def = defs[type] || {};
  const range = def.range || 0;
  const cls = this.getUnitClass(type);
  if (cls === "Marksman" && range >= 3) return "I want safe damage that makes you cross the board under pressure.";
  if (cls === "Marksman") return "I want ranged pressure before the frontlines fully settle.";
  if (cls === "Tank") return "I need something that can stand in the way while the rest of the plan develops.";
  if (cls === "Support") return "I am buying time and making my trades compound.";
  if (cls === "Assassin") return "I want your fragile pieces to feel unsafe every turn.";
  if (cls === "Control") return "I am adding disruption so your best unit does not always get a clean turn.";
  if (cls === "Fighter") return "I am keeping the early board honest with a piece that can actually take space.";
  if (cls === "Breaker") return "I am preparing for armor, bulk, or anything trying to wall me out.";
  if (cls === "Disruptor") return "I am looking for ways to make your synergies misfire.";
  if (cls === "Artillery") return "I want long-range pressure that can fire over walls.";
  return "I am preserving flexibility until the draft shows a sharper weakness.";
};

Game.prototype.getAIReactionToPlayerPick = function(type) {
  const defs = window.Entities.unitDefs || {};
  const biomeDefs = window.Entities.biomeDefs || {};
  const isBiome = !!biomeDefs[type];
  if (isBiome) {
    if (type === "Watchtower") return "I should not let you stack range for free.";
    if (type === "Forge") return "I need damage or control that still matters into tougher frontlines.";
    if (type === "Sanctum") return "I should avoid slow trades unless I can outscale the healing.";
    if (type === "Boxing Arena") return "I need to respect early brawls and keep my spacing clean.";
    return "I need to re-price the units that benefit most from this terrain.";
  }
  const cls = this.getUnitClass(type);
  if (cls === "Marksman") return "I need either dive pressure or range of my own so that backline cannot fire for free.";
  if (cls === "Tank") return "I will look for ways around the wall instead of simply punching into it.";
  if (cls === "Support") return "I should shorten fights or disrupt the pieces that make healing valuable.";
  if (cls === "Assassin") return "I have to protect my backline and avoid drafting only fragile threats.";
  if (cls === "Control") return "I should avoid a plan that depends on one perfect activation.";
  if (cls === "Fighter") return "I need to contest tempo before you own the middle.";
  if (cls === "Breaker") return "I cannot rely on bulk alone if you are already drafting answers to it.";
  if (cls === "Disruptor") return "I should keep my synergies useful even when one piece gets shut down.";
  if (cls === "Artillery") return "I should not rely on walls for safety against your backline pressure.";
  return `I am adapting toward ${this.describeCounterTarget(type)}.`;
};

Game.prototype.renderAIDraftNotesHTML = function() {
  return "";
};

Game.prototype.getDraftedAffordableTypeForAI = function(maxCost) {
  const defs = window.Entities.unitDefs || {};
  const cap = Number(maxCost || 2);
  const team = Config.TEAM.AI;
  const drafted = Array.from(this.draftedUnits[team] || []).filter(t => defs[t]);
  const affordable = drafted.filter(t => (defs[t].cost || 0) <= cap);
  if (!affordable.length) return null;
  const sorted = affordable.sort((a, b) => {
    const da = defs[a] || {};
    const db = defs[b] || {};
    const ca = this.getUnitClass(a);
    const cb = this.getUnitClass(b);
    const sa = (da.hp || 0) + (ca === "Tank" ? 20 : 0) + (ca === "Fighter" ? 8 : 0);
    const sb = (db.hp || 0) + (cb === "Tank" ? 20 : 0) + (cb === "Fighter" ? 8 : 0);
    return sb - sa;
  });
  return sorted[0] || null;
};

Game.prototype.renderDraftOverlay = function() {
  const overlay = document.getElementById("draft-overlay");
  if (!overlay || !this.draft.active) return;
  const defs = window.Entities.unitDefs || {};
  const biomeDefs = window.Entities.biomeDefs || {};
  const currentTeam = this.draft.sequence[this.draft.currentIndex];
  const localTeam = this.isMultiplayer ? this.playerTeam : Config.TEAM.PLAYER;
  const canPick = this.draft.mode === "ai" ? currentTeam === Config.TEAM.PLAYER : currentTeam === localTeam;
  const picked = new Set([...this.draftedUnits[Config.TEAM.PLAYER], ...this.draftedUnits[Config.TEAM.AI]]);
  const items = this.getDraftableItems(this.draft.mode).filter(type => !picked.has(type));
  const sortMode = this.draftFilters.sort === "class" ? "class" : "cost";
  const classOrder = ["Fighter", "Marksman", "Artillery", "Assassin", "Breaker", "Disruptor", "Support", "Tank", "Control", "Biomes", "Other"];
  const getItemClass = (type) => biomeDefs[type] ? "Biomes" : this.getUnitClass(type);
  const getItemCost = (type) => biomeDefs[type] ? biomeDefs[type].cost : (defs[type].cost || 0);
  const groupValues = sortMode === "class"
    ? classOrder.filter(cls => items.some(t => getItemClass(t) === cls))
    : Array.from(new Set(items.map(t => String(getItemCost(t))))).map(Number).sort((a, b) => a - b).map(String);
  const selectedFilter = this.draftFilters.filterValue || "all";
  const orderPreview = this.draft.sequence.map((team, index) => {
    const done = index < this.draft.currentIndex ? " done" : "";
    const current = index === this.draft.currentIndex ? " current" : "";
    return `<span class="draft-order-dot ${this.getDraftDotClass(team)}${done}${current}" title="${this.getDraftTeamLabel(team)}"></span>`;
  }).join("");

  overlay.classList.remove("hidden");
  overlay.innerHTML = `
    <div class="draft-panel draft-panel-live">
      <div class="draft-hero">
        <div>
          <div class="draft-kicker">${this.draft.mode === "ai" ? "AI Match Draft" : "PvP Draft"}</div>
          <div class="draft-title">${this.getDraftTeamLabel(currentTeam)} Pick</div>
        </div>
        <div class="draft-progress">${this.draft.currentIndex + 1}/${this.draft.sequence.length}</div>
      </div>
      <div class="draft-order">${orderPreview}</div>
      <div class="draft-layout">
        <div class="draft-board-card">
          <div class="draft-card-title">Map Preview</div>
          <div class="draft-map-preview">${this.renderDraftMapPreviewHTML()}</div>
          <div class="draft-rosters">
            <div>
              <div class="draft-roster-head">
                <div class="draft-card-title">${this.getDraftTeamLabel(Config.TEAM.PLAYER)}</div>
                <div class="draft-roster-meta">${this.getDraftAverageCostLabel(Config.TEAM.PLAYER)}</div>
              </div>
              ${this.renderDraftPicksHTML(Config.TEAM.PLAYER)}
            </div>
            <div>
              <div class="draft-roster-head">
                <div class="draft-card-title">${this.getDraftTeamLabel(Config.TEAM.AI)}</div>
                <div class="draft-roster-meta">${this.getDraftAverageCostLabel(Config.TEAM.AI)}</div>
              </div>
              ${this.renderDraftPicksHTML(Config.TEAM.AI)}
            </div>
          </div>
        </div>
        <div class="draft-unit-list ${canPick ? "" : "waiting"}">
          <div class="shop-toolbar draft-toolbar">
            <select class="shop-filter-select draft-filter-select" id="draft-filter-select">
              ${[`<option value="all">${sortMode === "class" ? "All Classes" : "All Costs"}</option>`]
                .concat(groupValues.map(opt => `<option value="${opt}">${opt}</option>`)).join("")}
            </select>
            <select class="shop-filter-select draft-filter-select" id="draft-sort-select">
              <option value="cost">Sort by Cost</option>
              <option value="class">Sort by Class</option>
            </select>
          </div>
          <div class="draft-group-wrap">
            ${groupValues.map(groupValue => {
              if (selectedFilter !== "all" && selectedFilter !== groupValue) return "";
              const grouped = items.filter(t => (sortMode === "class" ? getItemClass(t) : String(getItemCost(t))) === groupValue);
              if (!grouped.length) return "";
              return `
                <div class="buy-group draft-buy-group">
                  <button type="button" class="group-header btn">${sortMode === "class" ? groupValue : `Cost \uD83E\uDE99 ${groupValue}`}</button>
                  <div class="group-list draft-group-list" style="display:${selectedFilter !== "all" ? "grid" : "none"}">
                    ${grouped.map(type => {
                      const def = defs[type] || biomeDefs[type];
                      const isBiome = !!biomeDefs[type];
                      return `
                        <button class="draft-unit-card" data-unit="${type}" ${canPick ? "" : "disabled"}>
                          <span class="draft-unit-symbol ${this.getUnitVisualClass(type)}">${def.symbol}</span>
                          <span class="draft-unit-main">
                            <b>${type}</b>
                            <small>${isBiome ? "Biome - " + (def.shopLabel || "Board Effect") : this.getUnitClass(type) + " - " + this.getShopRoleSummary(type)}</small>
                          </span>
                          <span class="draft-unit-cost">\uD83E\uDE99 ${def.cost || 0}</span>
                        </button>
                      `;
                    }).join("")}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
          ${this.aiDraftLoaners && this.aiDraftLoaners.length && this.draft.mode === "ai" ? `<div class="draft-shop-lock"><b>Training Loaners</b><span>${this.aiDraftLoaners.length} temporary cards are available for this AI match because your collection has fewer than ${this.standardDraftCardsNeeded} draftable cards.</span></div>` : ""}
        </div>
      </div>
    </div>
  `;
  const filterSelect = overlay.querySelector("#draft-filter-select");
  const sortSelect = overlay.querySelector("#draft-sort-select");
  if (filterSelect) filterSelect.value = selectedFilter;
  if (sortSelect) sortSelect.value = sortMode;
  if (filterSelect) filterSelect.onchange = () => {
    this.draftFilters.filterValue = filterSelect.value || "all";
    this.renderDraftOverlay();
  };
  if (sortSelect) sortSelect.onchange = () => {
    this.draftFilters.sort = sortSelect.value || "cost";
    this.draftFilters.filterValue = "all";
    this.renderDraftOverlay();
  };
  overlay.querySelectorAll(".draft-buy-group .group-header").forEach((btn) => {
    btn.onclick = () => {
      const list = btn.nextElementSibling;
      if (list) list.style.display = list.style.display === "none" ? "grid" : "none";
    };
  });
  overlay.querySelectorAll(".draft-unit-card").forEach(btn => {
    btn.onclick = () => this.makeDraftPick(btn.dataset.unit);
  });
};

Game.prototype.makeDraftPick = function(type, options) {
  const opts = options || {};
  if (!this.draft.active || !type) return false;
  const team = opts.team || this.draft.sequence[this.draft.currentIndex];
  if (team !== this.draft.sequence[this.draft.currentIndex]) return false;
  const allowedItems = opts.remote ? this.getAllDraftableItems() : this.getDraftableItems(this.draft.mode);
  if (!allowedItems.includes(type)) return false;
  if (this.draftedUnits[Config.TEAM.PLAYER].has(type) || this.draftedUnits[Config.TEAM.AI].has(type)) return false;

  this.draftedUnits[team].add(type);
  this.draft.currentIndex += 1;
  this.logEvent({ type: "status", msg: `${this.getDraftTeamLabel(team)} drafted ${type}` });
  if (this.draft.mode === "ai") {
    if (team === Config.TEAM.AI) {
      const rationale = this.getAIDraftPickRationale(type);
      this.pushAIDraftNote("pick", rationale);
    } else {
      const rationale = this.getAIReactionRationaleForPlayerPick(type);
      this.pushAIDraftNote("counter", rationale);
    }
  }

  if (this.isMultiplayer && !opts.remote && window.Multiplayer) {
    window.Multiplayer.sendPacket("DRAFT_PICK", { team, type });
  }

  if (this.draft.currentIndex >= this.draft.sequence.length) {
    this.completeDraft();
  } else {
    this.renderDraftOverlay();
    this.maybeRunAIDraftPick();
  }
  return true;
};

Game.prototype.applyRemoteDraftPick = function(payload) {
  if (!payload) return;
  this.makeDraftPick(payload.type, { team: payload.team, remote: true });
};

Game.prototype.maybeRunAIDraftPick = function() {
  if (!this.draft.active || this.draft.mode !== "ai") return;
  const currentTeam = this.draft.sequence[this.draft.currentIndex];
  if (currentTeam !== Config.TEAM.AI) return;
  window.setTimeout(() => {
    if (!this.draft.active || this.draft.sequence[this.draft.currentIndex] !== Config.TEAM.AI) return;
    const pick = this.chooseAIDraftPick();
    if (pick && pick.type) this.makeDraftPick(pick.type, { team: Config.TEAM.AI });
  }, 320);
};

Game.prototype.chooseAIDraftPick = function() {
  // Use the centralized scorer with strict early curve guardrails.
  const scored = this.getAIDraftScoredCandidates();
  if (!scored || !scored.length) return null;

  const defs = window.Entities.unitDefs || {};
  const ownPicks = Array.from(this.draftedUnits[Config.TEAM.AI] || []).filter(t => defs[t]);
  const ownCosts = ownPicks.map(t => Number(defs[t].cost || 0));
  const lowCostCount = ownCosts.filter(c => c <= 2).length;
  const earlyCount = ownCosts.filter(c => c <= 3).length;

  if (ownPicks.length < 3 && lowCostCount < 1) {
    const cheap = scored.filter(s => (s.cost || 0) <= 2);
    if (cheap.length) return cheap[0];
  }
  if (ownPicks.length < 5 && earlyCount < 2) {
    const curve = scored.filter(s => (s.cost || 0) <= 3);
    if (curve.length) return curve[0];
  }

  const top = scored[0].score;
  const close = scored.filter(s => s.score >= (top - 1.75)).slice(0, 4);
  if (close.length <= 1) return close[0] || scored[0];
  const pick = close[Math.floor(Math.random() * close.length)];
  return pick || close[0];
};

Game.prototype.completeDraft = function() {
  this.draft.active = false;
  this.draft.completed = true;
  const overlay = document.getElementById("draft-overlay");
  if (overlay) overlay.classList.add("hidden");
  this.logEvent({ type: "status", msg: "Draft complete. Unit shop is now locked to drafted rosters." });
  this.renderBuyControls();
  this.updateHUD();
};

Game.prototype.getAbilityDefForUnit = function(unit) {
  return unit && window.Abilities && window.Abilities[unit.type] ? window.Abilities[unit.type][0] : null;
};

Game.prototype.scoreAIRune = function(unit, rune) {
  if (!unit || !rune) return -Infinity;
  if (unit.runes.some(r => r.id === rune.id)) return -Infinity;
  let score = 0;
  if (rune.id === "rune_vitality") score += unit.maxHp <= 6 ? 8 : 5;
  if (rune.id === "rune_power") score += unit.dmg >= 3 ? 8 : 5;
  if (rune.id === "rune_swiftness") score += unit.move <= 2 ? 8 : 4;
  if (rune.id === "rune_scope") score += unit.range >= 2 ? 8 : 4;
  if (rune.id === "rune_frenzy") score += unit.apMax <= 2 ? 9 : 5;
  if (rune.id === "rune_rampage") score += unit.maxHp <= 8 ? 7 : 4;
  if (rune.id === "rune_deft") score += (unit.range >= 2 && unit.dmg <= 3) ? 9 : 4;
  if (rune.id === "rune_chrono") score += (window.Abilities && window.Abilities[unit.type] && window.Abilities[unit.type].length) ? 9 : 2;
  if (rune.id === "rune_mending") score += unit.maxHp >= 6 ? 8 : 5;
  if (unit.type === "Cleric" || unit.type === "Mage" || unit.type === "Hex") {
    if (rune.id === "rune_scope") score += 4;
  }
  if (unit.type === "Warrior" || unit.type === "Berserker" || unit.type === "Rogue") {
    if (rune.id === "rune_swiftness" || rune.id === "rune_power") score += 4;
  }
  if (unit.type === "Druid" && rune.id === "rune_vitality") score += 5;
  if (unit.type === "Sentinel" && rune.id === "rune_rampage") score += 4;
  if (unit.type === "Sentinel" && rune.id === "rune_deft") score += 2;
  if (unit.type === "Ballista" && rune.id === "rune_scope") score += 6;
  if (unit.type === "Ballista" && rune.id === "rune_power") score += 4;
  if (unit.type === "Paladin" && rune.id === "rune_vitality") score += 4;
  if ((unit.type === "Sentinel" || unit.type === "Bulwark" || unit.type === "Geomancer") && rune.id === "rune_mending") score += 4;
  return score - (rune.cost * 0.35);
};

Game.prototype.chooseBestAIRunePurchase = function() {
  const candidates = this.entities.filter(e =>
    e.kind === "unit" &&
    e.team === Config.TEAM.AI &&
    e.runes.length < 3
  );
  let best = null;
  for (const unit of candidates) {
    for (const rune of window.RuneDefs || []) {
      if (unit.runes.some(r => r.id === rune.id)) continue;
      if (this.energy[Config.TEAM.AI] < rune.cost) continue;
      const score = this.scoreAIRune(unit, rune);
      if (!best || score > best.score) best = { unit, rune, score };
    }
  }
  return best && best.score > 0 ? best : null;
};

Game.prototype.getBuyPositions = function(team, type) {
  const base = this.entities.find(e => e.kind === "base" && e.team === team);
  if (!base) return [];
  const res = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = base.row + dr, c = base.col + dc;
      if (!this.inBounds(r, c)) continue;
      
      const t = this.terrain[r][c];
      // Only block placement on blocking terrain
      if (this.isTerrainBlockingForUnit(t, type ? { type } : null)) continue;
      
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
  const biomeDefs = window.Entities.biomeDefs;
  const myTeam = this.isMultiplayer ? this.playerTeam : Config.TEAM.PLAYER;
  if (!this.draft.completed) {
    wrap.innerHTML = `
      <div class="draft-shop-lock">
        <b>Draft Required</b>
        <span>Choose 8 total units and biomes before buying from the shop.</span>
      </div>
    `;
    return;
  }
  const allUnits = Object.keys(defs).filter(t => !defs[t].hiddenFromShop && this.isUnitDrafted(myTeam, t));
  const allBiomes = Object.keys(biomeDefs).filter(t => this.isBiomeDrafted(myTeam, t));
  const sortMode = this.shopFilters.sort === "class" ? "class" : "cost";
  const classOrder = ["Fighter", "Marksman", "Artillery", "Assassin", "Breaker", "Disruptor", "Support", "Tank", "Control", "Biomes", "Other"];
  
  const getUnitClass = (type) => {
    if (biomeDefs[type]) return "Biomes";
    return this.getUnitClass(type);
  };

  const getCost = (type) => {
    if (biomeDefs[type]) return biomeDefs[type].cost;
    return defs[type].cost || 0;
  };

  const shopItems = [...allUnits, ...allBiomes];
  const groupValues = sortMode === "class"
    ? classOrder.filter(cls => shopItems.some(t => getUnitClass(t) === cls))
    : Array.from(new Set(shopItems.map(t => String(getCost(t))))).map(Number).sort((a, b) => a - b).map(String);
  
  const selectedFilter = this.shopFilters.filterValue || "all";
  const frag = document.createDocumentFragment();

  const toolbar = document.createElement("div");
  toolbar.className = "shop-toolbar";
  const filterSelect = document.createElement("select");
  filterSelect.className = "shop-filter-select";
  filterSelect.innerHTML = [`<option value="all">${sortMode === "class" ? "All Classes" : "All Costs"}</option>`]
    .concat(groupValues.map(opt => `<option value="${opt}">${opt}</option>`))
    .join("");
  filterSelect.value = selectedFilter;
  
  const sortSelect = document.createElement("select");
  sortSelect.className = "shop-filter-select";
  sortSelect.innerHTML = `
    <option value="cost">Sort by Cost</option>
    <option value="class">Sort by Class</option>
  `;
  sortSelect.value = sortMode;
  
  filterSelect.addEventListener("change", () => {
    this.shopFilters.filterValue = filterSelect.value || "all";
    this.renderBuyControls();
  });
  sortSelect.addEventListener("change", () => {
    this.shopFilters.sort = sortSelect.value;
    this.shopFilters.filterValue = "all";
    this.renderBuyControls();
  });
  toolbar.appendChild(filterSelect);
  toolbar.appendChild(sortSelect);
  frag.appendChild(toolbar);

  groupValues.forEach(groupValue => {
    if (selectedFilter !== "all" && selectedFilter !== groupValue) return;

    const group = document.createElement("div");
    group.className = "buy-group";
    const header = document.createElement("button");
    header.type = "button";
    header.className = "group-header btn";
    header.textContent = sortMode === "class" ? groupValue : `Cost \uD83E\uDE99 ${groupValue}`;
    const list = document.createElement("div");
    list.className = "group-list";
    list.style.display = (selectedFilter !== "all") ? "block" : "none";
    header.addEventListener("click", () => {
      list.style.display = list.style.display === "none" ? "block" : "none";
    });
    
    const remainingUnits = allUnits.filter(t => !this.purchasedUnits[myTeam].has(t));
    const items = [...remainingUnits, ...allBiomes];
    const grouped = items.filter(t => (sortMode === "class" ? getUnitClass(t) : String(getCost(t))) === groupValue);

    grouped.forEach(type => {
      const isBiome = !!biomeDefs[type];
      const def = isBiome ? biomeDefs[type] : defs[type];
      const btn = document.createElement("button");
      btn.className = "unit-item";
      
      const energy = this.energy[myTeam];
      const canAfford = energy >= (def.cost || 0);
      if (!canAfford) btn.classList.add("low-energy");

      const shopDesc = isBiome ? (def.shopLabel || def.shortDesc || type) : this.getShopRoleSummary(type);
      btn.innerHTML = `<div class="unit-title">${def.symbol} ${type}</div><div class="unit-desc-small">${shopDesc}</div>`;
      
      btn.addEventListener("click", () => {
        if (isBiome) {
          // Allow selection even if low energy to see details
          this.buySelection = null; 
          this.biomeSelection = type;
          this.logEvent({ type: "info", msg: `Selected ${type}. ${canAfford ? "Click anywhere to place it!" : "Not enough gold to place."}` });
          
          // Update unit panel for Biome
          this.updateUnitPanel({
            kind: "biome_preview",
            type: type,
            symbol: def.symbol,
            desc: def.desc,
            cost: def.cost,
            duration: def.duration,
            color: def.color
          });

          this.board.clearMarks();
          if (canAfford) {
            // Allow placement anywhere (for biomes)
            const pos = [];
            for (let r = 0; r < Config.ROWS; r++) {
              for (let c = 0; c < Config.COLS; c++) {
                if (this.terrain[r][c] !== "nexus") pos.push([r, c]);
              }
            }
            this.board.markPositions(pos, "buy-hl");
          }
        } else {
          // Units: Allow selection to see details
          this.biomeSelection = null; 
          this.buySelection = { type: type, cost: def.cost };
          
          this.board.clearMarks();
          // Always show valid placement positions for preview (even if low on energy)
          const pos = this.getBuyPositions(myTeam, type);
          this.board.markPositions(pos, "buy-hl");
          
          // Update unit panel for Unit preview
          const preview = {
            kind: "unit",
            team: myTeam,
            type: type,
            row: 0, col: 0,
            hp: def.hp, maxHp: def.hp, dmg: def.dmg, range: def.range, move: def.move,
            symbol: def.symbol, ability: def.ability, rangePattern: def.rangePattern, movePattern: def.movePattern || "orthogonal",
            thrower: !!def.thrower,
            abilityCooldowns: {}, runes: [], apMax: def.apMax || 2, ap: def.apMax || 2,
            cost: def.cost
          };
          this.updateUnitPanel(preview);
        }
        
        document.querySelectorAll(".unit-item.selected").forEach(el => el.classList.remove("selected"));
        btn.classList.add("selected");
        const cancelBtn = document.getElementById("buy-cancel");
        if (cancelBtn) cancelBtn.style.display = "inline-block";
      });
      list.appendChild(btn);
    });

    if (grouped.length > 0) {
      group.appendChild(header);
      group.appendChild(list);
      frag.appendChild(group);
    }
  });

  wrap.innerHTML = "";
  wrap.appendChild(frag);

  const cancelBtn = document.getElementById("buy-cancel");
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      this.buySelection = null;
      this.biomeSelection = null;
      this.board.clearMarks();
      cancelBtn.style.display = "none";
      document.querySelectorAll(".unit-item.selected").forEach(el => el.classList.remove("selected"));
      this.updateUnitPanel(null);
    };
  }
};

Game.prototype.chooseAIPurchaseType = function() {
  const defs = window.Entities.unitDefs;
  const affordable = Object.keys(defs).filter(t => {
    if (t === "Skeleton") return false;
    if (defs[t].hiddenFromShop) return false;
    if (!this.isUnitDrafted(Config.TEAM.AI, t)) return false;
    return this.energy[Config.TEAM.AI] >= (defs[t].cost || 0);
  });
  if (affordable.length === 0) return null;
  const aiUnits = this.entities.filter(e => e.kind === "unit" && e.team === Config.TEAM.AI);
  const playerUnits = this.entities.filter(e => e.kind === "unit" && e.team === Config.TEAM.PLAYER);
  const uniqueAffordable = affordable.filter(t => !this.purchasedUnits[Config.TEAM.AI].has(t));
  if (aiUnits.length === 0) {
    const cheapDrafted = this.getDraftedAffordableTypeForAI(2);
    if (cheapDrafted && this.energy[Config.TEAM.AI] >= (defs[cheapDrafted].cost || 0)) return cheapDrafted;
  }
  const needHealer = aiUnits.some(u => u.hp < u.maxHp);
  if (needHealer && uniqueAffordable.includes("Mage")) return "Mage";
  const preferRanged = playerUnits.length === 0 || playerUnits.some(u => u.type === "Warrior");
  const weights = { Warrior: 1, Archer: 2, Mage: 1, Paladin: 2, Berserker: 2, Builder: 2, Alchemist: 2, Rogue: 2, Cleric: 1, Firecaller: 2, Magnet: 1, Avenger: 1, Necromancer: 1, Hex: 1, Sludge: 1, Druid: 1, Sentinel: 2, Ballista: 2, Bulwark: 2, Stalker: 2, Slicer: 2, "Bounty Hunter": 2, Silencer: 2, Geomancer: 1, Plague: 2 };
  if (preferRanged) { weights.Archer += 1; weights.Paladin += 1; }
  if (playerUnits.some(u => ["Archer", "Ballista", "Tidewalker"].includes(u.type))) weights.Stalker += 1;
  if (playerUnits.some(u => this.getUnitClass(u.type) === "Tank")) weights.Slicer += 2;
  if (playerUnits.some(u => (u.ap || 0) > 0)) weights.Silencer += 1;
  if (playerUnits.length >= 3) weights.Plague += 1;
  if (aiUnits.some(u => u.type === "Geomancer")) weights.Geomancer = 0;
  if (aiUnits.length < 2 && uniqueAffordable.includes("Bulwark")) weights.Bulwark += 1;
  const list = uniqueAffordable.flatMap(t => Array(Math.max(1, weights[t] || 1)).fill(t));
  if (list.length) return list[Math.floor(Math.random() * list.length)];
  return affordable[0] || null;
};

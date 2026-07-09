window.Progression = (() => {
  const LEGACY_STORAGE_KEY = "NexusThree.progression.v1";
  const PROFILE_KEY = "NexusThree.playerProfileId.v1";
  const RESET_MARKER_KEY = "NexusThree.progressionReset.v1";
  const RESET_MARKER = "starter-defaults-manual-reset-2026-07-09";
  const STORAGE_PREFIX = "NexusThree.progression.";
  const STARTER_CARDS = ["Warrior", "Archer", "Mage", "Builder", "Cleric"];
  const PACK_COST = 60;
  const PACK_SIZE = 3;
  const WIN_REWARD = 30;
  const STARTING_COINS = PACK_COST;
  const RARITY_WEIGHTS = {
    common: 60,
    rare: 25,
    epic: 10,
    legendary: 5,
  };
  const CARD_RARITIES = {
    Warrior: "common",
    Archer: "common",
    Mage: "common",
    Builder: "common",
    Cleric: "common",
    Rogue: "rare",
    Paladin: "rare",
    Berserker: "rare",
    Alchemist: "rare",
    Firecaller: "rare",
    Magnet: "rare",
    Hex: "rare",
    Sludge: "rare",
    Sentinel: "rare",
    Ballista: "rare",
    Bulwark: "rare",
    Druid: "epic",
    Avenger: "epic",
    Necromancer: "epic",
    Tidewalker: "epic",
    Shade: "epic",
    Stalker: "epic",
    Slicer: "epic",
    Silencer: "epic",
    Geomancer: "epic",
    Plague: "legendary",
    "Bounty Hunter": "legendary",
    Forge: "rare",
    Watchtower: "rare",
    Sanctum: "rare",
    "Boxing Arena": "epic",
  };

  const safeParse = (raw) => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const getUnitDefs = () => (window.Entities && window.Entities.unitDefs) || {};
  const getBiomeDefs = () => (window.Entities && window.Entities.biomeDefs) || {};

  const normalizeUnitRecord = (entry) => {
    if (!entry || typeof entry !== "object") return null;
    return {
      owned: !!entry.owned,
      duplicates: Math.max(0, Number(entry.duplicates || 0)),
    };
  };

  const createDefaultState = () => ({
    coins: STARTING_COINS,
    cards: {},
    packResults: [],
    starterGrantClaimed: true,
  });

  const ensureStarters = (state) => {
    state.cards = state.cards || {};
    if (!state.starterGrantClaimed) {
      state.coins = Math.max(Number(state.coins || 0), STARTING_COINS);
      state.starterGrantClaimed = true;
    }
    for (const type of STARTER_CARDS) {
      if (!state.cards[type]) {
        state.cards[type] = { owned: true, duplicates: 0 };
      } else {
        state.cards[type] = {
          owned: true,
          duplicates: Math.max(0, Number(state.cards[type].duplicates || 0)),
        };
      }
    }
    return state;
  };

  const normalizeState = (raw) => {
    const state = createDefaultState();
    if (raw && typeof raw === "object") {
      state.coins = Math.max(0, Number(raw.coins || 0));
      state.cards = {};
      const rawCards = (raw.cards && typeof raw.cards === "object") ? raw.cards : raw.units;
      if (rawCards && typeof rawCards === "object") {
        for (const [type, entry] of Object.entries(rawCards)) {
          const normalized = normalizeUnitRecord(entry);
          if (normalized) state.cards[type] = normalized;
        }
      }
      state.packResults = Array.isArray(raw.packResults) ? raw.packResults.slice(0, 12) : [];
      state.starterGrantClaimed = !!raw.starterGrantClaimed;
    }
    return ensureStarters(state);
  };

  const getPlayerId = () => {
    let id = "";
    try {
      id = window.localStorage && window.localStorage.getItem(PROFILE_KEY);
      if (!id) {
        const random = window.crypto && window.crypto.getRandomValues
          ? Array.from(window.crypto.getRandomValues(new Uint32Array(2))).map(n => n.toString(36)).join("")
          : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
        id = `player-${random}`;
        window.localStorage.setItem(PROFILE_KEY, id);
      }
    } catch {
      id = "local-player";
    }
    return id;
  };

  const getStorageKey = () => `${STORAGE_PREFIX}${getPlayerId()}.v2`;

  const load = () => {
    let raw = null;
    try {
      const resetApplied = window.localStorage && window.localStorage.getItem(RESET_MARKER_KEY) === RESET_MARKER;
      if (!resetApplied && window.localStorage) {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        window.localStorage.removeItem(getStorageKey());
        window.localStorage.setItem(RESET_MARKER_KEY, RESET_MARKER);
        return normalizeState(null);
      }
      raw = safeParse(window.localStorage && window.localStorage.getItem(getStorageKey()));
    } catch {
      raw = null;
    }
    return normalizeState(raw);
  };

  const save = (state) => {
    if (!state || !window.localStorage) return state;
    const payload = normalizeState(clone(state));
    try {
      window.localStorage.setItem(getStorageKey(), JSON.stringify(payload));
    } catch {
      return payload;
    }
    return payload;
  };

  const getOwnedCards = (state) => {
    const cards = state && state.cards ? state.cards : {};
    return Object.keys(cards).filter((type) => cards[type] && cards[type].owned);
  };

  const isOwned = (state, type) => {
    const entry = state && state.cards && state.cards[type];
    return !!(entry && entry.owned);
  };

  const unlockCard = (state, type) => {
    state.cards = state.cards || {};
    if (!state.cards[type]) {
      state.cards[type] = { owned: true, duplicates: 0 };
      return { unlocked: true, duplicate: false };
    }
    const entry = state.cards[type];
    if (!entry.owned) {
      entry.owned = true;
      entry.duplicates = Math.max(0, Number(entry.duplicates || 0));
      return { unlocked: true, duplicate: false };
    }
    entry.duplicates = Math.max(0, Number(entry.duplicates || 0)) + 1;
    return { unlocked: false, duplicate: true };
  };

  const getCardKind = (type) => {
    if (getBiomeDefs()[type]) return "biome";
    if (getUnitDefs()[type]) return "unit";
    return "card";
  };

  const getCardRarity = (type) => CARD_RARITIES[type] || "common";

  const getAllCards = () => {
    const unitDefs = getUnitDefs();
    const biomeDefs = getBiomeDefs();
    const units = Object.keys(unitDefs).filter((type) => {
      const def = unitDefs[type];
      return type !== "Skeleton" && !def.hiddenFromShop;
    });
    return [...units, ...Object.keys(biomeDefs)];
  };

  const getPackPool = () => {
    return getAllCards();
  };

  const weightedPick = (pool) => {
    const weighted = pool.map((type) => ({
      type,
      weight: RARITY_WEIGHTS[getCardRarity(type)] || RARITY_WEIGHTS.common,
    }));
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    for (const item of weighted) {
      roll -= item.weight;
      if (roll <= 0) return item.type;
    }
    return weighted[weighted.length - 1] && weighted[weighted.length - 1].type;
  };

  const openPack = (state) => {
    if (!state) return { success: false, reason: "Missing state" };
    if (state.coins < PACK_COST) {
      return { success: false, reason: "Not enough coins" };
    }
    const pool = getPackPool();
    if (!pool.length) {
      return { success: false, reason: "No cards available" };
    }

    state.coins -= PACK_COST;
    const rewards = [];
    const available = pool.slice();
    for (let i = 0; i < PACK_SIZE; i++) {
      if (!available.length) break;
      const pick = weightedPick(available);
      const pickIndex = available.indexOf(pick);
      if (pickIndex >= 0) available.splice(pickIndex, 1);
      const result = unlockCard(state, pick);
      rewards.push({
        type: pick,
        kind: getCardKind(pick),
        rarity: getCardRarity(pick),
        duplicate: !!result.duplicate,
      });
    }
    state.packResults = rewards;
    save(state);
    return { success: true, rewards };
  };

  const grantWinCoins = (state) => {
    if (!state) return 0;
    state.coins = Math.max(0, Number(state.coins || 0)) + WIN_REWARD;
    save(state);
    return WIN_REWARD;
  };

  return {
    legacyStorageKey: LEGACY_STORAGE_KEY,
    getStorageKey,
    getPlayerId,
    starterCards: STARTER_CARDS.slice(),
    packCost: PACK_COST,
    packSize: PACK_SIZE,
    winReward: WIN_REWARD,
    startingCoins: STARTING_COINS,
    rarityWeights: { ...RARITY_WEIGHTS },
    load,
    save,
    normalizeState,
    getOwnedCards,
    isOwned,
    unlockCard,
    getAllCards,
    getCardKind,
    getCardRarity,
    openPack,
    grantWinCoins,
  };
})();

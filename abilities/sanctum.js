(function() {
  window.Entities = window.Entities || {};
  window.Entities.biomeDefs = window.Entities.biomeDefs || {};
  window.Entities.biomeDefs.Sanctum = {
    radius: 2,
    duration: 5,
    cost: 6,
    symbol: "⛪",
    color: "#fbbf24",
    desc: "A holy sanctuary for healers. Support units in range gain +1 Max AP and get immediate +1 AP contact plus turn-start heal/AP.",
    shopLabel: "Support AP",
    effectType: "turn_start_support_buff",
    amount: 1,
    filter: "Support"
  };
})();

(function() {
  window.Entities = window.Entities || {};
  window.Entities.biomeDefs = window.Entities.biomeDefs || {};
  window.Entities.biomeDefs.Watchtower = {
    radius: 2,
    duration: 5,
    cost: 6,
    symbol: "🗼",
    color: "#60a5fa",
    desc: "A high vantage point for sharpshooters. Increases attack range by 1 for all Marksman units within the area.",
    shopLabel: "Range Boost",
    effectType: "stat_buff",
    stat: "range",
    amount: 1,
    filter: "Marksman"
  };
})();

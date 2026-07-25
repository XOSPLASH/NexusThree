(function() {
  window.Entities = window.Entities || {};
  window.Entities.biomeDefs = window.Entities.biomeDefs || {};
  window.Entities.biomeDefs["Boxing Arena"] = {
    radius: 2,
    duration: 4,
    cost: 4,
    symbol: "🥊",
    color: "#f87171",
    desc: "A gritty combat zone where fighters excel.",
    shopLabel: "Fighter DMG",
    effectType: "stat_buff",
    stat: "dmg",
    amount: 10,
    filter: "Fighter"
  };
})();

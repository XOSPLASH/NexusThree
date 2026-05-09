(function() {
  window.Entities = window.Entities || {};
  window.Entities.biomeDefs = window.Entities.biomeDefs || {};
  window.Entities.biomeDefs["Boxing Arena"] = {
    radius: 2,
    duration: 4,
    cost: 4,
    symbol: "🥊",
    color: "#f87171",
    desc: "A gritty combat zone where fighters excel. Increases damage by 1 for all Fighter units within the area.",
    shopLabel: "Fighter DMG",
    effectType: "stat_buff",
    stat: "dmg",
    amount: 1,
    filter: "Fighter"
  };
})();

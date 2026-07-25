(function() {
  window.Entities = window.Entities || {};
  window.Entities.biomeDefs = window.Entities.biomeDefs || {};
  window.Entities.biomeDefs.Forge = {
    radius: 1,
    duration: 5,
    cost: 4,
    symbol: "\u2692\uFE0F",
    color: "#94a3b8",
    desc: "A heavy industrial zone that reinforces armor.",
    shopLabel: "Tank Guard",
    effectType: "turn_start_guard",
    amount: 10,
    guardValue: 10,
    filter: "Tank"
  };
})();

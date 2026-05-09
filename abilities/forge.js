(function() {
  window.Entities = window.Entities || {};
  window.Entities.biomeDefs = window.Entities.biomeDefs || {};
  window.Entities.biomeDefs.Forge = {
    radius: 1,
    duration: 5,
    cost: 5,
    symbol: "⚒️",
    color: "#94a3b8",
    desc: "A heavy industrial zone that reinforces armor. Grants 1 turn of Guard to Tank units within the area at the start of every turn.",
    shopLabel: "Tank Guard",
    effectType: "turn_start_guard",
    amount: 1,
    guardValue: 1,
    filter: "Tank"
  };
})();

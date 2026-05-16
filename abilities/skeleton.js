// Skeleton stats
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Skeleton = {
    hp: 10, range: 1, dmg: 10, move: 1,
    symbol: "\uD83D\uDC80", ability: "Summoned minion",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    hiddenFromShop: true,
    leveling: {
      xpToLevel: { 2: 4, 3: 8 },
      levels: {
        2: [
          { label: "+10 Damage", stat: "dmg", amount: 10 },
        ],
        3: [
          { label: "+10 Max HP", stat: "maxHp", amount: 10, heal: 10 },
        ],
      },
    },
  };
})(); 



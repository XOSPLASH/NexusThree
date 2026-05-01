// Skeleton stats
(function() {
  window.Entities = window.Entities || {};
  window.Entities.unitDefs = window.Entities.unitDefs || {};
  window.Entities.unitDefs.Skeleton = {
    hp: 1, range: 1, dmg: 1, move: 1,
    symbol: "💀", ability: "Summoned minion",
    rangePattern: "orthogonal", movePattern: "orthogonal",
    hiddenFromShop: true,
    leveling: {
      xpToLevel: { 2: 4, 3: 8 },
      levels: {
        2: [
          { label: "+1 Damage", stat: "dmg", amount: 1 },
        ],
        3: [
          { label: "+1 Max HP", stat: "maxHp", amount: 1, heal: 1 },
        ],
      },
    },
  };
})(); 

(function() {
  window.RuneDefs = [
    { id: "rune_hp", name: "Vitality Rune", desc: "+2 HP", cost: 2, apply: (u) => { u.maxHp += 2; u.hp += 2; } },
    { id: "rune_dmg", name: "Power Rune", desc: "+1 Damage", cost: 3, apply: (u) => { u.dmg += 1; } },
    { id: "rune_move", name: "Swiftness Rune", desc: "+1 Move", cost: 3, apply: (u) => { u.move += 1; } },
    { id: "rune_range", name: "Scope Rune", desc: "+1 Range", cost: 4, apply: (u) => { u.range += 1; } },
    { id: "rune_ap", name: "Frenzy Rune", desc: "+1 Max AP", cost: 5, apply: (u) => { u.apMax += 1; } }
  ];
})(); 

(function() {
  window.RuneDefs = [
    { id: "rune_hp", name: "Vitality Rune", desc: "+2 HP", cost: 2, apply: (u) => { u.maxHp += 2; u.hp += 2; } },
    { id: "rune_dmg", name: "Power Rune", desc: "+1 Damage", cost: 3, apply: (u) => { u.dmg += 1; } },
    { id: "rune_move", name: "Swiftness Rune", desc: "+1 Move", cost: 3, apply: (u) => { u.move += 1; } },
    { id: "rune_range", name: "Scope Rune", desc: "+1 Range", cost: 4, apply: (u) => { u.range += 1; } },
    { id: "rune_ap", name: "Frenzy Rune", desc: "+1 Max AP", cost: 5, apply: (u) => { u.apMax += 1; } },
    { id: "rune_rampart", name: "Rampart Rune", desc: "+2 Max HP, +1 Move", cost: 4, apply: (u) => { u.maxHp += 2; u.hp += 2; u.move += 1; } },
    { id: "rune_deft", name: "Deft Rune", desc: "+1 Range, +1 Damage", cost: 4, apply: (u) => { u.range += 1; u.dmg += 1; } },
    { id: "rune_focus", name: "Focus Rune", desc: "+1 AP, -1 cooldown to this unit's abilities", cost: 5, apply: (u) => {
      u.apMax += 1;
      u.ap += 1;
      u.globalCooldownMod = (u.globalCooldownMod || 0) - 1;
      if (u.abilityCooldowns) {
        for (const k of Object.keys(u.abilityCooldowns)) {
          u.abilityCooldowns[k] = Math.max(0, u.abilityCooldowns[k] - 1);
        }
      }
    } }
  ];
})(); 

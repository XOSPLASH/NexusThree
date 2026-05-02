(function() {
  window.RuneDefs = [
    { id: "rune_vitality", name: "Vitality I", desc: "+2 Max HP", cost: 2, apply: (u) => { u.maxHp += 1; u.hp += 1; } }, 
    { id: "rune_power", name: "Power I", desc: "+2 Damage", cost: 2, apply: (u) => { u.dmg += 2; } },
    { id: "rune_swiftness", name: "Swiftness I", desc: "+1 Move", cost: 3, apply: (u) => { u.move += 1; } },
    { id: "rune_scope", name: "Scope I", desc: "+1 Range", cost: 3, apply: (u) => { u.range += 1; } },
    { id: "rune_frenzy", name: "Frenzy I", desc: "+1 Max AP", cost: 4, apply: (u) => { u.apMax += 1; u.ap += 1; } },
    { id: "rune_rampage", name: "Rampage I", desc: "+4 Damage, -3 Max HP", cost: 4, apply: (u) => { u.maxHp -= 3; u.hp -= 3; u.dmg += 4; } },
    { id: "rune_deft", name: "Deft I", desc: "+1 Range, +1 Move", cost: 5, apply: (u) => { u.range += 1; u.move += 1; } },
    { id: "rune_chrono", name: "Chrono I", desc: "-1 cooldown to this unit's abilities", cost: 5, apply: (u) => {
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

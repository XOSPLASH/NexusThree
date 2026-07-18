(function() {
  window.RuneDefs = [
    {
      id: "rune_vitality",
      name: "Vitality",
      cost: 2,
      desc: "+20 Max HP",
      apply: (u) => { u.maxHp += 20; u.hp += 20; },
    },
    {
      id: "rune_power",
      name: "Power",
      cost: 2,
      desc: "+20 Damage",
      apply: (u) => { u.dmg += 20; },
    },
    {
      id: "rune_swiftness",
      name: "Swiftness",
      cost: 3,
      desc: "+1 Move",
      apply: (u) => { u.move += 1; },
    },
    {
      id: "rune_scope",
      name: "Scope",
      cost: 3,
      desc: "+1 Range",
      apply: (u) => { u.range += 1; },
    },
    {
      id: "rune_frenzy",
      name: "Frenzy",
      cost: 4,
      desc: "+1 Max AP",
      apply: (u) => { u.apMax += 1; u.ap += 1; },
    },
        
    {
      id: "rune_mending",
      name: "Mending",
      cost: 4,
      desc: "+10 HP per turn",
      apply: () => {},
      onTurnStart: (u) => { u.hp = Math.min(u.maxHp, u.hp + 10); },
      healPerTurn: 10,
    },

    {
      id: "rune_rampage",
      name: "Rampage",
      cost: 4,
      desc: "+40 Damage, -30 Max HP",
      apply: (u) => { u.maxHp -= 30; u.hp = Math.max(1, u.hp - 30); u.dmg += 40; },
    },
    
    {
      id: "rune_deft",
      name: "Deft",
      cost: 5,
      desc: "+1 Range, +1 Move",
      apply: (u) => { u.range += 1; u.move += 1; },
    },
    {
      id: "rune_chrono",
      name: "Chrono",
      cost: 5,
      desc: "+1 Ability Cooldown",
      apply: (u) => {
        u.globalCooldownMod = (u.globalCooldownMod || 0) - 1;
        if (u.abilityCooldowns) {
          for (const k of Object.keys(u.abilityCooldowns)) {
            u.abilityCooldowns[k] = Math.max(0, u.abilityCooldowns[k] - 1);
          }
        }
      }
    },

  ];
})();

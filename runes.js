(function() {
  window.RuneDefs = [
    {
      id: "rune_vitality",
      baseName: "Vitality",
      cost: 2,
      stages: [
        { level: 1, name: "Vitality I", desc: "+2 Max HP", turnsToNext: 2, apply: (u) => { u.maxHp += 2; u.hp += 2; } },
        { level: 2, name: "Vitality II", desc: "+3 Max HP", turnsToNext: 2, apply: (u) => { u.maxHp += 3; u.hp += 3; } },
        { level: 3, name: "Vitality III", desc: "+4 Max HP", apply: (u) => { u.maxHp += 4; u.hp += 4; } },
      ],
    },
    {
      id: "rune_power",
      baseName: "Power",
      cost: 2,
      stages: [
        { level: 1, name: "Power I", desc: "+2 Damage", turnsToNext: 2, apply: (u) => { u.dmg += 2; } },
        { level: 2, name: "Power II", desc: "+3 Damage", turnsToNext: 2, apply: (u) => { u.dmg += 1; } },
        { level: 3, name: "Power III", desc: "+4 Damage", apply: (u) => { u.dmg += 1; } },
      ],
    },
    {
      id: "rune_swiftness",
      baseName: "Swiftness",
      cost: 3,
      stages: [
        { level: 1, name: "Swiftness I", desc: "+1 Move", turnsToNext: 4, apply: (u) => { u.move += 1; } },
        { level: 2, name: "Swiftness II", desc: "+2 Move", turnsToNext: 5, apply: (u) => { u.move += 1; } },
        { level: 3, name: "Swiftness III", desc: "+2 Move, +1 Damage", apply: (u) => { u.dmg += 1; } },
      ],
    },
    {
      id: "rune_scope",
      baseName: "Scope",
      cost: 3,
      stages: [
        { level: 1, name: "Scope I", desc: "+1 Range", turnsToNext: 4, apply: (u) => { u.range += 1; } },
        { level: 2, name: "Scope II", desc: "+2 Range", turnsToNext: 5, apply: (u) => { u.range += 1; } },
        { level: 3, name: "Scope III", desc: "+2 Range, +1 Damage", apply: (u) => { u.dmg += 1; } },
      ],
    },
    {
      id: "rune_frenzy",
      baseName: "Frenzy",
      cost: 4,
      stages: [
        { level: 1, name: "Frenzy I", desc: "+1 Max AP", turnsToNext: 5, apply: (u) => { u.apMax += 1; u.ap += 1; } },
        { level: 2, name: "Frenzy II", desc: "+1 Max AP, +1 Move", apply: (u) => { u.move += 1; } },
      ],
    },
    {
      id: "rune_rampage",
      baseName: "Rampage",
      cost: 4,
      stages: [
        { level: 1, name: "Rampage I", desc: "+4 Damage, -3 Max HP", turnsToNext: 5, apply: (u) => { u.maxHp -= 3; u.hp = Math.max(1, u.hp - 3); u.dmg += 4; } },
        { level: 2, name: "Rampage II", desc: "+5 Damage, -4 Max HP", apply: (u) => { u.maxHp -= 1; u.hp = Math.max(1, Math.min(u.hp - 1, u.maxHp)); u.dmg += 1; } },
      ],
    },
    {
      id: "rune_deft",
      baseName: "Deft",
      cost: 5,
      stages: [
        { level: 1, name: "Deft I", desc: "+1 Range, +1 Move", turnsToNext: 5, apply: (u) => { u.range += 1; u.move += 1; } },
        { level: 2, name: "Deft II", desc: "+1 Range, +2 Move", apply: (u) => { u.move += 1; } },
      ],
    },
    {
      id: "rune_chrono",
      baseName: "Chrono",
      cost: 5,
      stages: [
        {
          level: 1,
          name: "Chrono I",
          desc: "+1 Ability Cooldown",
          turnsToNext: 6,
          apply: (u) => {
            u.globalCooldownMod = (u.globalCooldownMod || 0) - 1;
            if (u.abilityCooldowns) {
              for (const k of Object.keys(u.abilityCooldowns)) {
                u.abilityCooldowns[k] = Math.max(0, u.abilityCooldowns[k] - 1);
              }
            }
          }
        },
        {
          level: 2,
          name: "Chrono II",
          desc: "+1 Ability Cooldown, +1 Range",
          apply: (u) => {
            u.range += 1;
          }
        },
      ],
    }
  ];
})();

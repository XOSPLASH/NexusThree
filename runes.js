(function() {
  window.RuneDefs = [
    {
      id: "rune_vitality",
      baseName: "Vitality",
      cost: 2,
      stages: [
        { level: 1, name: "Vitality", desc: "+2 Max HP", apply: (u) => { u.maxHp += 2; u.hp += 2; } },
      ],
    },
    {
      id: "rune_power",
      baseName: "Power",
      cost: 2,
      stages: [
        { level: 1, name: "Power", desc: "+2 Damage", apply: (u) => { u.dmg += 2; } },
      ],
    },
    {
      id: "rune_swiftness",
      baseName: "Swiftness",
      cost: 3,
      stages: [
        { level: 1, name: "Swiftness", desc: "+1 Move", apply: (u) => { u.move += 1; } },
      ],
    },
    {
      id: "rune_scope",
      baseName: "Scope",
      cost: 3,
      stages: [
        { level: 1, name: "Scope", desc: "+1 Range", apply: (u) => { u.range += 1; } },
      ],
    },
    {
      id: "rune_frenzy",
      baseName: "Frenzy",
      cost: 4,
      stages: [
        { level: 1, name: "Frenzy", desc: "+1 Max AP", apply: (u) => { u.apMax += 1; u.ap += 1; } },
      ],
    },
    {
      id: "rune_rampage",
      baseName: "Rampage",
      cost: 4,
      stages: [
        { level: 1, name: "Rampage", desc: "+4 Damage, -3 Max HP", apply: (u) => { u.maxHp -= 3; u.hp = Math.max(1, u.hp - 3); u.dmg += 4; } },
      ],
    },
    {
      id: "rune_deft",
      baseName: "Deft",
      cost: 5,
      stages: [
        { level: 1, name: "Deft", desc: "+1 Range, +1 Move", apply: (u) => { u.range += 1; u.move += 1; } },
      ],
    },
    {
      id: "rune_chrono",
      baseName: "Chrono",
      cost: 5,
      stages: [
        {
          level: 1,
          name: "Chrono",
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
      ],
    },
    {
      id: "rune_mending",
      baseName: "Mending",
      cost: 4,
      stages: [
        {
          level: 1,
          name: "Mending",
          desc: "Heal 10 HP at the start of each of this unit's turns.",
          apply: () => {},
          onTurnStart: (u) => { u.hp = Math.min(u.maxHp, u.hp + 10); },
          healPerTurn: 10,
        },
      ],
    }
  ];
})();

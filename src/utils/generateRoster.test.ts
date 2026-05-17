import { describe, it, expect } from 'vitest';
import { generateRoster } from './generateRoster';

const BOSSES = [
  { id: '2795', name: 'Chimaerus' },
  { id: '2733', name: 'Imperator' },
];

const ALL_BOSSES = [
  { id: '2795', name: 'B1' }, { id: '2733', name: 'B2' }, { id: '2734', name: 'B3' },
  { id: '2736', name: 'B4' }, { id: '2735', name: 'B5' }, { id: '2737', name: 'B6' },
  { id: '2738', name: 'B7' }, { id: '2739', name: 'B8' }, { id: '2740', name: 'B9' },
];

type Role = 'Tank' | 'Healer' | 'DPS';

const makeMeta = (players: { name: string; cls: string; role: Role; flexRoles?: Role[] }[]) =>
  Object.fromEntries(players.map(p => [p.name, { class: p.cls, role: p.role, ...(p.flexRoles ? { flexRoles: p.flexRoles } : {}) }]));

function makeRoster(count: number, prefix = 'Player') {
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
}

describe('generateRoster', () => {
  // ── Existing tests updated for new signature (absent=[], bossConfig={}) ──

  it('assigns exactly 2 tanks and 4 healers per boss when available', () => {
    const mains = [
      'Tank1', 'Tank2', 'Tank3',
      'Heal1', 'Heal2', 'Heal3', 'Heal4', 'Heal5',
      ...makeRoster(15, 'DPS'),
    ];
    const meta = makeMeta([
      { name: 'Tank1', cls: 'Warrior', role: 'Tank' },
      { name: 'Tank2', cls: 'Paladin', role: 'Tank' },
      { name: 'Tank3', cls: 'Druid', role: 'Tank' },
      { name: 'Heal1', cls: 'Priest', role: 'Healer' },
      { name: 'Heal2', cls: 'Shaman', role: 'Healer' },
      { name: 'Heal3', cls: 'Monk', role: 'Healer' },
      { name: 'Heal4', cls: 'Paladin', role: 'Healer' },
      { name: 'Heal5', cls: 'Druid', role: 'Healer' },
      ...makeRoster(15, 'DPS').map(n => ({ name: n, cls: 'Mage', role: 'DPS' as const })),
    ]);

    const { grid } = generateRoster(mains, meta, {}, BOSSES, [], {});

    for (const boss of BOSSES) {
      const assigned = grid[boss.id] ?? [];
      const tanks = assigned.filter(p => meta[p]?.role === 'Tank');
      const healers = assigned.filter(p => meta[p]?.role === 'Healer');
      expect(tanks.length).toBe(2);
      expect(healers.length).toBe(4);
      expect(assigned.length).toBeLessThanOrEqual(20);
    }
  });

  it('respects pre-assigned players from currentGrid', () => {
    const mains = ['Tank1', 'Tank2', ...makeRoster(18, 'DPS')];
    const meta = makeMeta([
      { name: 'Tank1', cls: 'Warrior', role: 'Tank' },
      { name: 'Tank2', cls: 'Paladin', role: 'Tank' },
      ...makeRoster(18, 'DPS').map(n => ({ name: n, cls: 'Mage', role: 'DPS' as const })),
    ]);
    const currentGrid = { '2795': ['DPS1', 'DPS2'] };

    const { grid } = generateRoster(mains, meta, currentGrid, BOSSES, [], {});

    expect(grid['2795']).toContain('DPS1');
    expect(grid['2795']).toContain('DPS2');
  });

  it('does not exceed 20 players per boss', () => {
    const mains = makeRoster(26, 'Player');
    const meta = makeMeta(mains.map(n => ({ name: n, cls: 'Mage', role: 'DPS' as const })));

    const { grid } = generateRoster(mains, meta, {}, BOSSES, [], {});

    for (const boss of BOSSES) {
      expect((grid[boss.id] ?? []).length).toBeLessThanOrEqual(20);
    }
  });

  it('vault balance: players with < 6 appearances get swapped in when possible', () => {
    const mains = makeRoster(26, 'Player');
    const meta = makeMeta(mains.map(n => ({ name: n, cls: 'Mage', role: 'DPS' as const })));

    const { grid } = generateRoster(mains, meta, {}, ALL_BOSSES, [], {});

    const appearances = (p: string) =>
      ALL_BOSSES.filter(b => (grid[b.id] ?? []).includes(p)).length;

    const playersBelow6 = mains.filter(p => appearances(p) < 6);
    expect(playersBelow6.length).toBe(0);
  });

  it('fills bosses even with no pre-assigned', () => {
    const mains = makeRoster(20, 'P');
    const meta = makeMeta(mains.map(n => ({ name: n, cls: 'Warrior', role: 'DPS' as const })));

    const { grid } = generateRoster(mains, meta, {}, BOSSES, [], {});

    for (const boss of BOSSES) {
      expect((grid[boss.id] ?? []).length).toBe(20);
    }
  });

  // ── New tests ──

  it('absent players are never assigned to any boss', () => {
    const mains = makeRoster(20, 'P');
    const meta = makeMeta(mains.map(n => ({ name: n, cls: 'Mage', role: 'DPS' as const })));
    const absent = ['P1', 'P2'];

    const { grid } = generateRoster(mains, meta, {}, BOSSES, absent, {});

    for (const boss of BOSSES) {
      for (const absentPlayer of absent) {
        expect(grid[boss.id] ?? []).not.toContain(absentPlayer);
      }
    }
  });

  it('absent players pre-assigned in currentGrid are purged from output', () => {
    const mains = makeRoster(20, 'P');
    const meta = makeMeta(mains.map(n => ({ name: n, cls: 'Mage', role: 'DPS' as const })));
    const currentGrid = { '2795': ['P1', 'P3'] }; // P1 is absent but pre-assigned

    const { grid } = generateRoster(mains, meta, currentGrid, BOSSES, ['P1'], {});

    expect(grid['2795']).not.toContain('P1');
    expect(grid['2795']).toContain('P3'); // non-absent pre-assignment kept
  });

  it('absent players are excluded from Phase 2 vault balance', () => {
    const mains = makeRoster(26, 'Player');
    const meta = makeMeta(mains.map(n => ({ name: n, cls: 'Mage', role: 'DPS' as const })));
    const absent = ['Player1'];

    const { grid } = generateRoster(mains, meta, {}, ALL_BOSSES, absent, {});

    for (const boss of ALL_BOSSES) {
      expect(grid[boss.id] ?? []).not.toContain('Player1');
    }
  });

  it('per-boss healer count: 3 healers on one boss, 5 on another when configured', () => {
    const mains = [
      'Tank1', 'Tank2',
      'Heal1', 'Heal2', 'Heal3', 'Heal4', 'Heal5',
      ...makeRoster(13, 'DPS'),
    ];
    const meta = makeMeta([
      { name: 'Tank1', cls: 'Warrior', role: 'Tank' },
      { name: 'Tank2', cls: 'Paladin', role: 'Tank' },
      { name: 'Heal1', cls: 'Priest', role: 'Healer' },
      { name: 'Heal2', cls: 'Shaman', role: 'Healer' },
      { name: 'Heal3', cls: 'Monk', role: 'Healer' },
      { name: 'Heal4', cls: 'Paladin', role: 'Healer' },
      { name: 'Heal5', cls: 'Druid', role: 'Healer' },
      ...makeRoster(13, 'DPS').map(n => ({ name: n, cls: 'Mage', role: 'DPS' as const })),
    ]);
    const bossConfig = { '2795': { healers: 3 }, '2733': { healers: 5 } };

    const { grid } = generateRoster(mains, meta, {}, BOSSES, [], bossConfig);

    const healerCount = (bossId: string) =>
      (grid[bossId] ?? []).filter(p => meta[p]?.role === 'Healer').length;
    expect(healerCount('2795')).toBe(3);
    expect(healerCount('2733')).toBe(5);
  });

  it('flex healer fill: DPS with flexRoles=[Healer] fills healer shortfall', () => {
    // Only 2 primary healers — need 4. Two DPS have flex Healer.
    const mains = [
      'Tank1', 'Tank2',
      'Heal1', 'Heal2',
      'FlexHeal1', 'FlexHeal2',
      ...makeRoster(14, 'DPS'),
    ];
    const meta = makeMeta([
      { name: 'Tank1', cls: 'Warrior', role: 'Tank' },
      { name: 'Tank2', cls: 'Paladin', role: 'Tank' },
      { name: 'Heal1', cls: 'Priest', role: 'Healer' },
      { name: 'Heal2', cls: 'Shaman', role: 'Healer' },
      { name: 'FlexHeal1', cls: 'Monk', role: 'DPS', flexRoles: ['Healer'] },
      { name: 'FlexHeal2', cls: 'Druid', role: 'DPS', flexRoles: ['Healer'] },
      ...makeRoster(14, 'DPS').map(n => ({ name: n, cls: 'Mage', role: 'DPS' as const })),
    ]);

    const { grid } = generateRoster(mains, meta, {}, BOSSES, [], {});

    for (const boss of BOSSES) {
      const assigned = grid[boss.id] ?? [];
      // Flex healers fill to 4 total healer slots
      const healerSlotFillers = assigned.filter(
        p => meta[p]?.role === 'Healer' || (meta[p]?.flexRoles ?? []).includes('Healer')
      );
      expect(healerSlotFillers.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('flex tank fill: DPS with flexRoles=[Tank] fills tank shortfall', () => {
    // Only 1 primary tank — need 2. One DPS has flex Tank.
    const mains = [
      'Tank1',
      'FlexTank1',
      'Heal1', 'Heal2', 'Heal3', 'Heal4',
      ...makeRoster(14, 'DPS'),
    ];
    const meta = makeMeta([
      { name: 'Tank1', cls: 'Warrior', role: 'Tank' },
      { name: 'FlexTank1', cls: 'Paladin', role: 'DPS', flexRoles: ['Tank'] },
      { name: 'Heal1', cls: 'Priest', role: 'Healer' },
      { name: 'Heal2', cls: 'Shaman', role: 'Healer' },
      { name: 'Heal3', cls: 'Monk', role: 'Healer' },
      { name: 'Heal4', cls: 'Druid', role: 'Healer' },
      ...makeRoster(14, 'DPS').map(n => ({ name: n, cls: 'Mage', role: 'DPS' as const })),
    ]);

    const { grid } = generateRoster(mains, meta, {}, BOSSES, [], {});

    for (const boss of BOSSES) {
      const assigned = grid[boss.id] ?? [];
      const tankSlotFillers = assigned.filter(
        p => meta[p]?.role === 'Tank' || (meta[p]?.flexRoles ?? []).includes('Tank')
      );
      expect(tankSlotFillers.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('buff warning: returns warning when a buff class has no available player', () => {
    // All players are Mage — no Druid, Priest, etc. → expect warnings for missing classes
    const mains = makeRoster(20, 'P');
    const meta = makeMeta(mains.map(n => ({ name: n, cls: 'Mage', role: 'DPS' as const })));

    const { warnings } = generateRoster(mains, meta, {}, BOSSES, [], {});

    // At minimum, should warn about classes with no representation
    expect(warnings.length).toBeGreaterThan(0);
    // Warning format: "BossName: missing ClassName"
    expect(warnings[0]).toMatch(/missing/i);
  });

  it('buff coverage emits warning when the only buff-class player is a healer blocked by slot limit', () => {
    // healerSlots=2, 3 primary healers: Heal1 (Shaman), Heal2 (Monk), PaladinBuff (Paladin).
    // Primary fill takes Heal1 + Heal2 (first 2 in mains order, both at 0 appearances).
    // PaladinBuff is 3rd — no slot remains — and is the only Paladin.
    // withinRoleLimit must block PaladinBuff in buff-coverage fallback → warning emitted.
    const mains = [
      'Tank1', 'Tank2',
      'Heal1', 'Heal2', 'PaladinBuff',
      ...makeRoster(15, 'DPS'),
    ];
    const meta = makeMeta([
      { name: 'Tank1', cls: 'Warrior', role: 'Tank' },
      { name: 'Tank2', cls: 'Evoker', role: 'Tank' },
      { name: 'Heal1', cls: 'Shaman', role: 'Healer' },
      { name: 'Heal2', cls: 'Monk', role: 'Healer' },
      { name: 'PaladinBuff', cls: 'Paladin', role: 'Healer' },
      ...makeRoster(15, 'DPS').map(n => ({ name: n, cls: 'Mage', role: 'DPS' as const })),
    ]);
    const bossConfig = { '2795': { healers: 2 }, '2733': { healers: 2 } };

    const { grid, warnings } = generateRoster(mains, meta, {}, BOSSES, [], bossConfig);

    for (const boss of BOSSES) {
      const assigned = grid[boss.id] ?? [];
      // Exactly 2 healers per boss (Heal1 + Heal2); PaladinBuff must not appear
      const healers = assigned.filter(p => meta[p]?.role === 'Healer');
      expect(healers.length).toBe(2);
      expect(assigned).not.toContain('PaladinBuff');
    }
    // Paladin buff can't be covered → warning expected
    expect(warnings.some(w => /Paladin/i.test(w))).toBe(true);
  });

  it('Phase 2 vault balance cannot insert healers beyond the per-boss slot limit', () => {
    // 4 primary healers (H1–H3 + PaladinBuff) compete for 2 healer slots over 9 bosses.
    // Phase 1 rotates them: each gets ~4–5 appearances (below the 6-boss vault threshold).
    // Phase 2 tries to top up PaladinBuff but every boss already has effectiveCount=2 healers,
    // so the effectiveCount >= limit check fires and PaladinBuff cannot be inserted or swapped in.
    const mains = [
      'Tank1', 'Tank2',
      'Heal1', 'Heal2', 'Heal3', 'PaladinBuff',
      ...makeRoster(14, 'DPS'),
    ];
    const meta = makeMeta([
      { name: 'Tank1', cls: 'Warrior', role: 'Tank' },
      { name: 'Tank2', cls: 'Evoker', role: 'Tank' },
      { name: 'Heal1', cls: 'Shaman', role: 'Healer' },
      { name: 'Heal2', cls: 'Monk', role: 'Healer' },
      { name: 'Heal3', cls: 'Druid', role: 'Healer' },
      { name: 'PaladinBuff', cls: 'Paladin', role: 'Healer' },
      ...makeRoster(14, 'DPS').map(n => ({ name: n, cls: 'Mage', role: 'DPS' as const })),
    ]);
    const bossConfig = Object.fromEntries(ALL_BOSSES.map(b => [b.id, { healers: 2 }]));

    const { grid } = generateRoster(mains, meta, {}, ALL_BOSSES, [], bossConfig);

    // With 4 healers sharing 2 slots across 9 bosses, each healer gets at most ~5 appearances.
    // Phase 2 must not overflow a boss by inserting PaladinBuff past the 2-slot limit.
    for (const boss of ALL_BOSSES) {
      const assigned = grid[boss.id] ?? [];
      const effectiveHealers = assigned.filter(p => meta[p]?.role === 'Healer' || (meta[p] as any)?.flexRoles?.includes('Healer'));
      expect(effectiveHealers.length).toBeLessThanOrEqual(2);
    }
    // PaladinBuff is slot-limited; Phase 2 cannot boost them to 6
    const pbCount = Object.values(grid).filter(b => b.includes('PaladinBuff')).length;
    expect(pbCount).toBeLessThan(6);
  });
});

export interface PlayerMeta {
  class: string;
  role: 'Tank' | 'Healer' | 'DPS';
  flexRoles?: Array<'Tank' | 'Healer' | 'DPS'>;
}

export interface Boss {
  id: string;
  name: string;
}

export type Grid = Record<string, string[]>;

const BUFF_CLASSES = [
  'Druid', 'Priest', 'Mage', 'Shaman', 'Paladin', 'Warrior',
  'Monk', 'Hunter', 'Demon Hunter', 'Warlock', 'Evoker', 'Rogue',
];

const RAID_SIZE = 20;
const TANK_SLOTS = 2;
const DEFAULT_HEALER_SLOTS = 4;
const MIN_VAULT_BOSSES = 6;

export function generateRoster(
  mains: string[],
  playerMeta: Record<string, PlayerMeta>,
  currentGrid: Grid,
  bosses: Boss[],
  absent: string[],
  bossConfig: Record<string, { healers: number }>,
): { grid: Grid; warnings: string[] } {
  const absentSet = new Set(absent);

  // knownPlayers: have metadata AND are not absent. Computed ONCE before Phase 1.
  const knownPlayers = mains.filter(
    p => playerMeta[p] !== undefined && !absentSet.has(p)
  );

  // Deep copy current assignments, filtering out absent players
  const grid: Grid = {};
  for (const boss of bosses) {
    grid[boss.id] = (currentGrid[boss.id] ?? []).filter(p => !absentSet.has(p));
  }

  const warnings: string[] = [];

  function appearances(player: string): number {
    return Object.values(grid).filter(list => list.includes(player)).length;
  }

  function sortByAppearances(players: string[]): string[] {
    return [...players].sort((a, b) => appearances(a) - appearances(b));
  }

  function availableWith(predicate: (p: string) => boolean, assignedSet: Set<string>): string[] {
    return sortByAppearances(knownPlayers.filter(p => !assignedSet.has(p) && predicate(p)));
  }

  // Phase 1: Fill each boss to RAID_SIZE
  for (const boss of bosses) {
    const assigned = grid[boss.id];
    const assignedSet = new Set(assigned);
    const healerSlots = bossConfig[boss.id]?.healers ?? DEFAULT_HEALER_SLOTS;

    // Fill tanks — primary Tank first, then flex-Tank
    const currentTanks = assigned.filter(p => playerMeta[p]?.role === 'Tank').length;
    let tanksNeeded = Math.max(0, TANK_SLOTS - currentTanks);
    for (const t of availableWith(p => playerMeta[p]?.role === 'Tank', assignedSet).slice(0, tanksNeeded)) {
      assigned.push(t);
      assignedSet.add(t);
      tanksNeeded--;
    }
    if (tanksNeeded > 0) {
      for (const t of availableWith(p => (playerMeta[p]?.flexRoles ?? []).includes('Tank'), assignedSet).slice(0, tanksNeeded)) {
        assigned.push(t);
        assignedSet.add(t);
      }
    }

    // Fill healers — primary Healer first, then flex-Healer
    const currentHealers = assigned.filter(p => playerMeta[p]?.role === 'Healer').length;
    let healersNeeded = Math.max(0, healerSlots - currentHealers);
    for (const h of availableWith(p => playerMeta[p]?.role === 'Healer', assignedSet).slice(0, healersNeeded)) {
      assigned.push(h);
      assignedSet.add(h);
      healersNeeded--;
    }
    if (healersNeeded > 0) {
      for (const h of availableWith(p => (playerMeta[p]?.flexRoles ?? []).includes('Healer'), assignedSet).slice(0, healersNeeded)) {
        assigned.push(h);
        assignedSet.add(h);
      }
    }

    // Helper: check if adding a player would exceed effective role slot limits for this boss.
    // Counts both primary-role and flex-role fills occupying that slot.
    const withinRoleLimit = (p: string): boolean => {
      const role = playerMeta[p]?.role;
      if (role === 'Tank') {
        const effective = assigned.filter(
          q => playerMeta[q]?.role === 'Tank' || (playerMeta[q]?.flexRoles ?? []).includes('Tank')
        ).length;
        return effective < TANK_SLOTS;
      }
      if (role === 'Healer') {
        const effective = assigned.filter(
          q => playerMeta[q]?.role === 'Healer' || (playerMeta[q]?.flexRoles ?? []).includes('Healer')
        ).length;
        return effective < healerSlots;
      }
      return true;
    };

    // Buff coverage (hard constraint): one player per buff class
    const coveredClasses = new Set(
      assigned.map(p => playerMeta[p]?.class).filter(Boolean),
    );
    for (const buffClass of BUFF_CLASSES) {
      if (coveredClasses.has(buffClass)) continue;
      if (assigned.length >= RAID_SIZE) {
        warnings.push(`${boss.name}: missing ${buffClass}`);
        continue;
      }
      // Prefer DPS-primary; fall back to any class match that still fits within role limits
      const candidate =
        availableWith(p => playerMeta[p]?.class === buffClass && playerMeta[p]?.role === 'DPS', assignedSet)[0] ??
        availableWith(p => playerMeta[p]?.class === buffClass && withinRoleLimit(p), assignedSet)[0];
      if (candidate) {
        assigned.push(candidate);
        assignedSet.add(candidate);
        coveredClasses.add(buffClass);
      } else {
        warnings.push(`${boss.name}: missing ${buffClass}`);
      }
    }

    // Fill remaining slots to RAID_SIZE — prefer DPS; fall back to others within role limits
    const remaining = RAID_SIZE - assigned.length;
    if (remaining > 0) {
      const dpsPool = availableWith(p => playerMeta[p]?.role === 'DPS', assignedSet);
      const fallbackPool = availableWith(
        p => playerMeta[p]?.role !== 'DPS' && withinRoleLimit(p),
        assignedSet,
      );
      for (const p of [...dpsPool, ...fallbackPool].slice(0, remaining)) {
        assigned.push(p);
        assignedSet.add(p);
      }
    }
  }

  // Phase 2: Vault balance — best-effort: ensures every player has >= MIN_VAULT_BOSSES appearances.
  // May not fully balance if all boss slots are occupied by players exactly at the vault minimum.
  // Iterates knownPlayers (absent players are excluded).
  for (const player of knownPlayers) {
    if (appearances(player) >= MIN_VAULT_BOSSES) continue;

    for (const boss of bosses) {
      if (appearances(player) >= MIN_VAULT_BOSSES) break;
      const assigned = grid[boss.id];
      if (assigned.includes(player)) continue;

      // Check effective role-slot limits (primary + flex fills) before inserting
      const playerRole = playerMeta[player]?.role;
      const limit = playerRole === 'Tank' ? TANK_SLOTS : playerRole === 'Healer' ? (bossConfig[boss.id]?.healers ?? DEFAULT_HEALER_SLOTS) : Infinity;
      const effectiveCount = assigned.filter(p => {
        if (playerMeta[p]?.role === playerRole) return true;
        return (playerMeta[p]?.flexRoles ?? []).includes(playerRole as 'Tank' | 'Healer' | 'DPS');
      }).length;
      if (effectiveCount >= limit) continue;

      // Free slot available
      if (assigned.length < RAID_SIZE) {
        assigned.push(player);
        continue;
      }

      // Try swapping out a DPS who has more than minimum appearances
      const candidates = assigned
        .filter(p => playerMeta[p]?.role === 'DPS' && appearances(p) > MIN_VAULT_BOSSES)
        .sort((a, b) => appearances(b) - appearances(a));

      for (const candidate of candidates) {
        const candidateClass = playerMeta[candidate]?.class;
        const isBuffClass = candidateClass && BUFF_CLASSES.includes(candidateClass);
        const otherOfSameClass = assigned.filter(
          p => p !== candidate && playerMeta[p]?.class === candidateClass,
        );
        if (!isBuffClass || otherOfSameClass.length > 0) {
          const idx = assigned.indexOf(candidate);
          assigned.splice(idx, 1, player);
          break;
        }
      }
    }
  }

  return { grid, warnings };
}

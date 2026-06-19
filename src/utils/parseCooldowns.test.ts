import { describe, it, expect } from 'vitest';
import { parseCooldowns } from './parseCooldowns';

const HEADER = 'EncounterID:3183;Difficulty:Mythic;Name:Midnight';
const ENTRY1 = 'time:16;ph:1;bossSpell:1284931;tag:Opora;spellid:29166;';
const ENTRY2 = 'time:57;ph:1;bossSpell:1279420;tag:Catsavage;spellid:106898;';
const ENTRY_TEXT = 'time:130;ph:1;bossSpell:1284931;tag:everyone;text:Personals;';
const ENTRY_NO_BOSS_SPELL = 'time:5;ph:1;tag:Ratboat;spellid:472433;';

describe('parseCooldowns', () => {
  it('returns null for empty string', () => {
    expect(parseCooldowns('')).toBeNull();
  });

  it('returns null when header is missing EncounterID', () => {
    expect(parseCooldowns('Difficulty:Mythic;Name:Midnight\n' + ENTRY1)).toBeNull();
  });

  it('returns null when header has non-numeric EncounterID', () => {
    expect(parseCooldowns('EncounterID:abc;Difficulty:Mythic;Name:Midnight\n' + ENTRY1)).toBeNull();
  });

  it('parses header fields correctly', () => {
    const sheet = parseCooldowns(`${HEADER}\n${ENTRY1}`);
    expect(sheet).not.toBeNull();
    expect(sheet!.encounterId).toBe(3183);
    expect(sheet!.difficulty).toBe('Mythic');
    expect(sheet!.encounterName).toBe('Midnight');
  });

  it('parses an entry with bossSpell and spellId', () => {
    const sheet = parseCooldowns(`${HEADER}\n${ENTRY1}`)!;
    expect(sheet.entries).toHaveLength(1);
    const e = sheet.entries[0];
    expect(e.time).toBe(16);
    expect(e.phase).toBe(1);
    expect(e.tag).toBe('Opora');
    expect(e.spellId).toBe(29166);
    expect(e.bossSpell).toBe(1284931);
    expect(e.text).toBeUndefined();
  });

  it('parses an entry with text and no spellId', () => {
    const sheet = parseCooldowns(`${HEADER}\n${ENTRY_TEXT}`)!;
    const e = sheet.entries[0];
    expect(e.tag).toBe('everyone');
    expect(e.text).toBe('Personals');
    expect(e.spellId).toBeUndefined();
  });

  it('parses multiple entries', () => {
    const sheet = parseCooldowns(`${HEADER}\n${ENTRY1}\n${ENTRY2}\n${ENTRY_NO_BOSS_SPELL}`)!;
    expect(sheet.entries).toHaveLength(3);
  });

  it('silently skips entry missing tag', () => {
    const bad = 'time:10;ph:1;spellid:12345;';
    const sheet = parseCooldowns(`${HEADER}\n${bad}\n${ENTRY1}`)!;
    expect(sheet.entries).toHaveLength(1);
  });

  it('silently skips entry with non-numeric time', () => {
    const bad = 'time:abc;ph:1;tag:Someone;spellid:12345;';
    const sheet = parseCooldowns(`${HEADER}\n${bad}\n${ENTRY1}`)!;
    expect(sheet.entries).toHaveLength(1);
  });

  it('silently skips entry with non-numeric phase', () => {
    const bad = 'time:10;ph:abc;tag:Someone;spellid:12345;';
    const sheet = parseCooldowns(`${HEADER}\n${bad}\n${ENTRY1}`)!;
    expect(sheet.entries).toHaveLength(1);
  });

  it('returns null when header is missing Difficulty', () => {
    expect(parseCooldowns('EncounterID:3183;Name:Midnight\n' + ENTRY1)).toBeNull();
  });

  it('returns null when header is missing Name', () => {
    expect(parseCooldowns('EncounterID:3183;Difficulty:Mythic\n' + ENTRY1)).toBeNull();
  });

  it('silently skips lines that do not match either pattern', () => {
    const sheet = parseCooldowns(`${HEADER}\n\n   \nsome random line\n${ENTRY1}`)!;
    expect(sheet.entries).toHaveLength(1);
  });

  it('silently skips entry missing time key', () => {
    const bad = 'ph:1;tag:Someone;spellid:12345;';
    const sheet = parseCooldowns(`${HEADER}\n${bad}\n${ENTRY1}`)!;
    expect(sheet.entries).toHaveLength(1);
  });

  it('silently skips entry missing ph key', () => {
    const bad = 'time:10;tag:Someone;spellid:12345;';
    const sheet = parseCooldowns(`${HEADER}\n${bad}\n${ENTRY1}`)!;
    expect(sheet.entries).toHaveLength(1);
  });

  it('silently omits spellId when value is non-numeric', () => {
    const bad = 'time:10;ph:1;tag:Someone;spellid:N/A;';
    const sheet = parseCooldowns(`${HEADER}\n${bad}`)!;
    expect(sheet.entries[0].spellId).toBeUndefined();
  });

  it('returns a valid sheet with empty entries when only header is present', () => {
    const sheet = parseCooldowns(HEADER);
    expect(sheet).not.toBeNull();
    expect(sheet!.entries).toHaveLength(0);
  });
});

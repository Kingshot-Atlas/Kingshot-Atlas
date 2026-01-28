import { getOutcome } from './outcomes';

describe('getOutcome', () => {
  it('returns Domination for prep win + battle win', () => {
    expect(getOutcome('W', 'W')).toBe('Domination');
    expect(getOutcome('Win', 'Win')).toBe('Domination');
  });

  it('returns Defeat for prep loss + battle loss', () => {
    expect(getOutcome('L', 'L')).toBe('Defeat');
    expect(getOutcome('Loss', 'Loss')).toBe('Defeat');
  });

  it('returns Comeback for prep loss + battle win', () => {
    expect(getOutcome('L', 'W')).toBe('Comeback');
    expect(getOutcome('Loss', 'Win')).toBe('Comeback');
  });

  it('returns Reversal for prep win + battle loss', () => {
    expect(getOutcome('W', 'L')).toBe('Reversal');
    expect(getOutcome('Win', 'Loss')).toBe('Reversal');
  });

  it('handles case-insensitive inputs', () => {
    expect(getOutcome('w', 'w')).toBe('Domination');
    expect(getOutcome('WIN', 'WIN')).toBe('Domination');
  });
});

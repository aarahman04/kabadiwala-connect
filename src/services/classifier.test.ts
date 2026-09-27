import { describe, expect, it } from 'vitest';
import { toSuggestion, type ClassifierResult } from './classifier';

const base = (over: Partial<ClassifierResult>): ClassifierResult => ({
  class: 'PCB',
  confidence: 0.8,
  uncertain: false,
  scores: { CRT: 0, LCD: 0, PCB: 0.8, Cables: 0, Batteries: 0, 'Motors/Magnets': 0, 'Mixed Plastic': 0, Other: 0.2 },
  ...over,
});

describe('classifier label mapping', () => {
  it('maps every material label to an app category', () => {
    const map = { CRT: 'CRT', LCD: 'LCD_PANEL', PCB: 'PCB', Cables: 'CABLE', Batteries: 'BATTERY', 'Motors/Magnets': 'MOTOR_MAGNET', 'Mixed Plastic': 'MIXED_PLASTIC' } as const;
    for (const [label, category] of Object.entries(map)) {
      expect(toSuggestion(base({ class: label as ClassifierResult['class'] }))).toMatchObject({ verdict: 'match', category });
    }
  });
  it('uncertain -> unsure, no category (collector picks)', () => {
    expect(toSuggestion(base({ class: 'Other', uncertain: true, best_guess: 'PCB' }))).toMatchObject({ verdict: 'unsure' });
    expect(toSuggestion(base({ class: 'Other', uncertain: true })).category).toBeUndefined();
  });
  it('confident Other -> not e-waste', () => {
    expect(toSuggestion(base({ class: 'Other', uncertain: false }))).toMatchObject({ verdict: 'not_ewaste' });
  });
});

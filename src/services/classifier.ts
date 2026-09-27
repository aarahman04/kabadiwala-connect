/**
 * Maps the classifier service's labels to the app's material categories.
 * The model itself lives in classifier/ (Python); swapping it only changes
 * that service as long as it keeps returning these labels.
 */
import type { MaterialCategory } from '../data/models';

export type ClassifierLabel =
  | 'CRT'
  | 'LCD'
  | 'PCB'
  | 'Cables'
  | 'Batteries'
  | 'Motors/Magnets'
  | 'Mixed Plastic'
  | 'Other';

export interface ClassifierResult {
  class: ClassifierLabel;
  confidence: number;
  uncertain: boolean;
  best_guess?: ClassifierLabel;
  scores: Record<ClassifierLabel, number>;
  model?: string;
}

const LABEL_TO_CATEGORY: Record<Exclude<ClassifierLabel, 'Other'>, MaterialCategory> = {
  CRT: 'CRT',
  LCD: 'LCD_PANEL',
  PCB: 'PCB',
  Cables: 'CABLE',
  Batteries: 'BATTERY',
  'Motors/Magnets': 'MOTOR_MAGNET',
  'Mixed Plastic': 'MIXED_PLASTIC',
};

export interface PhotoSuggestion {
  /** Set only when the model is confident; otherwise the collector picks. */
  category?: MaterialCategory;
  /** 'not_ewaste': confidently "Other"; 'unsure': below threshold / too close. */
  verdict: 'match' | 'unsure' | 'not_ewaste';
  confidence: number;
  raw: ClassifierResult;
}

export function toSuggestion(r: ClassifierResult): PhotoSuggestion {
  if (r.class === 'Other') {
    return { verdict: r.uncertain ? 'unsure' : 'not_ewaste', confidence: r.confidence, raw: r };
  }
  return { category: LABEL_TO_CATEGORY[r.class], verdict: 'match', confidence: r.confidence, raw: r };
}

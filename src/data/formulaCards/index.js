// ─── Formula Cards Index ──────────────────────────────────────────────────────
// Merges all three subject files into one exported array.
// App reads from here — edit math.js / physics.js / chemistry.js to add cards.

import { mathFormulaCards } from './math';
import { physicsFormulaCards } from './physics';
import { chemistryFormulaCards } from './chemistry';

export const allFormulaCards = [
  ...mathFormulaCards,
  ...physicsFormulaCards,
  ...chemistryFormulaCards,
];

export { mathFormulaCards, physicsFormulaCards, chemistryFormulaCards };

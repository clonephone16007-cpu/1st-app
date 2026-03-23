// ─── useRankDelta ─────────────────────────────────────────────────────────────
// Computes daily AIR estimate and delta from Kalman + BKT chain.
// Single source of truth for the rank delta engine.

import { useMemo } from 'react';
import { useEngineContext } from './useEngineContext';
import { predictorEngine } from '../engines/predictorEngine';
import { getBKTKnowledge } from '../engines/decayEngine';

export function useRankDelta() {
  const {
    scores, chapters, resolvedDefs, examTimelines, settings,
  } = useEngineContext();

  return useMemo(() => {
    const results = {};

    for (const exam of examTimelines) {
      const examScores = scores[exam.id] || [];
      if (examScores.length < 2) {
        results[exam.id] = {
          currentAIR: null,
          ghostAIR: settings.ghostAIR || 2000,
          delta: null,
          trend: 'Need more data',
          airEstimate: null,
        };
        continue;
      }

      const prediction = predictorEngine.predictPercentile(scores, exam.id);
      if (!prediction?.airEstimate) {
        results[exam.id] = {
          currentAIR: null,
          ghostAIR: settings.ghostAIR || 2000,
          delta: null,
          trend: 'Need more data',
          airEstimate: null,
        };
        continue;
      }

      // Compute BKT-weighted AIR adjustment
      // Higher average BKT retention → slightly better predicted rank
      let totalBKT = 0;
      let bktCount = 0;
      resolvedDefs.forEach(def => {
        const state = chapters[def.id];
        if (state?.done) {
          totalBKT += getBKTKnowledge(state, def.subject);
          bktCount++;
        }
      });
      const avgBKT = bktCount > 0 ? totalBKT / bktCount : 0.5;
      // BKT adjustment: high retention slightly improves predicted AIR
      const bktMultiplier = 0.9 + avgBKT * 0.2; // 0.9 to 1.1

      const adjustedMedian = Math.round(prediction.airEstimate.median * (2 - bktMultiplier));
      const ghostAIR = settings.ghostAIR || 2000;
      const gap = adjustedMedian - ghostAIR;

      results[exam.id] = {
        currentAIR: adjustedMedian,
        ghostAIR,
        delta: gap,
        trend: prediction.trend,
        airEstimate: {
          optimistic: prediction.airEstimate.optimistic,
          median: adjustedMedian,
          pessimistic: prediction.airEstimate.pessimistic,
        },
        velocity: prediction.velocity,
        kalmanEstimates: prediction.kalmanEstimates,
      };
    }

    return results;
  }, [scores, chapters, examTimelines, resolvedDefs, settings.ghostAIR]);
}

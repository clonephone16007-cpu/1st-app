// ─── Knowledge Space Theory + DP Knapsack Scheduler ─────────────────────────
//
// Two algorithms:
// 1. KST: Topological sort on prerequisite DAG — only surface chapters whose
//    prerequisites are complete (Kahn's algorithm, O(V+E))
// 2. DP Knapsack: Given a time budget, find the chapter allocation that
//    maximises expected score gain (fractional knapsack, O(n log n))

// ─── Prerequisite graph ───────────────────────────────────────────────────────
// Each entry: chapterId → [prerequisiteId, ...]
export const PREREQUISITES = {
  // Math dependencies
  'm04': ['m03'],            // Trig Equations needs Trig Ratios
  'm06': ['m02'],            // Quadratic needs Basic Maths
  'm09': ['m08'],            // Binomial needs P&C
  'm12': ['m10'],            // Circles needs Straight Lines
  'm13': ['m12'],            // Parabola needs Circles
  'm14': ['m13'],            // Ellipse needs Parabola
  'm15': ['m14'],            // Hyperbola needs Ellipse
  'm19': ['m03'],            // Inverse Trig needs Trig
  'm21': ['m20'],            // Determinants needs Matrices
  'm23': ['m22'],            // Methods of Diff needs LCD
  'm24': ['m23'],            // Applications of Deriv needs Methods
  'm25': ['m22'],            // Indefinite Integration needs LCD
  'm26': ['m25'],            // Definite Integration needs Indefinite
  'm27': ['m26'],            // Area needs Definite Integration
  'm28': ['m25', 'm22'],     // Diff Equations needs both
  'm29': ['m10'],            // Vectors needs Straight Lines
  'm30': ['m29'],            // 3D Geometry needs Vectors
  'm31': ['m08'],            // Probability needs P&C

  // Physics dependencies
  'p03': ['p02'],            // Motion in Plane needs Motion in Line
  'p04': ['p02', 'p03'],     // Newton's Laws needs kinematics
  'p05': ['p04'],            // Work-Energy needs Newton's Laws
  'p06': ['p05'],            // COM needs Work-Energy
  'p07': ['p04', 'p06'],     // Rotational needs Newton + COM
  'p08': ['p04'],            // Gravitation needs Newton's Laws
  'p12': ['p11'],            // Thermodynamics needs Thermal Props
  'p13': ['p12'],            // Kinetic Theory needs Thermodynamics
  'p14': ['p04', 'p05'],     // SHM needs Newton + Energy
  'p15': ['p14'],            // Waves needs SHM
  'p17': ['p16'],            // Capacitance needs Electric Fields
  'p18': ['p17'],            // Current Electricity needs Capacitance
  'p19': ['p18'],            // Moving Charges needs Current Electricity
  'p21': ['p19'],            // EMI needs Moving Charges
  'p22': ['p21'],            // AC needs EMI
  'p23': ['p22'],            // EM Waves needs AC
  'p25': ['p24'],            // Wave Optics needs Ray Optics
  'p27': ['p26'],            // Atoms needs Dual Nature
  'p28': ['p27'],            // Nuclei needs Atoms
  'p29': ['p28'],            // Semiconductors needs Nuclei

  // Chemistry dependencies
  'c02': ['c01'],            // Atomic Structure needs Mole Concept
  'c03': ['c02'],            // Periodicity needs Atomic Structure
  'c04': ['c02', 'c03'],     // Bonding needs Atomic + Periodic
  'c06': ['c05'],            // Thermodynamics needs States of Matter
  'c07': ['c06'],            // Equilibrium needs Thermodynamics
  'c08': ['c07'],            // Redox needs Equilibrium
  'c10': ['c05', 'c01'],     // Solutions needs States + Mole
  'c11': ['c08', 'c10'],     // Electrochemistry needs Redox + Solutions
  'c12': ['c07'],            // Kinetics needs Equilibrium
  'c17': ['c16'],            // p-Block 15-18 needs p-Block 13-14
  'c18': ['c03', 'c04'],     // d-f Block needs Periodic + Bonding
  'c19': ['c18'],            // Coordination needs d-f Block
  'c20': ['c08', 'c11'],     // Metallurgy needs Redox + Electrochemistry
  'c23': ['c22'],            // IUPAC needs GOC
  'c24': ['c22', 'c23'],     // Isomerism needs GOC + IUPAC
  'c25': ['c22', 'c24'],     // Hydrocarbons needs GOC + Isomerism
  'c26': ['c25'],            // Haloalkanes needs Hydrocarbons
  'c27': ['c25', 'c26'],     // Alcohols/Phenols needs Hydrocarbons + Haloalkanes
  'c28': ['c27'],            // Aldehydes/Ketones needs Alcohols
  'c29': ['c28'],            // Amines needs Aldehydes
  'c30': ['c22'],            // Biomolecules needs GOC
};

// ─── Kahn's Topological Sort ──────────────────────────────────────────────────
// Returns valid topological ordering of chapter OBJECTS (not just IDs)
// Only returns chapters whose prerequisites are all satisfied
export function getTopologicalOrder(chapterDefs) {
  const inDegree = {};
  const adj = {};  // adjacency list: node → list of nodes it unlocks
  const defMap = {};

  chapterDefs.forEach(c => {
    inDegree[c.id] = 0;
    adj[c.id] = [];
    defMap[c.id] = c;
  });

  chapterDefs.forEach(c => {
    const prereqs = PREREQUISITES[c.id] || [];
    prereqs.forEach(prereq => {
      if (adj[prereq]) {
        adj[prereq].push(c.id);
        inDegree[c.id] = (inDegree[c.id] || 0) + 1;
      }
    });
  });

  // BFS from nodes with no prerequisites
  const queue = chapterDefs.filter(c => inDegree[c.id] === 0).map(c => c.id);
  const order = [];

  while (queue.length > 0) {
    const id = queue.shift();
    // Return full chapter objects, not bare IDs
    if (defMap[id]) order.push(defMap[id]);
    (adj[id] || []).forEach(next => {
      inDegree[next] -= 1;
      if (inDegree[next] === 0) queue.push(next);
    });
  }

  return order;
}

// ─── KST frontier: chapters available to study now ───────────────────────────
// Returns chapters whose prerequisites are all done, sorted by priority
export function getKSTFrontier(completedIds, chapterDefs) {
  const completedSet = new Set(completedIds);
  return chapterDefs.filter(c => {
    if (completedSet.has(c.id)) return false; // Already done
    const prereqs = PREREQUISITES[c.id] || [];
    return prereqs.every(p => completedSet.has(p)); // All prereqs satisfied
  });
}

// ─── Fractional Knapsack: optimal time allocation ─────────────────────────────
// Given time budget (minutes), maximise expected score gain
// Value of studying chapter = tier_weight * jeeWeight * (1 - bktRetention)
// Time cost = estimated study hours per chapter
export function knapsackAllocate(frontier, chapterStates, budgetMinutes) {
  const TIER_WEIGHT = { T1: 3.0, T2: 1.8, T3: 1.0 };
  const STUDY_TIMES = { T1: 90, T2: 60, T3: 45 }; // minutes per chapter

  const items = frontier.map(c => {
    const state = chapterStates[c.id] || {};
    const retention = state.done ? Math.min(0.95, (state.confidence || 1) / 5) : 0;
    const tierW = TIER_WEIGHT[c.tier] || 1;
    const weight = Math.max(0.1, c.jeeWeight || 1);
    const value = tierW * weight * (1 - retention);
    const time = STUDY_TIMES[c.tier] || 60;

    return { ...c, value, time, valueDensity: value / time };
  });

  // Sort by value density (greedy fractional knapsack)
  items.sort((a, b) => b.valueDensity - a.valueDensity);

  let remainingBudget = budgetMinutes;
  const allocated = [];

  for (const item of items) {
    if (remainingBudget <= 0) break;
    const fraction = Math.min(1, remainingBudget / item.time);
    allocated.push({
      ...item,
      allocatedMinutes: Math.round(fraction * item.time),
      fraction,
    });
    remainingBudget -= item.time * fraction;
    if (fraction < 1) break; // Fractional last item
  }

  return allocated;
}

// ─── Main entry: top priority chapters (KST + Knapsack) ─────────────────────
export function getTopChapters(chapters, chapterDefs, settings, burnoutState = null, decayAlerts = [], n = 5) {
  const completedIds = Object.entries(chapters)
    .filter(([, state]) => state.done)
    .map(([id]) => id);

  // Get KST frontier (only chapters with satisfied prerequisites)
  let frontier = getKSTFrontier(completedIds, chapterDefs);
  
  // Algorithm interconnection: Decay alerts block new T3 learning
  const hasFadingT1 = decayAlerts.some(a => a.tier === 'T1' && a.status === 'fading');
  if (hasFadingT1) {
    frontier = frontier.filter(c => c.tier !== 'T3');
  }

  if (frontier.length === 0) {
    // Fallback: everything available (no prereq data yet)
    return chapterDefs
      .filter(c => !chapters[c.id]?.done)
      .sort((a, b) => {
        const tA = a.tier === 'T1' ? 3 : a.tier === 'T2' ? 2 : 1;
        const tB = b.tier === 'T1' ? 3 : b.tier === 'T2' ? 2 : 1;
        return tB * (b.jeeWeight || 1) - tA * (a.jeeWeight || 1);
      })
      .slice(0, n);
  }

  // Apply knapsack to get best allocation from frontier
  let burnoutMultiplier = 1.0;
  if (burnoutState?.currentState === 2) burnoutMultiplier = 0.6; // Burnout limits budget
  else if (burnoutState?.currentState === 1) burnoutMultiplier = 0.8; // Declining limits budget
  
  const budgetMins = (settings.dailyTargetHours || 8) * 60 * 0.7 * burnoutMultiplier; // 70% of day for new chapters
  const allocated = knapsackAllocate(frontier, chapters, budgetMins);

  return allocated.slice(0, n);
}

// ─── Daily plan generation (for Planner Smart Suggestions) ──────────────────
export function generateDailyPlan(chapters, chapterDefs, sessions, settings, studyDebt = 0, burnoutState = null, decayAlerts = []) {
  const completedIds = Object.entries(chapters)
    .filter(([, state]) => state.done)
    .map(([id]) => id);

  let frontier = getKSTFrontier(completedIds, chapterDefs);
  
  const hasFadingT1 = decayAlerts.some(a => a.tier === 'T1' && a.status === 'fading');
  if (hasFadingT1) {
    frontier = frontier.filter(c => c.tier !== 'T3');
  }
  
  // Expand budget by up to 20% if study debt exists (capped at 4h debt)
  const debtBonus = Math.min(0.20, (studyDebt / 4) * 0.20);
  
  let burnoutMultiplier = 1.0;
  if (burnoutState?.currentState === 2) burnoutMultiplier = 0.6;
  else if (burnoutState?.currentState === 1) burnoutMultiplier = 0.8;
  
  const budgetMins = (settings.dailyTargetHours || 8) * 60 * (1 + debtBonus) * burnoutMultiplier;
  const allocated = knapsackAllocate(frontier, chapters, budgetMins * 0.65);

  // Add review tasks for fading chapters
  const fadingIds = Object.entries(chapters)
    .filter(([id, state]) => {
      if (!state.done) return false;
      const daysSince = (Date.now() - (state.doneAt || 0)) / 86400000;
      const interval = (state.confidence || 2) * 7;
      return daysSince > interval * 0.8;
    })
    .map(([id]) => id)
    .slice(0, 3);

  const reviewTasks = fadingIds.map(id => {
    const def = chapterDefs.find(c => c.id === id);
    return { ...def, allocatedMinutes: 30, isReview: true };
  });

  return [...reviewTasks, ...allocated.slice(0, 4)];
}

export const schedulerEngine = {
  getTopChapters,
  getKSTFrontier,
  knapsackAllocate,
  generateDailyPlan,
  getTopologicalOrder,
};

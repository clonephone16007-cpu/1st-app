// ─── Chemistry Formula Cards ──────────────────────────────────────────────────
// Format: { id, chapterId, subject, category, front, back, tags[] }

export const chemistryFormulaCards = [
  {
    id: 'f_c001', chapterId: 'c06', subject: 'Chemistry', category: 'Thermodynamics',
    front: 'Gibbs Free Energy',
    back: '$$\\Delta G = \\Delta H - T\\Delta S$$\nSpontaneous if $\\Delta G < 0$\nAt equilibrium: $\\Delta G = 0$, so $T = \\frac{\\Delta H}{\\Delta S}$\n$\\Delta G^\\circ = -RT\\ln K$',
    tags: ['thermodynamics', 'gibbs', 'T1'],
  },
  {
    id: 'f_c002', chapterId: 'c11', subject: 'Chemistry', category: 'Electrochemistry',
    front: 'Nernst Equation',
    back: '$$E_{cell} = E^\\circ_{cell} - \\frac{RT}{nF}\\ln Q$$\nAt 25°C: $E = E^\\circ - \\frac{0.0591}{n}\\log Q$\nAt equilibrium: $E = 0$, $\\log K = \\frac{nE^\\circ}{0.0591}$',
    tags: ['electrochemistry', 'nernst', 'T1'],
  },
  {
    id: 'f_c003', chapterId: 'c12', subject: 'Chemistry', category: 'Chemical Kinetics',
    front: 'First Order Rate Equation',
    back: '$$k = \\frac{2.303}{t}\\log\\frac{[A]_0}{[A]_t}$$\nHalf-life: $t_{1/2} = \\frac{0.693}{k}$ (independent of $[A]_0$)\nArrhenius: $k = Ae^{-E_a/RT}$',
    tags: ['kinetics', 'first-order', 'T1'],
  },
  {
    id: 'f_c004', chapterId: 'c10', subject: 'Chemistry', category: 'Solutions',
    front: 'Colligative Properties — Boiling Point Elevation',
    back: '$$\\Delta T_b = K_b \\cdot m \\cdot i$$\nwhere $m$ = molality, $i$ = van\'t Hoff factor\nFreezing point depression: $\\Delta T_f = K_f \\cdot m \\cdot i$\nOsmotic pressure: $\\pi = iCRT$',
    tags: ['solutions', 'colligative', 'T1'],
  },
  {
    id: 'f_c005', chapterId: 'c19', subject: 'Chemistry', category: 'Coordination Compounds',
    front: 'Crystal Field Splitting Energy (Δ)',
    back: 'Octahedral: $t_{2g}$ (lower) and $e_g$ (higher)\n$$\\Delta_o > \\Delta_t$$\n$\\Delta_t = \\frac{4}{9}\\Delta_o$\nCFSE = (-0.4$n_{t_{2g}}$ + 0.6$n_{e_g}$)$\\Delta_o$ + pairing energy\nSpectrochemical series: $I^- < Br^- < Cl^- < F^- < OH^- < H_2O < NH_3 < en < CN^- < CO$',
    tags: ['coordination', 'CFT', 'T1'],
  },
];

// ─── Physics Formula Cards ────────────────────────────────────────────────────
// Format: { id, chapterId, subject, category, front, back, tags[] }

export const physicsFormulaCards = [
  {
    id: 'f_p001', chapterId: 'p18', subject: 'Physics', category: 'Current Electricity',
    front: "Kirchhoff's Voltage Law (KVL)",
    back: '$$\\sum V = 0 \\text{ (around any closed loop)}$$\nSign convention: voltage rises are positive, drops are negative. Apply systematically around each loop.',
    tags: ['KVL', 'circuit', 'T1'],
  },
  {
    id: 'f_p002', chapterId: 'p07', subject: 'Physics', category: 'Rotational Motion',
    front: 'Moment of Inertia — Solid Sphere',
    back: '$$I = \\frac{2}{5}MR^2 \\text{ (about diameter)}$$\nParallel axis: $I = I_{cm} + Md^2$\nPerpendicular axis (planar): $I_z = I_x + I_y$',
    tags: ['MOI', 'rotation', 'T1'],
  },
  {
    id: 'f_p003', chapterId: 'p08', subject: 'Physics', category: 'Gravitation',
    front: 'Escape velocity from Earth',
    back: '$$v_e = \\sqrt{\\frac{2GM}{R}} = \\sqrt{2gR} \\approx 11.2 \\text{ km/s}$$\nOrbital velocity: $v_o = \\sqrt{gR} = \\frac{v_e}{\\sqrt{2}}$',
    tags: ['gravitation', 'velocity', 'T1'],
  },
  {
    id: 'f_p004', chapterId: 'p24', subject: 'Physics', category: 'Ray Optics',
    front: 'Lens Maker\'s Equation',
    back: '$$\\frac{1}{f} = (n-1)\\left(\\frac{1}{R_1} - \\frac{1}{R_2}\\right)$$\nThin lens formula: $\\frac{1}{v} - \\frac{1}{u} = \\frac{1}{f}$\nPower: $P = \\frac{1}{f}$ (in metres) diopters',
    tags: ['optics', 'lens', 'T1'],
  },
  {
    id: 'f_p005', chapterId: 'p26', subject: 'Physics', category: 'Modern Physics',
    front: 'Photoelectric Effect — Einstein\'s Equation',
    back: '$$KE_{max} = h\\nu - \\phi = eV_0$$\nThreshold: $\\nu_0 = \\frac{\\phi}{h}$\nde Broglie: $\\lambda = \\frac{h}{mv} = \\frac{h}{\\sqrt{2mKE}}$',
    tags: ['photoelectric', 'modern', 'T1'],
  },
];

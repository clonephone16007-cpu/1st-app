// ─── Math Formula Cards ───────────────────────────────────────────────────────
// Format: { id, chapterId, subject, category, front, back, tags[] }
// back: supports LaTeX — wrap inline with $...$ and block with $$...$$

export const mathFormulaCards = [
  {
    id: 'f_m001', chapterId: 'm07', subject: 'Math', category: 'Sequences & Series',
    front: 'Sum of n terms of an AP',
    back: '$$S_n = \\frac{n}{2}[2a + (n-1)d] = \\frac{n}{2}(a + l)$$\nwhere $a$ = first term, $d$ = common difference, $l$ = last term',
    tags: ['AP', 'formula', 'T1'],
  },
  {
    id: 'f_m002', chapterId: 'm07', subject: 'Math', category: 'Sequences & Series',
    front: 'Sum of infinite GP',
    back: '$$S_\\infty = \\frac{a}{1-r}, \\quad |r| < 1$$\nwhere $a$ = first term, $r$ = common ratio',
    tags: ['GP', 'formula', 'T1'],
  },
  {
    id: 'f_m003', chapterId: 'm09', subject: 'Math', category: 'Binomial Theorem',
    front: 'General term of $(a+b)^n$',
    back: '$$T_{r+1} = \\binom{n}{r} a^{n-r} b^r$$\nMiddle term: $T_{(n/2)+1}$ if $n$ even; $T_{(n+1)/2}$ and $T_{(n+3)/2}$ if $n$ odd',
    tags: ['binomial', 'formula', 'T1'],
  },
  {
    id: 'f_m004', chapterId: 'm22', subject: 'Math', category: 'Limits',
    front: 'Standard limit: $\\lim_{x \\to 0} \\frac{\\sin x}{x}$',
    back: '$$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$\nAlso: $\\lim_{x \\to 0} \\frac{\\tan x}{x} = 1$, $\\lim_{x \\to 0} \\frac{e^x - 1}{x} = 1$',
    tags: ['limits', 'standard', 'T1'],
  },
  {
    id: 'f_m005', chapterId: 'm26', subject: 'Math', category: 'Definite Integration',
    front: "King Property of Definite Integration",
    back: '$$\\int_a^b f(x)\\,dx = \\int_a^b f(a+b-x)\\,dx$$\nUseful when $f(x) + f(a+b-x) = k$ (constant)',
    tags: ['integration', 'property', 'T1'],
  },
  {
    id: 'f_m006', chapterId: 'm05', subject: 'Math', category: 'Complex Numbers',
    front: "De Moivre's Theorem",
    back: '$$(\\cos\\theta + i\\sin\\theta)^n = \\cos n\\theta + i\\sin n\\theta$$\nCube roots of unity: $1, \\omega, \\omega^2$ where $\\omega = e^{2\\pi i/3}$',
    tags: ['complex', 'formula', 'T1'],
  },
  {
    id: 'f_m007', chapterId: 'm30', subject: 'Math', category: '3D Geometry',
    front: 'Shortest distance between two skew lines',
    back: '$$d = \\frac{|(\\vec{a_2}-\\vec{a_1}) \\cdot (\\vec{b_1} \\times \\vec{b_2})|}{|\\vec{b_1} \\times \\vec{b_2}|}$$\nLines: $\\vec{r} = \\vec{a_1} + \\lambda\\vec{b_1}$ and $\\vec{r} = \\vec{a_2} + \\mu\\vec{b_2}$',
    tags: ['3D', 'vectors', 'T1'],
  },
  {
    id: 'f_m008', chapterId: 'm31', subject: 'Math', category: 'Probability',
    front: "Bayes' Theorem",
    back: '$$P(A_i|B) = \\frac{P(B|A_i) \\cdot P(A_i)}{\\sum_{j} P(B|A_j) \\cdot P(A_j)}$$',
    tags: ['probability', 'theorem', 'T1'],
  },
];

export const exams = [
  {
    id: 'jee',
    name: 'JEE Main',
    date: '2026-04-02',
    totalMarks: 300,
    totalQuestions: 75,
    color: '#D4870A',
    marking: { mcq: +4, wrong: -1, nat: +4, natWrong: 0 },
    subjects: { Math: 100, Physics: 100, Chemistry: 100 },
    note: 'Section B (integer type) has no negative marking — always attempt all 5 even if unsure'
  },
  {
    id: 'cet',
    name: 'MHT-CET',
    date: '2026-04-11',
    totalMarks: 200,
    totalQuestions: 150,
    color: '#2471A3',
    marking: { math: +2, pc: +1, wrong: 0 },
    subjects: { Math: 100, Physics: 50, Chemistry: 50 },
    noNegative: true,
    note: 'Attempt all 150 questions — zero negative marking'
  },
  {
    id: 'met',
    name: 'MET Manipal',
    date: '2026-04-13',
    totalMarks: 240,
    totalQuestions: 60,
    color: '#7D3C98',
    marking: { mcq: +4, mcqWrong: -1, nat: +4, natWrong: 0 },
    subjects: { Math: 80, Physics: 60, Chemistry: 60, English: 40 },
    note: 'Cannot revisit previous section during exam'
  },
  {
    id: 'ugee',
    name: 'UGEE IIIT-H',
    date: '2026-05-02',
    totalMarks: 150,
    totalQuestions: 100,
    color: '#1E8449',
    marking: {
      supr: { correct: +1, wrong: -0.25 },
      reap: { correct: +2, wrong: -0.5 }
    },
    sections: {
      SUPR: { questions: 50, marks: 50, duration: '60 min' },
      REAP: { questions: 50, marks: 100, duration: '120 min' }
    },
    note: 'SUPR shortlists you. REAP decides your rank. Interview is mandatory.'
  }
];

/**
 * Speaking mode catalogue. This is product configuration rather than demo
 * data: the modes, objectives and feedback styles are part of the spec. The
 * session history below is DEMO DATA until M7.
 */

export type SpeakingModeId =
  | 'guided'
  | 'free'
  | 'grammar'
  | 'roleplay'
  | 'picture'
  | 'storytelling'
  | 'interview'
  | 'rapid'
  | 'pronunciation'
  | 'opinion'
  | 'debate'
  | 'vocabulary'

export interface SpeakingMode {
  id: SpeakingModeId
  title: string
  tagline: string
  objectives: string[]
  minLevel: 'A1' | 'A2' | 'B1' | 'B2'
  typicalMinutes: number
}

export const SPEAKING_MODES: SpeakingMode[] = [
  { id: 'guided', title: 'Guided conversation', tagline: 'Structured questions on one topic, one at a time.', objectives: ['Answer in full sentences', 'Extend answers with because and but'], minLevel: 'A1', typicalMinutes: 10 },
  { id: 'free', title: 'Free conversation', tagline: 'Talk about anything. The coach follows your lead.', objectives: ['Sustain a natural exchange', 'Self-correct recurring mistakes'], minLevel: 'A2', typicalMinutes: 10 },
  { id: 'grammar', title: 'Grammar-focused speaking', tagline: 'Practise one grammar point out loud until it feels natural.', objectives: ['Produce the target structure accurately', 'Notice and fix errors'], minLevel: 'A1', typicalMinutes: 8 },
  { id: 'roleplay', title: 'Daily-life roleplay', tagline: 'Pharmacy, airport, job interview, apartment viewing.', objectives: ['Handle a real situation end to end', 'Use polite requests and clarifications'], minLevel: 'A1', typicalMinutes: 8 },
  { id: 'picture', title: 'Picture description', tagline: 'Describe a scene in detail.', objectives: ['Use there is / there are and prepositions', 'Speculate with might and could'], minLevel: 'A1', typicalMinutes: 6 },
  { id: 'storytelling', title: 'Storytelling', tagline: 'Tell a story with a beginning, middle and end.', objectives: ['Sequence events with past tenses', 'Use linking words'], minLevel: 'A2', typicalMinutes: 10 },
  { id: 'interview', title: 'Interview preparation', tagline: 'Common job and university interview questions.', objectives: ['Give structured answers', 'Talk about experience with Present Perfect'], minLevel: 'B1', typicalMinutes: 12 },
  { id: 'rapid', title: 'Rapid response', tagline: 'Quick questions, quick answers. Build automaticity.', objectives: ['Reduce hesitation', 'Answer within a few seconds'], minLevel: 'A1', typicalMinutes: 5 },
  { id: 'pronunciation', title: 'Pronunciation', tagline: 'Minimal pairs, stress and intonation drills.', objectives: ['Distinguish target sounds', 'Place word stress correctly'], minLevel: 'A1', typicalMinutes: 6 },
  { id: 'opinion', title: 'Opinion discussion', tagline: 'Share and justify opinions on everyday topics.', objectives: ['Use opinion phrases', 'Agree and disagree politely'], minLevel: 'A2', typicalMinutes: 10 },
  { id: 'debate', title: 'Debate', tagline: 'Argue a position and respond to counter-arguments.', objectives: ['Structure an argument', 'Use advanced linking and hedging'], minLevel: 'B2', typicalMinutes: 15 },
  { id: 'vocabulary', title: 'Vocabulary in conversation', tagline: 'Use the words you are reviewing in real exchanges.', objectives: ['Activate recently learned words', 'Move words from recognition to use'], minLevel: 'A1', typicalMinutes: 8 },
]

export type FeedbackStyle = 'gentle' | 'detailed' | 'fluency' | 'grammar'

export const FEEDBACK_STYLES: { id: FeedbackStyle; title: string; description: string }[] = [
  { id: 'gentle', title: 'Gentle', description: 'Light-touch corrections, lots of encouragement.' },
  { id: 'detailed', title: 'Detailed corrections', description: 'Every error explained after each turn.' },
  { id: 'fluency', title: 'Fluency first', description: 'Keep talking; corrections summarised at the end.' },
  { id: 'grammar', title: 'Grammar focus', description: 'Corrections prioritise the current grammar target.' },
]

export interface DemoSpeakingSession {
  id: string
  mode: SpeakingModeId
  title: string
  startedAt: string
  durationMinutes: number
  turns: number
  /** Subjective coach estimate, clearly labelled as such in the UI. */
  coachNote: string
}

/** DEMO DATA (M1). */
export const DEMO_SPEAKING_SESSIONS: DemoSpeakingSession[] = [
  { id: 's1', mode: 'roleplay', title: 'At the pharmacy', startedAt: '2026-11-03T08:40:00Z', durationMinutes: 9, turns: 14, coachNote: 'Good polite requests; articles dropped in three sentences.' },
  { id: 's2', mode: 'storytelling', title: 'A strange evening', startedAt: '2026-11-01T19:05:00Z', durationMinutes: 11, turns: 12, coachNote: 'Clear sequencing; mixed Past Simple with Past Continuous twice.' },
  { id: 's3', mode: 'rapid', title: 'Daily routines', startedAt: '2026-10-31T07:30:00Z', durationMinutes: 5, turns: 20, coachNote: 'Hesitation reduced compared with last week.' },
]

export function findSpeakingMode(id: string): SpeakingMode | undefined {
  return SPEAKING_MODES.find((mode) => mode.id === id)
}

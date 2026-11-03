/**
 * DEMO DATA (M1). Vocabulary workspace shells. Real vocabulary banks and the
 * spaced-repetition scheduler arrive in M4.
 */

export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase' | 'preposition'

export type VocabStage = 'new' | 'learning' | 'reviewing' | 'mastered'

export interface DemoVocabItem {
  id: string
  term: string
  partOfSpeech: PartOfSpeech
  definition: string
  example: string
  azTranslation: string
  topic: string
  stage: VocabStage
  dueAt: string | null
  /** Recognition accuracy across reviews, 0-100. */
  recognition: number
  /** Active-recall accuracy across reviews, 0-100. */
  recall: number
}

export const DEMO_VOCAB: DemoVocabItem[] = [
  { id: 'v1', term: 'interrupt', partOfSpeech: 'verb', definition: 'to stop someone while they are speaking or doing something', example: 'Sorry to interrupt, but the taxi is here.', azTranslation: 'sözünü kəsmək', topic: 'Conversation', stage: 'reviewing', dueAt: '2026-11-03T06:00:00Z', recognition: 90, recall: 60 },
  { id: 'v2', term: 'appointment', partOfSpeech: 'noun', definition: 'an arranged meeting at a specific time', example: 'I have a dentist appointment at four.', azTranslation: 'görüş, qəbul', topic: 'Daily life', stage: 'reviewing', dueAt: '2026-11-03T06:00:00Z', recognition: 95, recall: 80 },
  { id: 'v3', term: 'run out of', partOfSpeech: 'phrase', definition: 'to have no more of something', example: 'We ran out of milk this morning.', azTranslation: 'tükənmək, qurtarmaq', topic: 'Phrasal verbs', stage: 'learning', dueAt: '2026-11-03T06:00:00Z', recognition: 70, recall: 40 },
  { id: 'v4', term: 'nevertheless', partOfSpeech: 'adverb', definition: 'despite what has just been said', example: 'It was raining; nevertheless, we went out.', azTranslation: 'buna baxmayaraq', topic: 'Linking words', stage: 'new', dueAt: null, recognition: 0, recall: 0 },
  { id: 'v5', term: 'reliable', partOfSpeech: 'adjective', definition: 'able to be trusted to do what is expected', example: 'She is a reliable colleague.', azTranslation: 'etibarlı', topic: 'Describing people', stage: 'mastered', dueAt: '2026-11-20T06:00:00Z', recognition: 100, recall: 95 },
  { id: 'v6', term: 'during', partOfSpeech: 'preposition', definition: 'throughout a period of time', example: 'Phones must be off during the exam.', azTranslation: 'ərzində, zamanı', topic: 'Time', stage: 'reviewing', dueAt: '2026-11-04T06:00:00Z', recognition: 85, recall: 75 },
  { id: 'v7', term: 'look forward to', partOfSpeech: 'phrase', definition: 'to feel pleased about something that is going to happen', example: 'I look forward to meeting you.', azTranslation: 'səbirsizliklə gözləmək', topic: 'Phrasal verbs', stage: 'learning', dueAt: '2026-11-03T06:00:00Z', recognition: 80, recall: 50 },
  { id: 'v8', term: 'pharmacy', partOfSpeech: 'noun', definition: 'a shop where medicines are sold', example: 'Is there a pharmacy near here?', azTranslation: 'aptek', topic: 'Daily life', stage: 'mastered', dueAt: '2026-11-18T06:00:00Z', recognition: 100, recall: 100 },
]

export interface VocabTopicSummary {
  topic: string
  total: number
  mastered: number
}

export const DEMO_VOCAB_TOPICS: VocabTopicSummary[] = [
  { topic: 'Daily life', total: 84, mastered: 61 },
  { topic: 'Phrasal verbs', total: 46, mastered: 12 },
  { topic: 'Describing people', total: 38, mastered: 25 },
  { topic: 'Conversation', total: 52, mastered: 30 },
  { topic: 'Linking words', total: 24, mastered: 6 },
  { topic: 'Time', total: 30, mastered: 22 },
]

export const VOCAB_PRACTICE_MODES = [
  { id: 'flashcards', title: 'Flashcards', description: 'Recognise the meaning, then flip to check.' },
  { id: 'recall', title: 'Active recall', description: 'Type the word from its definition.' },
  { id: 'listening', title: 'Listen and pick', description: 'Hear the word and choose the meaning.' },
  { id: 'sentence', title: 'Use it in a sentence', description: 'Write or say a sentence with the word.' },
  { id: 'spoken', title: 'Say it', description: 'Answer out loud and get pronunciation feedback.' },
  { id: 'context', title: 'In context', description: 'Choose the word that fits the sentence.' },
] as const

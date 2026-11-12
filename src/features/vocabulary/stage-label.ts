import type { VocabularyStage } from './ports'

export function stageLabel(stage: VocabularyStage): string {
  switch (stage) {
    case 'new':
      return 'New'
    case 'learning':
      return 'Learning'
    case 'review':
      return 'Review'
    case 'mastered':
      return 'Mastered'
  }
}

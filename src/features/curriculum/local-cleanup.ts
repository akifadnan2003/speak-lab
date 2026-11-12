import { registerLocalDataCleaner } from '@/lib/local-data'
import { clearStoredProgress } from './persistence/local-storage'

/**
 * Hooks the curriculum's device-local progress store into the M2 local-data hygiene system:
 * sign-out, the SIGNED_OUT event and a different account signing in on the same device all
 * call `clearLocalStudentData()`, which runs every registered cleaner. Imported once by `App`.
 */
export const unregisterCurriculumCleanup: () => void = registerLocalDataCleaner(() => clearStoredProgress())

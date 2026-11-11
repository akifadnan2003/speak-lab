import { CloudUpload } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useLocalVocabularyImport } from '../VocabularyProvider'

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * Asks before uploading vocabulary practice that an older version of the app kept only on this
 * device. Renders nothing unless there is something uploadable for the signed-in account.
 */
export function LocalImportCard({ studentId }: { studentId: string }) {
  const { plan, upload, discard } = useLocalVocabularyImport(studentId)
  const [dismissed, setDismissed] = useState(false)

  if (upload.isSuccess) {
    const s = upload.data.statuses
    const added = (s.applied ?? 0) + (s.duplicate ?? 0)
    return (
      <Card data-testid="vocab-import-done" role="status">
        <CardContent className="text-sm">
          Uploaded. {plural(added, 'answer')} added to your progress
          {(s.recorded ?? 0) > 0 ? `, ${plural(s.recorded ?? 0, 'older answer')} kept as history only` : ''}
          {upload.data.rejected.length > 0 ? `, ${plural(upload.data.rejected.length, 'answer')} could not be used` : ''}. The copy on
          this device was removed.
        </CardContent>
      </Card>
    )
  }

  const p = plan.data
  if (!p || dismissed || discard.isSuccess) return null
  const count = (r: 'import' | 'merge' | 'server_newer') => p.entries.filter((e) => e.resolution === r).length

  return (
    <Card data-testid="vocab-import" className="border-warning/40 bg-warning-soft">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <CloudUpload className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm font-semibold">Practice saved only on this device</p>
            <p className="text-sm text-fg-muted">
              Before your vocabulary synced to your account, this device kept {plural(p.snapshot.reviews.length, 'answer')} for{' '}
              {plural(p.entries.length, 'word')}. Do you want to add them to your account?
            </p>
            <ul className="list-disc pl-5 text-sm text-fg-muted" data-testid="vocab-import-plan">
              {count('import') > 0 && <li>{plural(count('import'), 'word')} will be added.</li>}
              {count('merge') > 0 && <li>{plural(count('merge'), 'word')} will get newer answers on top of your account’s progress.</li>}
              {count('server_newer') > 0 && (
                <li>{plural(count('server_newer'), 'word')} already have more recent progress in your account and stay as they are.</li>
              )}
              {p.statesWithoutReviews.length > 0 && (
                <li>{plural(p.statesWithoutReviews.length, 'word')} have no saved answers and cannot be uploaded.</li>
              )}
            </ul>
            <p className="text-xs text-fg-muted">Older answers never replace newer progress. Nothing is uploaded unless you choose to.</p>
          </div>
        </div>
        {upload.isError && (
          <p role="alert" className="text-sm text-danger">
            The upload did not finish. Nothing was deleted from this device; you can try again.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => upload.mutate()} disabled={upload.isPending || p.upload.length === 0} data-testid="vocab-import-confirm">
            {upload.isPending ? 'Uploading…' : 'Upload to my account'}
          </Button>
          <Button variant="outline" onClick={() => setDismissed(true)}>
            Not now
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" data-testid="vocab-import-discard">
                Delete from this device
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete the device copy?</DialogTitle>
                <DialogDescription>
                  The practice saved on this device will be removed without uploading it. Your account’s progress does not change.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Keep it</Button>
                </DialogClose>
                <Button variant="danger" onClick={() => discard.mutate()} data-testid="vocab-import-discard-confirm">
                  Delete device copy
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}

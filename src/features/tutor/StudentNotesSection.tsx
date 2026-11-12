import { Pencil, Plus, Search, StickyNote, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Textarea } from '@/components/ui/input'
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useTeacherNoteMutations, useTeacherNotes, WorkspaceError, type TeacherNote } from '@/features/assignments/api'
import type { TeacherNotePriority, TeacherNoteTopic } from '@/lib/supabase/database.types'
import { cn, formatRelative } from '@/lib/utils'

/**
 * Private teaching notes about one linked student. Stored in `teacher_notes`, which has no
 * student-facing policy: the student can never read them, through the app or the API.
 * Text is rendered as text (React escapes it); nothing is interpreted as markup.
 */
const NOTE_TOPICS: readonly TeacherNoteTopic[] = ['general', 'grammar', 'vocabulary', 'pronunciation', 'speaking', 'listening', 'reading', 'writing', 'behaviour', 'planning']
const TOPIC_LABEL: Record<TeacherNoteTopic, string> = {
  general: 'General',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  pronunciation: 'Pronunciation',
  speaking: 'Speaking',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  behaviour: 'Engagement',
  planning: 'Next lesson',
}

export function StudentNotesSection({ studentId, tutorId }: { studentId: string; tutorId: string }) {
  const notes = useTeacherNotes(studentId)
  const mutations = useTeacherNoteMutations(tutorId, studentId)
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState<TeacherNoteTopic | 'all'>('all')
  const [editing, setEditing] = useState<TeacherNote | 'new' | null>(null)
  const [deleting, setDeleting] = useState<TeacherNote | null>(null)

  if (notes.isError) return <EmptyState compact title="Notes could not be loaded" description={notes.error instanceof Error ? notes.error.message : 'Try again.'} />

  const q = query.trim().toLowerCase()
  const shown = (notes.data ?? []).filter((n) => (topic === 'all' || n.topic === topic) && (q.length === 0 || n.body.toLowerCase().includes(q)))

  return (
    <div className="flex flex-col gap-4" data-testid="student-notes">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" className="pl-9" aria-label="Search notes" data-testid="notes-search" />
        </label>
        <select aria-label="Filter by topic" value={topic} onChange={(e) => setTopic(e.target.value as TeacherNoteTopic | 'all')} className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-base sm:h-10 sm:text-sm" data-testid="notes-topic-filter">
          <option value="all">All topics</option>
          {NOTE_TOPICS.map((t) => (
            <option key={t} value={t}>
              {TOPIC_LABEL[t]}
            </option>
          ))}
        </select>
        <Button onClick={() => setEditing('new')} data-testid="new-note">
          <Plus aria-hidden /> New note
        </Button>
      </div>
      <p className="text-xs text-fg-muted">Private to you. The student cannot see these notes.</p>

      {notes.isPending ? (
        <Skeleton className="h-32" />
      ) : shown.length === 0 ? (
        <EmptyState icon={StickyNote} compact title={notes.data && notes.data.length > 0 ? 'No notes match' : 'No notes yet'} description={notes.data && notes.data.length > 0 ? 'Try another search or topic.' : 'Keep observations, reminders and plans for the next lesson here.'} />
      ) : (
        <ol className="flex flex-col gap-2" aria-label="Notes, newest first">
          {shown.map((note) => (
            <li key={note.id}>
              <Card className={cn(note.priority === 'high' && 'border-warning/60')} data-testid="note" data-topic={note.topic} data-priority={note.priority}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{TOPIC_LABEL[note.topic]}</Badge>
                    {note.priority === 'high' ? <Badge variant="warning">Priority</Badge> : null}
                    <time dateTime={note.createdAt} className="text-xs text-fg-subtle">
                      {new Date(note.createdAt).toLocaleString()}
                      {note.updatedAt !== note.createdAt ? ` · edited ${formatRelative(note.updatedAt)}` : ''}
                    </time>
                    <span className="ml-auto flex gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label="Edit note" onClick={() => setEditing(note)} data-testid="edit-note">
                        <Pencil aria-hidden />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Delete note" onClick={() => setDeleting(note)} data-testid="delete-note">
                        <Trash2 aria-hidden />
                      </Button>
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}

      {editing ? (
        <NoteDialog
          existing={editing === 'new' ? null : editing}
          busy={mutations.create.isPending || mutations.update.isPending}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            if (editing === 'new') await mutations.create.mutateAsync(values)
            else await mutations.update.mutateAsync({ id: editing.id, ...values })
          }}
        />
      ) : null}

      <Dialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this note?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          {deleting ? <p className="rounded-lg bg-surface-2 p-3 text-sm whitespace-pre-wrap">{deleting.body}</p> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Keep</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={mutations.remove.isPending}
              onClick={async () => {
                if (!deleting) return
                await mutations.remove.mutateAsync(deleting.id)
                setDeleting(null)
              }}
              data-testid="confirm-delete-note"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NoteDialog({ existing, busy, onClose, onSave }: { existing: TeacherNote | null; busy: boolean; onClose: () => void; onSave: (values: { body: string; topic: TeacherNoteTopic; priority: TeacherNotePriority }) => Promise<void> }) {
  const [body, setBody] = useState(existing?.body ?? '')
  const [topic, setTopic] = useState<TeacherNoteTopic>(existing?.topic ?? 'general')
  const [priority, setPriority] = useState<TeacherNotePriority>(existing?.priority ?? 'normal')
  const [error, setError] = useState<string | null>(null)
  const trimmed = body.trim()

  const save = async () => {
    if (trimmed.length === 0) {
      setError('Write the note first.')
      return
    }
    try {
      await onSave({ body: trimmed, topic, priority })
      onClose()
    } catch (e) {
      setError(e instanceof WorkspaceError ? e.message : 'Could not save the note.')
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit note' : 'New note'}</DialogTitle>
          <DialogDescription>Private to you.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <Label htmlFor="note-body">Note</Label>
            <Textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={4000} autoFocus aria-invalid={!!error} data-testid="note-body" />
            <FieldHint>{4000 - body.length} characters left</FieldHint>
            <FieldError>{error}</FieldError>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor="note-topic">Topic</Label>
              <select id="note-topic" value={topic} onChange={(e) => setTopic(e.target.value as TeacherNoteTopic)} className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-base sm:h-10 sm:text-sm" data-testid="note-topic">
                {NOTE_TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {TOPIC_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <Label htmlFor="note-priority">Priority</Label>
              <select id="note-priority" value={priority} onChange={(e) => setPriority(e.target.value as TeacherNotePriority)} className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-base sm:h-10 sm:text-sm" data-testid="note-priority">
                <option value="normal">Normal</option>
                <option value="high">High: review next lesson</option>
              </select>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={busy} data-testid="save-note">
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

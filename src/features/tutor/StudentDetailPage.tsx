import { ArrowLeft, Ban, CheckCircle2, ClipboardList, Clock, Mic, Plus, StickyNote } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DemoNotice } from '@/components/feedback/DemoNotice'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Textarea } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Stat } from '@/components/ui/stat'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEMO_CHAPTERS } from '@/demo/curriculum'
import { FEEDBACK_STYLES } from '@/demo/speaking'
import { LEARNING_STATUS_LABEL, findStudentProfile } from '@/demo/students'
import { ActivityList } from '@/features/progress/ActivityList'
import { formatMinutes, formatRelative } from '@/lib/utils'

const SECTIONS = [
  'overview',
  'curriculum',
  'grammar',
  'vocabulary',
  'speaking',
  'listening',
  'assignments',
  'notes',
  'history',
  'settings',
] as const
type Section = (typeof SECTIONS)[number]

const SECTION_LABEL: Record<Section, string> = {
  overview: 'Overview',
  curriculum: 'Curriculum',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  speaking: 'Speaking',
  listening: 'Listening',
  assignments: 'Assignments',
  notes: 'Teacher notes',
  history: 'History',
  settings: 'Settings',
}

function isSection(value: string | undefined): value is Section {
  return !!value && (SECTIONS as readonly string[]).includes(value)
}

export function StudentDetailPage() {
  const { studentId = '', section } = useParams()
  const navigate = useNavigate()
  const profile = findStudentProfile(studentId)
  const active: Section = isSection(section) ? section : 'overview'
  const [disabled, setDisabled] = useState(false)

  if (!profile) {
    return (
      <EmptyState
        title="Student not found"
        description="This learner is not assigned to you or does not exist."
        action={
          <Button asChild variant="outline">
            <Link to="/tutor">Back to My Students</Link>
          </Button>
        }
      />
    )
  }

  const { card } = profile

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/tutor">
          <ArrowLeft aria-hidden /> My Students
        </Link>
      </Button>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={card.fullName} size="xl" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{card.fullName}</h1>
            <p className="truncate text-sm text-fg-muted">{card.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="primary">{card.level}</Badge>
              <Badge variant={disabled ? 'danger' : 'success'}>{disabled ? 'Disabled' : LEARNING_STATUS_LABEL[card.status]}</Badge>
              <span className="text-xs text-fg-subtle">Last active {formatRelative(card.lastActiveAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <AssignHomeworkDialog />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant={disabled ? 'secondary' : 'outline'}>
                {disabled ? <CheckCircle2 aria-hidden /> : <Ban aria-hidden />}
                {disabled ? 'Reactivate' : 'Disable account'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{disabled ? 'Reactivate account?' : 'Disable account?'}</DialogTitle>
                <DialogDescription>
                  {disabled
                    ? 'The student will be able to sign in and continue learning.'
                    : 'The student will be signed out and cannot sign in until reactivated. Their data is kept.'}
                </DialogDescription>
              </DialogHeader>
              <DemoNotice>Preview only. Real account control is an M2 Edge Function.</DemoNotice>
              <DialogFooter>
                <Button variant={disabled ? 'primary' : 'danger'} onClick={() => setDisabled((d) => !d)}>
                  {disabled ? 'Reactivate' : 'Disable'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <Tabs value={active} onValueChange={(value) => navigate(`/tutor/students/${studentId}/${value}`, { replace: true })}>
        <TabsList aria-label="Student profile sections" className="w-full justify-start sm:w-auto">
          {SECTIONS.map((key) => (
            <TabsTrigger key={key} value={key}>
              {SECTION_LABEL[key]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Course progress" value={`${card.courseProgress}%`} hint={card.currentChapter} />
            <Stat label="Study time" value={formatMinutes(profile.totalPracticeMinutes)} hint={`${formatMinutes(profile.practiceMinutesLast7Days)} last 7 days`} icon={Clock} tone="primary" />
            <Stat label="Speaking" value={`${profile.speaking.sessions} sessions`} hint={`${profile.speaking.minutes} min total`} icon={Mic} tone="success" />
            <Stat label="Homework" value={`${profile.assignments.filter((a) => a.status === 'pending' || a.status === 'overdue').length} open`} icon={ClipboardList} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Learning objectives</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="flex flex-col gap-2 text-sm">
                  {profile.objectives.map((o) => (
                    <li key={o} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {o}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Recent performance by skill</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-0">
                {profile.skills.map((skill) => (
                  <div key={skill.key} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{skill.label}</span>
                      <span className="text-xs text-fg-muted tabular">{skill.mastery}%</span>
                    </div>
                    <Progress value={skill.mastery} size="sm" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="curriculum">
          <Card>
            <CardHeader>
              <CardTitle>Chapters</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-line pt-0">
              {DEMO_CHAPTERS.map((chapter) => (
                <div key={chapter.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {chapter.level} · {chapter.number}. {chapter.title}
                    </p>
                    <p className="text-xs text-fg-muted">
                      {chapter.lessons.filter((l) => l.status === 'completed').length}/{chapter.lessons.length} lessons ·{' '}
                      {chapter.lessons.filter((l) => l.status === 'skipped').length} skipped
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={chapter.status === 'completed' ? 'success' : chapter.status === 'locked' ? 'outline' : 'primary'}>
                      {chapter.status.replace('_', ' ')}
                    </Badge>
                    <Button variant="outline" size="sm" disabled>
                      {chapter.status === 'locked' ? 'Unlock' : 'Skip'}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grammar">
          <Card>
            <CardHeader>
              <CardTitle>Mastery by topic</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead className="text-left text-xs text-fg-muted">
                    <tr className="border-b border-line">
                      <th className="py-2 pr-3 font-medium">Topic</th>
                      <th className="py-2 pr-3 font-medium">Accuracy</th>
                      <th className="py-2 pr-3 font-medium">Attempts</th>
                      <th className="py-2 pr-3 font-medium">Last practised</th>
                      <th className="py-2 font-medium">Recurring error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {profile.grammarTopics.map((topic) => (
                      <tr key={topic.id}>
                        <td className="py-2.5 pr-3 font-medium">{topic.title}</td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <Progress value={topic.accuracy} size="sm" className="w-20" indicatorClassName={topic.accuracy < 70 ? 'bg-warning' : undefined} />
                            <span className="tabular">{topic.accuracy}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 tabular">{topic.attempts}</td>
                        <td className="py-2.5 pr-3 text-fg-muted">{formatRelative(topic.lastPractisedAt)}</td>
                        <td className="py-2.5 text-fg-muted">{topic.recurringError ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vocabulary" className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Learned" value={profile.vocabulary.learned} />
            <Stat label="Due" value={profile.vocabulary.due} tone="primary" />
            <Stat label="Retention" value={`${profile.vocabulary.retention}%`} tone="success" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Difficult words</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-0">
              {profile.vocabulary.difficult.map((word) => (
                <Badge key={word} variant="warning">
                  {word}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="speaking" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Sessions" value={profile.speaking.sessions} icon={Mic} tone="success" />
            <Stat label="Practice time" value={formatMinutes(profile.speaking.minutes)} icon={Clock} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Recurring difficulties</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm">
                {profile.speaking.recurringDifficulties.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-fg-muted">
                Recordings are reviewable here only when the student has granted permission (M7).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listening">
          <Card>
            <CardHeader>
              <CardTitle>Completed listening activities</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-line pt-0">
              {profile.listening.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 text-sm">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-fg-muted">{formatRelative(item.completedAt)}</p>
                  </div>
                  <Badge variant={item.score >= 80 ? 'success' : 'warning'}>{item.score}%</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle>Assignments</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-line pt-0">
              {profile.assignments.map((a) => (
                <div key={a.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-fg-muted">
                      {a.kind} · due {new Date(a.dueAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={a.status === 'overdue' ? 'danger' : a.status === 'reviewed' ? 'success' : a.status === 'submitted' ? 'info' : 'neutral'}>
                    {a.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Add a private note</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <Textarea placeholder="Visible only to you" aria-label="New teacher note" />
              <div className="flex items-center justify-between gap-2">
                <DemoNotice>Notes persist from M6.</DemoNotice>
                <Button size="sm" disabled>
                  <StickyNote aria-hidden /> Save note
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Previous notes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-line pt-0">
              {profile.notes.map((note) => (
                <div key={note.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm">{note.body}</p>
                  <p className="mt-1 text-xs text-fg-subtle">{formatRelative(note.createdAt)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent>
              <ActivityList items={profile.history} timeline />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Learner settings</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pt-0">
              <Field>
                <Label htmlFor="level-override">Level override</Label>
                <Select defaultValue={profile.settings.levelOverride ?? 'auto'}>
                  <SelectTrigger id="level-override" className="sm:max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automatic (from placement)</SelectItem>
                    {['A0', 'A1', 'A2', 'B1', 'B2', 'C1'].map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="support-lang">Azerbaijani support</Label>
                  <p className="text-xs text-fg-muted">Allow explanations in Azerbaijani (can be disabled during assessments).</p>
                </div>
                <Switch id="support-lang" defaultChecked={profile.settings.supportLanguage === 'az'} />
              </div>
              <Field>
                <Label htmlFor="feedback-style">Default feedback style</Label>
                <Select defaultValue={profile.settings.feedbackStyle}>
                  <SelectTrigger id="feedback-style" className="sm:max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEEDBACK_STYLES.map((style) => (
                      <SelectItem key={style.id} value={style.id}>
                        {style.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <Label htmlFor="ai-minutes">AI practice limit (minutes per day)</Label>
                <Input id="ai-minutes" type="number" inputMode="numeric" min={0} max={180} defaultValue={profile.settings.aiDailyMinutes} className="sm:max-w-xs" />
              </Field>
              <div className="flex items-center justify-between gap-2">
                <DemoNotice>Settings persist from M6.</DemoNotice>
                <Button disabled>Save settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AssignHomeworkDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden /> Assign homework
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign homework</DialogTitle>
          <DialogDescription>Give the student a task with a due date. They see it on their home screen.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <Label htmlFor="hw-title">Title</Label>
            <Input id="hw-title" placeholder="Record a 2-minute story" />
          </Field>
          <Field>
            <Label htmlFor="hw-kind">Type</Label>
            <Select defaultValue="speaking">
              <SelectTrigger id="hw-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="speaking">Speaking</SelectItem>
                <SelectItem value="writing">Writing</SelectItem>
                <SelectItem value="exercise">Exercise set</SelectItem>
                <SelectItem value="reading">Reading</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <Label htmlFor="hw-due">Due date</Label>
            <Input id="hw-due" type="date" />
          </Field>
          <Field>
            <Label htmlFor="hw-desc">Instructions</Label>
            <Textarea id="hw-desc" placeholder="What should the student do?" />
          </Field>
          <DemoNotice>Assignments are saved from M6.</DemoNotice>
        </div>
        <DialogFooter>
          <Button disabled>Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

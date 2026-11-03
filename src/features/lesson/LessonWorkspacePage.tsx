import { ArrowLeft, ArrowRight, BookOpen, Languages, Lightbulb } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { DemoNotice } from '@/components/feedback/DemoNotice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { findLesson, LESSON_KIND_LABEL } from '@/demo/curriculum'
import { cn } from '@/lib/utils'

/**
 * Lesson workspace shell. In M3 the right-hand panel becomes the exercise
 * renderer driven by versioned content. The sample exercise below is a static
 * multiple-choice preview that exercises the layout, keyboard navigation and
 * the explanation dialog; it stores nothing.
 */
const SAMPLE_QUESTION = {
  prompt: 'I ___ dinner when the phone rang.',
  options: ['cooked', 'was cooking', 'am cooking', 'cook'],
  correct: 1,
  explanation:
    'The phone ringing interrupted an action in progress, so the longer background action takes the Past Continuous: was cooking.',
  azExplanation:
    'Telefon zəng çalanda yemək bişirmək davam edirdi. Davam edən (fon) hərəkət üçün Past Continuous işlədilir: was cooking.',
}

export function LessonWorkspacePage() {
  const { chapterId = '', lessonId = '' } = useParams()
  const found = findLesson(chapterId, lessonId)
  const [selected, setSelected] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)

  if (!found) {
    return (
      <EmptyState
        title="Lesson not found"
        description="This lesson does not exist or is locked."
        action={
          <Button asChild variant="outline">
            <Link to="/learn">Back to curriculum</Link>
          </Button>
        }
      />
    )
  }

  const { chapter, lesson } = found
  const index = chapter.lessons.findIndex((l) => l.id === lesson.id)
  const prev = index > 0 ? chapter.lessons[index - 1] : undefined
  const next = chapter.lessons[index + 1]
  const isCorrect = checked && selected === SAMPLE_QUESTION.correct

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/learn/${chapter.id}`}>
            <ArrowLeft aria-hidden /> Chapter {chapter.number}
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <span className="tabular">
            Lesson {index + 1} of {chapter.lessons.length}
          </span>
          <Progress value={((index + 1) / chapter.lessons.length) * 100} size="sm" className="w-24" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary">{LESSON_KIND_LABEL[lesson.kind]}</Badge>
          <Badge variant="neutral">{lesson.estimatedMinutes} min</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{lesson.title}</h1>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Explanation panel */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center gap-2">
            <BookOpen className="size-4 text-primary" aria-hidden />
            <CardTitle>Explanation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-3 text-sm leading-relaxed">
            <p>
              Use the <strong>Past Continuous</strong> (was / were + -ing) for an action that was in
              progress, and the <strong>Past Simple</strong> for the shorter action that interrupted
              it.
            </p>
            <ul className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
              <li>
                I <em>was cooking</em> when the phone <em>rang</em>.
              </li>
              <li>
                They <em>were walking</em> home while it <em>started</em> to rain.
              </li>
            </ul>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-fit">
                  <Languages aria-hidden /> Explain in Azerbaijani
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Azərbaycan dilində izah</DialogTitle>
                  <DialogDescription>
                    Keçmişdə davam edən hərəkət üçün Past Continuous, onu kəsən qısa hərəkət üçün Past
                    Simple işlədilir.
                  </DialogDescription>
                </DialogHeader>
                <p className="text-sm">
                  Məsələn: <em>I was cooking when the phone rang.</em> Burada &ldquo;was
                  cooking&rdquo; fon hərəkətdir, &ldquo;rang&rdquo; isə onu kəsən hadisədir.
                </p>
                <DemoNotice>Static sample. Azerbaijani support becomes dynamic in M8.</DemoNotice>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Exercise panel */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Practice</CardTitle>
            <DemoNotice>Sample exercise, not saved.</DemoNotice>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-3">
            <p className="text-base font-medium" id="sample-question">
              {SAMPLE_QUESTION.prompt}
            </p>
            <div role="radiogroup" aria-labelledby="sample-question" className="flex flex-col gap-2">
              {SAMPLE_QUESTION.options.map((option, i) => {
                const active = selected === i
                const showCorrect = checked && i === SAMPLE_QUESTION.correct
                const showWrong = checked && active && i !== SAMPLE_QUESTION.correct
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={checked}
                    onClick={() => setSelected(i)}
                    className={cn(
                      'flex min-h-12 items-center gap-3 rounded-lg border px-4 text-left text-sm transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      active && !checked && 'border-primary bg-primary-soft text-primary-soft-fg',
                      !active && !checked && 'border-line hover:border-line-strong hover:bg-surface-2',
                      showCorrect && 'border-success bg-success-soft text-success-soft-fg',
                      showWrong && 'border-danger bg-danger-soft text-danger-soft-fg',
                      checked && !showCorrect && !showWrong && 'border-line opacity-60',
                    )}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {option}
                  </button>
                )
              })}
            </div>

            {checked ? (
              <div
                role="status"
                className={cn(
                  'flex gap-3 rounded-lg p-3 text-sm',
                  isCorrect ? 'bg-success-soft text-success-soft-fg' : 'bg-warning-soft text-warning-soft-fg',
                )}
              >
                <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold">{isCorrect ? 'Correct!' : 'Not quite.'}</p>
                  <p>{SAMPLE_QUESTION.explanation}</p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {!checked ? (
                <Button onClick={() => setChecked(true)} disabled={selected === null}>
                  Check answer
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setChecked(false)
                    setSelected(null)
                  }}
                >
                  Try again
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <nav aria-label="Lesson navigation" className="flex items-center justify-between gap-3 border-t border-line pt-4">
        {prev ? (
          <Button asChild variant="ghost">
            <Link to={`/learn/${chapter.id}/lessons/${prev.id}`}>
              <ArrowLeft aria-hidden /> Previous
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next && next.status !== 'locked' ? (
          <Button asChild>
            <Link to={`/learn/${chapter.id}/lessons/${next.id}`}>
              Next lesson <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link to={`/learn/${chapter.id}`}>Back to chapter</Link>
          </Button>
        )}
      </nav>
    </div>
  )
}

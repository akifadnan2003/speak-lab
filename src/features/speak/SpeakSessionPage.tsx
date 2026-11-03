import { ArrowLeft, Keyboard, Languages, Mic, MicOff, Volume2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { DemoNotice } from '@/components/feedback/DemoNotice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FEEDBACK_STYLES, findSpeakingMode, type FeedbackStyle } from '@/demo/speaking'
import { cn } from '@/lib/utils'

interface Turn {
  id: string
  role: 'coach' | 'student'
  text: string
}

/**
 * Speaking workspace shell. Layout, microphone affordance, text fallback,
 * feedback-style selector and the Azerbaijani help action are real UI; the
 * transcript below is a static sample and nothing is recorded or sent.
 */
export function SpeakSessionPage() {
  const { modeId = '' } = useParams()
  const mode = findSpeakingMode(modeId)
  const [feedback, setFeedback] = useState<FeedbackStyle>('gentle')
  const [textMode, setTextMode] = useState(false)
  const [recording, setRecording] = useState(false)

  if (!mode) {
    return (
      <EmptyState
        title="Unknown practice mode"
        description="Choose a mode from the speaking page."
        action={
          <Button asChild variant="outline">
            <Link to="/speak">Back to Speak</Link>
          </Button>
        }
      />
    )
  }

  const sampleTurns: Turn[] = [
    { id: 't1', role: 'coach', text: 'Hi! Let us warm up. What did you do yesterday evening?' },
    { id: 't2', role: 'student', text: 'Yesterday evening I was cooking dinner and my friend called me.' },
    { id: 't3', role: 'coach', text: 'Nice use of the Past Continuous. What were you cooking, and what did your friend want?' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/speak">
            <ArrowLeft aria-hidden /> All modes
          </Link>
        </Button>
        <DemoNotice>Sample transcript. Nothing is recorded in M1.</DemoNotice>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">{mode.title}</Badge>
              <Badge variant="neutral">{mode.typicalMinutes} min</Badge>
            </div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{mode.tagline}</h1>
          </div>

          <Card className="flex flex-1 flex-col">
            <CardContent className="flex flex-1 flex-col gap-3 p-4" aria-live="polite">
              {sampleTurns.map((turn) => (
                <div
                  key={turn.id}
                  className={cn('flex max-w-[85%] flex-col gap-1', turn.role === 'student' ? 'self-end items-end' : 'self-start')}
                >
                  <span className="text-[11px] font-medium text-fg-subtle uppercase">
                    {turn.role === 'coach' ? 'Coach' : 'You'}
                  </span>
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      turn.role === 'student'
                        ? 'rounded-br-md bg-primary text-fg-on-primary'
                        : 'rounded-bl-md bg-surface-2 text-fg',
                    )}
                  >
                    {turn.text}
                  </div>
                  {turn.role === 'coach' ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
                      aria-label="Play audio"
                    >
                      <Volume2 className="size-3.5" aria-hidden /> Listen
                    </button>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Input dock */}
          <div className="sticky bottom-[calc(var(--bottomnav-height)+var(--safe-bottom)+0.5rem)] z-10 rounded-2xl border border-line bg-surface p-3 shadow-md lg:static">
            {textMode ? (
              <div className="flex flex-col gap-2">
                <Textarea placeholder="Type your answer in English" rows={2} aria-label="Your answer" className="min-h-16" />
                <div className="flex items-center justify-between gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setTextMode(false)}>
                    <Mic aria-hidden /> Use microphone
                  </Button>
                  <Button size="sm" disabled>
                    Send
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" size="icon" aria-label="Ask for help in Azerbaijani" title="Ask for help in Azerbaijani">
                  <Languages aria-hidden />
                </Button>
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    aria-pressed={recording}
                    aria-label={recording ? 'Stop recording' : 'Start recording'}
                    onClick={() => setRecording((r) => !r)}
                    className={cn(
                      'flex size-16 items-center justify-center rounded-full text-fg-on-primary shadow-md transition-[transform,background-color] active:scale-95',
                      'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring',
                      recording ? 'bg-danger animate-pulse' : 'bg-primary hover:bg-primary-hover',
                    )}
                  >
                    {recording ? <MicOff className="size-7" aria-hidden /> : <Mic className="size-7" aria-hidden />}
                  </button>
                  <span className="text-xs text-fg-muted" aria-live="polite">
                    {recording ? 'Listening (demo)' : 'Tap to speak'}
                  </span>
                </div>
                <Button variant="ghost" size="icon" aria-label="Type instead" title="Type instead" onClick={() => setTextMode(true)}>
                  <Keyboard aria-hidden />
                </Button>
              </div>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Objectives</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm">
                {mode.objectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Feedback style</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0">
              <Select value={feedback} onValueChange={(value) => setFeedback(value as FeedbackStyle)}>
                <SelectTrigger aria-label="Feedback style">
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
              <p className="text-xs text-fg-muted">{FEEDBACK_STYLES.find((s) => s.id === feedback)?.description}</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

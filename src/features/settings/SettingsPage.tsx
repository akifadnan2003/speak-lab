import { useState } from 'react'
import { DemoNotice } from '@/components/feedback/DemoNotice'
import { ThemeSegmentedControl } from '@/components/theme/ThemeToggle'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldHint, Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { FEEDBACK_STYLES } from '@/demo/speaking'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { usePwaInstall } from '@/app/pwa'

export function SettingsPage() {
  const user = useCurrentUser()
  const [azSupport, setAzSupport] = useState(true)
  const { canInstall, promptInstall, installed } = usePwaInstall()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Account" title="Settings" description="Profile, appearance and learning preferences." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your name is shown to your tutor.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            {user ? (
              <div className="flex items-center gap-3">
                <Avatar name={user.fullName} size="lg" />
                <div>
                  <p className="text-sm font-medium">{user.fullName}</p>
                  <p className="text-xs text-fg-muted">{user.email}</p>
                  <Badge variant="primary" className="mt-1 capitalize">
                    {user.role}
                  </Badge>
                </div>
              </div>
            ) : null}
            <Field>
              <Label htmlFor="full-name">Full name</Label>
              <Input id="full-name" defaultValue={user?.fullName ?? ''} autoComplete="name" />
            </Field>
            <div className="flex items-center justify-between gap-2">
              <DemoNotice>Profile saves from M2.</DemoNotice>
              <Button disabled>Save</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Theme is stored on this device.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            <ThemeSegmentedControl />
            <div className="flex items-center justify-between gap-4 rounded-lg border border-line p-3">
              <div>
                <p className="text-sm font-medium">Install SpeakLab</p>
                <p className="text-xs text-fg-muted">
                  {installed
                    ? 'Installed on this device.'
                    : canInstall
                      ? 'Add to your home screen for a full-screen experience.'
                      : 'Use your browser menu (Share > Add to Home Screen on iOS) to install.'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={promptInstall} disabled={!canInstall}>
                Install
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Learning preferences</CardTitle>
            <CardDescription>How the coach and lessons behave for you.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-5 pt-0 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-4 sm:col-span-2">
              <div>
                <Label htmlFor="az-support">Azerbaijani explanations</Label>
                <p className="text-xs text-fg-muted">Show grammar help and translations in Azerbaijani when you ask.</p>
              </div>
              <Switch id="az-support" checked={azSupport} onCheckedChange={setAzSupport} />
            </div>
            <Field>
              <Label htmlFor="feedback-pref">Coach feedback style</Label>
              <Select defaultValue="gentle">
                <SelectTrigger id="feedback-pref">
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
              <Label htmlFor="daily-target">Daily speaking target (minutes)</Label>
              <Input id="daily-target" type="number" inputMode="numeric" min={5} max={120} defaultValue={15} />
              <FieldHint>Short, daily speaking beats long, rare sessions.</FieldHint>
            </Field>
            <div className="flex items-center justify-between gap-2 sm:col-span-2">
              <DemoNotice>Preferences persist from M2.</DemoNotice>
              <Button disabled>Save preferences</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

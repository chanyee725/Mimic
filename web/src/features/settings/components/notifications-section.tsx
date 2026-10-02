import { SettingsGroup, SettingsSection } from "@/components/app/settings-section"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { SETTINGS } from "@/dummy/settings"

import { useDraft } from "../hooks/use-draft"
import { SaveBar } from "./save-bar"
import { SecretField } from "./secret-field"
import { SettingRow } from "./setting-row"

export function NotificationsSection() {
  const { draft, set, dirty, save, reset } = useDraft(SETTINGS.notifications)
  return (
    <SettingsGroup className="@container">
      <SettingsSection title="Slack">
        <SettingRow label="Incoming webhook" hint="알림을 받을 채널의 webhook URL" htmlFor="nt-hook">
          <SecretField
            id="nt-hook"
            secret={draft.slackWebhook}
            placeholder="https://hooks.slack.com/services/…"
            onChange={(s) => set("slackWebhook", s)}
          />
        </SettingRow>
        <SettingRow label="Test message">
          <Button variant="outline" size="sm" disabled={!draft.slackWebhook.set}>
            Send test
          </Button>
        </SettingRow>
      </SettingsSection>
      <SettingsSection title="Notify me when">
        {draft.events.map((e, i) => (
          <SettingRow key={e.key} label={e.label} htmlFor={`nt-${e.key}`}>
            <Switch
              id={`nt-${e.key}`}
              checked={e.on}
              disabled={!draft.slackWebhook.set}
              onCheckedChange={(on) =>
                set(
                  "events",
                  draft.events.map((x, j) => (j === i ? { ...x, on } : x)),
                )
              }
            />
          </SettingRow>
        ))}
        {!draft.slackWebhook.set && <p className="text-xs text-muted-foreground">Slack webhook 을 넣으면 알림을 켤 수 있습니다.</p>}
      </SettingsSection>
      <SaveBar dirty={dirty} onSave={save} onReset={reset} />
    </SettingsGroup>
  )
}

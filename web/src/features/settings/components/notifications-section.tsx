import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { SettingsGroup, SettingsSection } from "@/components/common/settings-section"
import { useTestConnection } from "@/api/settings"

import { useSettingsDraft } from "../hooks/use-draft"
import { SectionPending } from "./section-pending"
import { SaveBar } from "./save-bar"
import { SecretField, SecretHint } from "./secret-field"
import { SettingRow } from "./setting-row"

export function NotificationsSection() {
  const { query, server, draft, set, saveBar } = useSettingsDraft("notifications")
  if (!draft || !server) return <SectionPending query={query} />
  const hook = server.slackWebhook
  return (
    <SettingsGroup className="@container">
      <SettingsSection title="Slack">
        <SettingRow
          label="Incoming webhook"
          hint={<SecretHint name="slack_webhook" lead="알림을 받을 채널의 webhook URL" />}
          htmlFor="nt-hook"
        >
          <SecretField id="nt-hook" name="slack_webhook" secret={hook} placeholder="https://hooks.slack.com/services/…" />
        </SettingRow>
        <SettingRow label="Test message">
          <SendTest canTest={hook.set} />
        </SettingRow>
      </SettingsSection>
      <SettingsSection title="Notify me when">
        {draft.events.map((e, i) => (
          <SettingRow key={e.key} label={e.label} htmlFor={`nt-${e.key}`}>
            <Switch
              id={`nt-${e.key}`}
              checked={e.on}
              disabled={!hook.set}
              onCheckedChange={(on) =>
                set(
                  "events",
                  draft.events.map((x, j) => (j === i ? { ...x, on } : x)),
                )
              }
            />
          </SettingRow>
        ))}
        {!hook.set && <p className="text-xs text-muted-foreground">Slack webhook 을 넣으면 알림을 켤 수 있습니다.</p>}
      </SettingsSection>
      <SaveBar {...saveBar} />
    </SettingsGroup>
  )
}

/** Sends a test message to the Slack webhook. Slack has no stored state, so the answer shows only after a test */
function SendTest({ canTest }: { canTest: boolean }) {
  const test = useTestConnection()
  const ok = test.data?.state === "ok"
  const text = test.error ? test.error.message : test.data ? (ok ? "Sent" : (test.data.detail ?? "Failed")) : null

  return (
    <>
      {text && <span className={ok ? "text-xs text-muted-foreground" : "text-xs text-bad"}>{text}</span>}
      <Button variant="outline" size="sm" disabled={!canTest || test.isPending} onClick={() => test.mutate("slack")}>
        {test.isPending ? "Sending…" : "Send test"}
      </Button>
    </>
  )
}

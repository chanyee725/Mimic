import { Input } from "@/components/ui/input"
import { SettingsGroup, SettingsSection } from "@/components/common/settings-section"

import { useSettingsDraft } from "../hooks/use-draft"
import { ChoiceSelect } from "./choice-select"
import { SectionPending } from "./section-pending"
import { SaveBar } from "./save-bar"
import { SettingRow } from "./setting-row"

const TIMEZONES = ["Asia/Seoul", "UTC", "America/Los_Angeles", "Europe/Berlin"]

export function StationSection() {
  const { query, draft, set, saveBar } = useSettingsDraft("station")
  if (!draft) return <SectionPending query={query} />

  return (
    <SettingsGroup className="@container">
      <SettingsSection title="Station">
        <SettingRow label="Name" htmlFor="sn-name">
          <Input id="sn-name" className="h-8 text-[13px]" value={draft.name} onChange={(e) => set("name", e.target.value)} />
        </SettingRow>
        <SettingRow label="Station ID" hint="데이터 파일과 Job 에 붙는 ID 라 바꿀 수 없습니다">
          <span className="font-mono text-[13px] text-muted-foreground">{draft.id}</span>
        </SettingRow>
        <SettingRow label="Time zone" htmlFor="sn-tz">
          <ChoiceSelect
            id="sn-tz"
            value={draft.timezone}
            options={TIMEZONES.map((t) => ({ value: t, label: t }))}
            onChange={(v) => set("timezone", v)}
          />
        </SettingRow>
      </SettingsSection>
      <SaveBar {...saveBar} />
    </SettingsGroup>
  )
}

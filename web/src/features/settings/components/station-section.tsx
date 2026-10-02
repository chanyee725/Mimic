import { useState } from "react"
import { LuPlus, LuTrash2 } from "react-icons/lu"

import { SettingsGroup, SettingsSection } from "@/components/app/settings-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SETTINGS } from "@/dummy/settings"

import { useDraft } from "../hooks/use-draft"
import { ChoiceSelect } from "./choice-select"
import { SaveBar } from "./save-bar"
import { SettingRow } from "./setting-row"

const TIMEZONES = ["Asia/Seoul", "UTC", "America/Los_Angeles", "Europe/Berlin"]

export function StationSection() {
  const { draft, set, dirty, save, reset } = useDraft(SETTINGS.station)
  const [nextNo, setNextNo] = useState(draft.operators.length + 1)

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
      <SettingsSection title="Operators">
        <p className="text-xs text-muted-foreground">작업자는 가명 ID 로만 기록합니다. 실명이나 이메일은 저장하지 않습니다.</p>
        <ul className="divide-y rounded-md border">
          {draft.operators.map((op, i) => (
            <li key={op.id} className="flex items-center gap-3 px-3 py-1.5 text-[13px]">
              <span className="w-16 font-mono">{op.id}</span>
              <div className="w-36">
                <ChoiceSelect
                  value={op.role}
                  options={[
                    { value: "operator", label: "Operator" },
                    { value: "admin", label: "Admin" },
                  ]}
                  onChange={(role) =>
                    set(
                      "operators",
                      draft.operators.map((x, j) => (j === i ? { ...x, role } : x)),
                    )
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto text-muted-foreground hover:text-bad"
                aria-label={`Remove ${op.id}`}
                disabled={draft.operators.length === 1}
                onClick={() =>
                  set(
                    "operators",
                    draft.operators.filter((_, j) => j !== i),
                  )
                }
              >
                <LuTrash2 />
              </Button>
            </li>
          ))}
        </ul>
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              set("operators", [...draft.operators, { id: `OP-${String(nextNo).padStart(2, "0")}`, role: "operator" }])
              setNextNo((n) => n + 1)
            }}
          >
            <LuPlus />
            Add operator
          </Button>
        </div>
      </SettingsSection>
      <SaveBar dirty={dirty} onSave={save} onReset={reset} />
    </SettingsGroup>
  )
}

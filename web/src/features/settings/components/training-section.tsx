import { Input } from "@/components/ui/input"
import { SettingsGroup, SettingsSection } from "@/components/common/settings-section"
import { getSettings } from "@/api/settings"

import { useDraft } from "../hooks/use-draft"
import { ChoiceSelect } from "./choice-select"
import { SaveBar } from "./save-bar"
import { SettingRow } from "./setting-row"

export function TrainingSection() {
  const { draft, set, dirty, save, reset } = useDraft(getSettings().training)
  return (
    <SettingsGroup className="@container">
      <SettingsSection title="Training defaults">
        <SettingRow label="lerobot version" hint="학습 · 변환에 쓰는 lerobot commit. 바꾸면 이후 Job 부터 적용됩니다" htmlFor="tr-commit">
          <Input
            id="tr-commit"
            className="h-8 font-mono text-[13px]"
            value={draft.lerobotCommit}
            onChange={(e) => set("lerobotCommit", e.target.value)}
          />
        </SettingRow>
        <SettingRow label="Default compute" htmlFor="tr-compute">
          <ChoiceSelect
            id="tr-compute"
            value={draft.defaultCompute}
            options={[
              { value: "local", label: "Local GPU" },
              { value: "runpod", label: "RunPod" },
            ]}
            onChange={(v) => set("defaultCompute", v)}
          />
        </SettingRow>
        <SettingRow label="Save checkpoint every" htmlFor="tr-save">
          <Input
            id="tr-save"
            className="h-8 w-24 text-right text-[13px] tabular-nums"
            inputMode="numeric"
            value={draft.saveFreq}
            onChange={(e) => set("saveFreq", Number(e.target.value) || 0)}
          />
          <span className="text-xs text-muted-foreground">steps</span>
        </SettingRow>
      </SettingsSection>
      <SettingsSection title="Simulation">
        <SettingRow label="Isaac Sim GPU" hint="시뮬레이션 평가는 이 스테이션의 RTX GPU 에서만 돌립니다">
          <span className="text-[13px]">{draft.simGpu}</span>
        </SettingRow>
        <SettingRow
          label="Environments folder"
          hint="이 폴더 아래에 환경 폴더(env.yaml · scene.usd · success.py)를 넣으면 Simulation 에 등록됩니다"
          htmlFor="tr-envs"
        >
          <Input
            id="tr-envs"
            className="h-8 font-mono text-[13px]"
            value={draft.simEnvsPath}
            onChange={(e) => set("simEnvsPath", e.target.value)}
          />
        </SettingRow>
      </SettingsSection>
      <SaveBar dirty={dirty} onSave={save} onReset={reset} />
    </SettingsGroup>
  )
}

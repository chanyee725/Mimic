import { SettingsGroup, SettingsSection } from "@/components/app/settings-section"
import { Input } from "@/components/ui/input"
import { SETTINGS } from "@/dummy/settings"

import { useDraft } from "../hooks/use-draft"
import { ChoiceSelect } from "./choice-select"
import { SaveBar } from "./save-bar"
import { SettingRow } from "./setting-row"

export function RecordingSection() {
  const { draft, set, dirty, save, reset } = useDraft(SETTINGS.recording)
  return (
    <SettingsGroup className="@container">
      <SettingsSection title="Recording defaults">
        <SettingRow label="Action rate" hint="새 Task 의 기본값. Task 마다 바꿀 수 있습니다" htmlFor="rc-hz">
          <ChoiceSelect
            id="rc-hz"
            value={draft.actionHz}
            options={[30, 60, 100].map((v) => ({ value: v, label: `${v} Hz` }))}
            onChange={(v) => set("actionHz", v)}
          />
        </SettingRow>
        <SettingRow label="Camera rate" htmlFor="rc-fps">
          <ChoiceSelect
            id="rc-fps"
            value={draft.videoFps}
            options={[15, 30, 60].map((v) => ({ value: v, label: `${v} fps` }))}
            onChange={(v) => set("videoFps", v)}
          />
        </SettingRow>
        <SettingRow label="MCAP compression" hint="zstd 가 작고, lz4 는 녹화 중 CPU 를 덜 씁니다" htmlFor="rc-comp">
          <ChoiceSelect
            id="rc-comp"
            value={draft.mcapCompression}
            options={[
              { value: "zstd", label: "zstd" },
              { value: "lz4", label: "lz4" },
              { value: "none", label: "None" },
            ]}
            onChange={(v) => set("mcapCompression", v)}
          />
        </SettingRow>
        <SettingRow label="MCAP chunk size" htmlFor="rc-chunk">
          <Input
            id="rc-chunk"
            className="h-8 w-20 text-right text-[13px] tabular-nums"
            inputMode="numeric"
            value={draft.chunkMB}
            onChange={(e) => set("chunkMB", Number(e.target.value) || 0)}
          />
          <span className="text-xs text-muted-foreground">MB</span>
        </SettingRow>
      </SettingsSection>
      <SettingsSection title="Conversion">
        <SettingRow label="Video codec" hint="AV1 이 작고 LeRobot 기본값입니다. H.264 는 인코딩이 빠릅니다" htmlFor="rc-codec">
          <ChoiceSelect
            id="rc-codec"
            value={draft.codec}
            options={[
              { value: "av1", label: "AV1" },
              { value: "h264", label: "H.264" },
            ]}
            onChange={(v) => set("codec", v)}
          />
        </SettingRow>
        <SettingRow label="Quality (CRF)" hint="낮을수록 화질이 좋고 파일이 커집니다" htmlFor="rc-crf">
          <Input
            id="rc-crf"
            className="h-8 w-20 text-right text-[13px] tabular-nums"
            inputMode="numeric"
            value={draft.crf}
            onChange={(e) => set("crf", Number(e.target.value) || 0)}
          />
        </SettingRow>
      </SettingsSection>
      <SaveBar dirty={dirty} onSave={save} onReset={reset} />
    </SettingsGroup>
  )
}

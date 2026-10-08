import { Input } from "@/components/ui/input"
import { Segmented } from "@/components/common/segmented"
import { SettingsGroup, SettingsSection } from "@/components/common/settings-section"
import type { IsaacDevice, IsaacDisplay, IsaacMode, IsaacSettings } from "@/domain/settings"

import { useSettingsDraft } from "../hooks/use-draft"
import { ConnStatus } from "./conn-status"
import { SectionPending } from "./section-pending"
import { SaveBar } from "./save-bar"
import { SettingRow } from "./setting-row"

const MODES = [
  { value: "local", label: "This station" },
  { value: "remote", label: "Remote server" },
] as const satisfies readonly { value: IsaacMode; label: string }[]

const DISPLAYS = [
  { value: "window", label: "Window" },
  { value: "headless", label: "Headless" },
] as const satisfies readonly { value: IsaacDisplay; label: string }[]

const DEVICES = [
  { value: "gpu", label: "GPU" },
  { value: "cpu", label: "CPU" },
] as const satisfies readonly { value: IsaacDevice; label: string }[]

/** Isaac Sim server: where it runs and how the app shows (settings section `connection.isaac`) */
export function IsaacSection() {
  const { query, server, draft, set: setSection, saveBar } = useSettingsDraft("connection")
  if (!draft || !server) return <SectionPending query={query} />
  const value = draft.isaac
  const set = <K extends keyof IsaacSettings>(key: K, v: IsaacSettings[K]) => setSection("isaac", { ...value, [key]: v })
  const live = server.isaac

  return (
    <SettingsGroup className="@container">
      <SettingsSection
        title="Server"
        action={<ConnStatus target="isaac" state={live.state} detail={live.latencyMs != null ? `${live.latencyMs} ms` : undefined} />}
      >
        <SettingRow label="Runs on">
          <Segmented
            label="Isaac Sim server"
            role="radiogroup"
            fill
            size="md"
            value={value.mode}
            onChange={(v) => set("mode", v)}
            options={MODES}
          />
        </SettingRow>
        <SettingRow label="Display">
          <Segmented
            label="Isaac Sim display"
            role="radiogroup"
            fill
            size="md"
            value={value.display}
            onChange={(v) => set("display", v)}
            options={DISPLAYS}
          />
        </SettingRow>
        <SettingRow label="Physics" hint="물리 연산(PhysX) 장치. 바꾸면 Isaac Sim 이 다시 시작됩니다">
          <Segmented
            label="Isaac Sim physics device"
            role="radiogroup"
            fill
            size="md"
            value={value.device}
            onChange={(v) => set("device", v)}
            options={DEVICES}
          />
        </SettingRow>
        {value.mode === "local" ? (
          <>
            <SettingRow
              label="Python"
              hint={
                <>
                  <code className="font-mono">cd sim && uv sync</code> 로 설치
                </>
              }
              htmlFor="is-python"
            >
              <Input
                id="is-python"
                className="h-8 font-mono text-[13px]"
                value={value.python}
                onChange={(e) => set("python", e.target.value)}
              />
            </SettingRow>
            <SettingRow label="Port" htmlFor="is-port">
              <Input
                id="is-port"
                type="number"
                min={1}
                max={65535}
                className="h-8 font-mono text-[13px]"
                value={value.port}
                onChange={(e) => set("port", Number(e.target.value) || 0)}
              />
            </SettingRow>
          </>
        ) : (
          <SettingRow
            label="Server URL"
            hint={
              <>
                서버에서 <code className="font-mono">sim/runner/server.py --host 0.0.0.0</code> 실행
              </>
            }
            htmlFor="is-url"
          >
            <Input
              id="is-url"
              className="h-8 font-mono text-[13px]"
              placeholder="http://sim-server:8211"
              value={value.url}
              onChange={(e) => set("url", e.target.value)}
            />
          </SettingRow>
        )}
      </SettingsSection>
      <SaveBar {...saveBar} />
    </SettingsGroup>
  )
}

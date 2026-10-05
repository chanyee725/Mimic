import { Input } from "@/components/ui/input"
import { Segmented } from "@/components/common/segmented"
import { SettingsSection } from "@/components/common/settings-section"
import type { IsaacDisplay, IsaacMode, IsaacSettings } from "@/domain/settings"

import { ConnStatus } from "./conn-status"
import { SettingRow } from "./setting-row"

const MODES = [
  { value: "local", label: "This station" },
  { value: "remote", label: "Remote server" },
] as const satisfies readonly { value: IsaacMode; label: string }[]

const DISPLAYS = [
  { value: "window", label: "Window" },
  { value: "headless", label: "Headless" },
] as const satisfies readonly { value: IsaacDisplay; label: string }[]

/** Isaac Sim server: where it runs and how the app shows (Connection settings) */
export function IsaacSection({
  server,
  value,
  onChange,
}: {
  server: IsaacSettings
  value: IsaacSettings
  onChange: (value: IsaacSettings) => void
}) {
  const set = <K extends keyof IsaacSettings>(key: K, v: IsaacSettings[K]) => onChange({ ...value, [key]: v })
  const local = value.mode === "local"

  return (
    <SettingsSection title="Isaac Sim">
      <SettingRow label="Status">
        <ConnStatus target="isaac" state={server.state} detail={server.latencyMs != null ? `${server.latencyMs} ms` : undefined} />
      </SettingRow>
      <SettingRow label="Server" hint="이 스테이션에서 직접 띄우거나, 시뮬레이션 서버에 연결합니다">
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
      <SettingRow label="Display" hint="Window 는 Isaac Sim 창을 띄우고, Headless 는 화면 없이 돌립니다">
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
      {local ? (
        <>
          <SettingRow label="Python" hint="isaacsim 이 설치된 Python. 저장소 루트 기준 경로 (cd sim && uv sync)" htmlFor="cn-isaac-python">
            <Input
              id="cn-isaac-python"
              className="h-8 font-mono text-[13px]"
              value={value.python}
              onChange={(e) => set("python", e.target.value)}
            />
          </SettingRow>
          <SettingRow label="Port" hint="이 스테이션의 127.0.0.1 에서 서버가 쓰는 포트" htmlFor="cn-isaac-port">
            <Input
              id="cn-isaac-port"
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
              서버에서 <code className="font-mono">sim/.venv/bin/python sim/runner/server.py --host 0.0.0.0</code> 로 띄워 둡니다
            </>
          }
          htmlFor="cn-isaac-url"
        >
          <Input
            id="cn-isaac-url"
            className="h-8 font-mono text-[13px]"
            placeholder="http://sim-server:8211"
            value={value.url}
            onChange={(e) => set("url", e.target.value)}
          />
        </SettingRow>
      )}
    </SettingsSection>
  )
}

import { Input } from "@/components/ui/input"
import { SettingsGroup, SettingsSection } from "@/components/app/settings-section"
import { SETTINGS } from "@/dummy/settings"

import { useDraft } from "../hooks/use-draft"
import { ConnStatus } from "./conn-status"
import { SaveBar } from "./save-bar"
import { SettingRow } from "./setting-row"

export function ConnectionSection() {
  const { draft, set, dirty, save, reset } = useDraft(SETTINGS.connection)
  const { api, grpc, webrtc } = draft

  return (
    <SettingsGroup className="@container">
      <SettingsSection title="Backend API">
        <SettingRow label="Status">
          <ConnStatus state={api.state} detail={api.latencyMs ? `${api.latencyMs} ms` : undefined} />
        </SettingRow>
        <SettingRow label="URL" hint="FastAPI. Task · 데이터셋 · 학습 관리" htmlFor="cn-api">
          <Input
            id="cn-api"
            className="h-8 font-mono text-[13px]"
            value={api.url}
            onChange={(e) => set("api", { ...api, url: e.target.value })}
          />
        </SettingRow>
      </SettingsSection>
      <SettingsSection title="Robot data">
        <SettingRow label="Status">
          <ConnStatus state={grpc.state} detail={grpc.latencyMs ? `${grpc.latencyMs} ms` : undefined} />
        </SettingRow>
        <SettingRow label="gRPC endpoint" hint="60 Hz 관절 · action 스트림" htmlFor="cn-grpc">
          <Input
            id="cn-grpc"
            className="h-8 font-mono text-[13px]"
            value={grpc.url}
            onChange={(e) => set("grpc", { ...grpc, url: e.target.value })}
          />
        </SettingRow>
      </SettingsSection>
      <SettingsSection title="Video">
        <SettingRow label="Status">
          <ConnStatus state={webrtc.state} />
        </SettingRow>
        <SettingRow label="STUN server" hint="WebRTC 카메라 스트림" htmlFor="cn-stun">
          <Input
            id="cn-stun"
            className="h-8 font-mono text-[13px]"
            value={webrtc.stun}
            onChange={(e) => set("webrtc", { ...webrtc, stun: e.target.value })}
          />
        </SettingRow>
        <SettingRow label="TURN server" hint="다른 네트워크에서 볼 때만 필요합니다" htmlFor="cn-turn">
          <Input
            id="cn-turn"
            className="h-8 font-mono text-[13px]"
            placeholder="turn:host:3478"
            value={webrtc.turn}
            onChange={(e) => set("webrtc", { ...webrtc, turn: e.target.value })}
          />
        </SettingRow>
      </SettingsSection>
      <SaveBar dirty={dirty} onSave={save} onReset={reset} />
    </SettingsGroup>
  )
}

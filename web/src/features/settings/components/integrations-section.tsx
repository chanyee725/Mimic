import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { SettingsGroup, SettingsSection } from "@/components/common/settings-section"

import { useSettingsDraft } from "../hooks/use-draft"
import { ConnStatus } from "./conn-status"
import { SectionPending } from "./section-pending"
import { SaveBar } from "./save-bar"
import { SecretField } from "./secret-field"
import { SettingRow } from "./setting-row"

export function IntegrationsSection() {
  const { query, server, draft, set, saveBar } = useSettingsDraft("integrations")
  if (!draft || !server) return <SectionPending query={query} />
  const { hf } = draft

  return (
    <div className="grid gap-2">
      <SettingsGroup className="@container">
        <SettingsSection
          title="Hugging Face"
          action={<ConnStatus target="hf" state={server.hf.state} detail={`as ${server.hf.namespace}`} canTest={server.hf.token.set} />}
        >
          <SettingRow label="Access token" hint="업로드에는 write 권한이 필요합니다" htmlFor="hf-token">
            <SecretField id="hf-token" name="hf_token" secret={server.hf.token} placeholder="hf_…" />
          </SettingRow>
          <SettingRow label="Namespace" htmlFor="hf-ns">
            <Input
              id="hf-ns"
              className="h-8 text-[13px]"
              value={hf.namespace}
              onChange={(e) => set("hf", { ...hf, namespace: e.target.value })}
            />
          </SettingRow>
          <SettingRow label="Upload as private" htmlFor="hf-private">
            <Switch id="hf-private" checked={hf.privateByDefault} onCheckedChange={(v) => set("hf", { ...hf, privateByDefault: v })} />
          </SettingRow>
        </SettingsSection>

        <SettingsSection
          title="RunPod"
          action={<ConnStatus target="runpod" state={server.runpod.state} canTest={server.runpod.apiKey.set} />}
        >
          <SettingRow label="API key" htmlFor="rp-key">
            <SecretField id="rp-key" name="runpod_api_key" secret={server.runpod.apiKey} placeholder="rpa_…" />
          </SettingRow>
        </SettingsSection>
        <SaveBar {...saveBar} />
      </SettingsGroup>
      <p className="px-1 text-xs text-muted-foreground">
        키는 저장소 루트의 <code className="font-mono">.env</code> 에만 저장되고, 화면에는 끝 4자리만 보입니다.
      </p>
    </div>
  )
}

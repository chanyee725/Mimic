import { DetailList } from "@/components/common/detail-list"
import { SettingsGroup, SettingsSection } from "@/components/common/settings-section"
import { VERSIONS } from "@/dummy/settings"

export function AboutSection() {
  return (
    <SettingsGroup>
      <SettingsSection title="Versions">
        <DetailList rows={VERSIONS.map((v) => ({ k: v.k, v: <span className="font-mono">{v.v}</span> }))} />
      </SettingsSection>
    </SettingsGroup>
  )
}

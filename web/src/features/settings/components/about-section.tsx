import { DetailList } from "@/components/app/detail-list"
import { SettingsGroup, SettingsSection } from "@/components/app/settings-section"
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

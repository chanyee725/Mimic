import { DetailList } from "@/components/common/detail-list"
import { SettingsGroup, SettingsSection } from "@/components/common/settings-section"
import { getVersions } from "@/api/settings"

export function AboutSection() {
  const versions = getVersions()

  return (
    <SettingsGroup>
      <SettingsSection title="Versions">
        <DetailList rows={versions.map((v) => ({ k: v.k, v: <span className="font-mono">{v.v}</span> }))} />
      </SettingsSection>
    </SettingsGroup>
  )
}

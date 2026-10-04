import { DetailList } from "@/components/common/detail-list"
import { SettingsGroup, SettingsSection } from "@/components/common/settings-section"
import { useVersions } from "@/api/settings"

import { DiskUsage } from "./disk-usage"
import { SectionPending } from "./section-pending"

export function AboutSection() {
  const query = useVersions()
  if (!query.data) return <SectionPending query={query} />

  return (
    <SettingsGroup>
      <SettingsSection title="Versions">
        <DetailList rows={query.data.map((v) => ({ k: v.k, v: <span className="font-mono">{v.v}</span> }))} />
      </SettingsSection>
      <SettingsSection title="Disk">
        <DiskUsage />
      </SettingsSection>
    </SettingsGroup>
  )
}

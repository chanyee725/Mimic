import { Kbd } from "@/components/ui/kbd"
import { SettingsGroup, SettingsSection } from "@/components/common/settings-section"
import { useShortcuts } from "@/api/settings"

import { SectionPending } from "./section-pending"

export function ShortcutsSection() {
  const query = useShortcuts()
  if (!query.data) return <SectionPending query={query} />

  return (
    <SettingsGroup>
      {query.data.map((g) => (
        <SettingsSection key={g.page} title={g.page}>
          <dl className="divide-y">
            {g.keys.map((k) => (
              <div key={k.action} className="flex items-center justify-between gap-4 py-2 text-[13px]">
                <dt>{k.action}</dt>
                <dd className="flex items-center gap-1 text-muted-foreground">
                  {k.keys.map((key, i) => (
                    <span key={key} className="flex items-center gap-1">
                      {i > 0 && <span className="text-xs">{g.page === "Capture" && key === "4" ? "–" : "/"}</span>}
                      <Kbd>{key}</Kbd>
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </SettingsSection>
      ))}
    </SettingsGroup>
  )
}

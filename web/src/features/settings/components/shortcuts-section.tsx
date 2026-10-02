import { SettingsGroup, SettingsSection } from "@/components/app/settings-section"
import { Kbd } from "@/components/ui/kbd"
import { SHORTCUTS, VERSIONS } from "@/dummy/settings"

export function ShortcutsSection() {
  return (
    <SettingsGroup>
      {SHORTCUTS.map((g) => (
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

export function AboutSection() {
  return (
    <SettingsGroup>
      <SettingsSection title="Versions">
        <dl className="divide-y">
          {VERSIONS.map((v) => (
            <div key={v.k} className="flex justify-between gap-4 py-2 text-[13px]">
              <dt className="text-muted-foreground">{v.k}</dt>
              <dd className="font-mono">{v.v}</dd>
            </div>
          ))}
        </dl>
      </SettingsSection>
    </SettingsGroup>
  )
}

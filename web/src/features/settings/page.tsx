import { useSearchParams } from "react-router-dom"

import { Page, Panel } from "@/components/layout/page-layout"
import { cn } from "@/lib/utils"

import { SECTION_ALIASES, SECTIONS } from "./sections"

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const id = params.get("section") ?? ""
  const current = SECTIONS.find((s) => s.id === (SECTION_ALIASES[id] ?? id)) ?? SECTIONS[0]

  return (
    // Centred, form-width column with no page header: the section list names where you are
    <Page fit className="mx-auto w-full max-w-4xl">
      <h1 className="sr-only">Settings</h1>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <Panel className="h-fit p-2">
          <nav aria-label="Settings sections">
            <ul className="grid gap-0.5">
              {SECTIONS.map((s) => {
                const on = s.id === current.id
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-current={on ? "page" : undefined}
                      onClick={() => setParams({ section: s.id }, { replace: true })}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
                        on && "bg-accent font-medium text-foreground hover:bg-accent",
                      )}
                    >
                      <s.icon className="size-[15px] shrink-0 stroke-[1.75]" aria-hidden />
                      {s.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </Panel>

        {/* Keying by section discards in-progress edits when the section changes */}
        <section key={current.id} className="grid min-h-0 content-start overflow-y-auto pb-1" aria-label={current.label}>
          {current.render()}
        </section>
      </div>
    </Page>
  )
}

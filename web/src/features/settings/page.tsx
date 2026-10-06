import { useSearchParams } from "react-router-dom"

import { Page } from "@/components/layout/page-layout"
import { cn } from "@/lib/utils"

import { SECTION_ALIASES, SECTIONS } from "./sections"

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const id = params.get("section") ?? ""
  const current = SECTIONS.find((s) => s.id === (SECTION_ALIASES[id] ?? id)) ?? SECTIONS[0]

  return (
    // Centred, form-width column: the title, the section list and the form share one left edge
    <Page fit className="mx-auto w-full max-w-4xl" title="Settings" description="계정 연결, Isaac Sim, 알림을 설정합니다.">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-[10rem_minmax(0,1fr)]">
        {/* A plain list on a hairline track; the current section is marked on the track itself */}
        <nav aria-label="Settings sections" className="h-fit lg:sticky lg:top-0">
          <ul className="grid border-l">
            {SECTIONS.map((s) => {
              const on = s.id === current.id
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-current={on ? "page" : undefined}
                    onClick={() => setParams({ section: s.id }, { replace: true })}
                    className={cn(
                      "-ml-px flex w-full items-center gap-2.5 border-l-2 border-transparent py-1.5 pr-2 pl-3.5 text-left text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                      on && "border-foreground font-medium text-foreground",
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

        {/* Keying by section discards in-progress edits when the section changes */}
        <div key={current.id} className="grid min-h-0 max-w-2xl content-start gap-5 overflow-y-auto pb-1">
          <header className="grid gap-1">
            <h2 className="text-base font-semibold">{current.label}</h2>
            <p className="text-[13px] text-muted-foreground">{current.description}</p>
          </header>
          {current.render()}
        </div>
      </div>
    </Page>
  )
}

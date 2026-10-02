import { useSearchParams } from "react-router-dom"

import { Page, Panel } from "@/components/layout/page-layout"
import { cn } from "@/lib/utils"

import { SECTIONS } from "./sections"

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const current = SECTIONS.find((s) => s.id === params.get("section")) ?? SECTIONS[0]

  return (
    <Page fit title="Settings" description="스테이션, 저장소, 외부 서비스 연결을 설정합니다.">
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
        <div key={current.id} className="grid min-h-0 content-start gap-3 overflow-y-auto pb-1">
          <div className="grid gap-0.5">
            <h2 className="text-lg font-semibold">{current.label}</h2>
            <p className="text-[13px] text-muted-foreground">{current.description}</p>
          </div>
          <div className="max-w-3xl">{current.render()}</div>
        </div>
      </div>
    </Page>
  )
}

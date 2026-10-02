import { useState } from "react"

import { Panel } from "@/components/app/page"
import { Segmented } from "@/components/app/segmented"
import { JOBS, isActive } from "@/dummy/training"

import { JobRow } from "./job-row"

type Tab = "all" | "active" | "finished"

/** Job 목록. 전체 · 돌고 있는 것 · 끝난 것으로 거른다 */
export function JobsPanel() {
  const [tab, setTab] = useState<Tab>("all")
  const active = JOBS.filter(isActive)
  const finished = JOBS.filter((j) => !isActive(j))
  const shown = tab === "all" ? JOBS : tab === "active" ? active : finished

  return (
    <Panel
      className="min-h-0 flex-1"
      title="Jobs"
      action={
        <Segmented
          label="Jobs"
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: "All", count: JOBS.length },
            { value: "active", label: "Running", count: active.length },
            { value: "finished", label: "Finished", count: finished.length },
          ]}
        />
      }
    >
      {shown.length === 0 ? (
        <p className="grid flex-1 place-items-center py-10 text-[13px] text-muted-foreground">
          {tab !== "finished" ? "돌고 있는 학습이 없습니다. 오른쪽에서 학습을 시작하세요." : "끝난 학습이 없습니다."}
        </p>
      ) : (
        <ul className="-mx-3 grid min-h-0 content-start gap-1 overflow-y-auto">
          {shown.map((j) => (
            <JobRow key={j.id} job={j} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

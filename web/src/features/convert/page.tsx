import { useState } from "react"

import { Page, Panel } from "@/components/layout/page-layout"
import { useTasks } from "@/api/tasks"

import { ConvertWorkspace } from "./components/convert-workspace"
import { QueryNote } from "@/components/common/query-state"

export function ConvertPage() {
  const tasks = useTasks()
  const [picked, setPicked] = useState<string | null>(null)
  const task = tasks.data?.find((t) => t.id === picked) ?? tasks.data?.[0]

  return (
    <Page title="Convert" description="Task 를 골라 승인된 MCAP 에피소드를 LeRobot 데이터셋으로 변환합니다.">
      {task ? (
        <ConvertWorkspace key={task.id} task={task} onSelectTask={setPicked} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Panel title="Task">
            <QueryNote query={tasks} />
            {tasks.data?.length === 0 && (
              <p className="text-[13px] text-muted-foreground">
                등록된 Task 가 없습니다. Tasks 에서 Task 를 만들고 Capture 에서 녹화한 뒤 Review 에서 승인하세요.
              </p>
            )}
          </Panel>
          <Panel title="Output">
            <p className="text-[13px] text-muted-foreground">승인된 에피소드가 있으면 LeRobot 데이터셋으로 변환할 수 있습니다.</p>
          </Panel>
        </div>
      )}
    </Page>
  )
}

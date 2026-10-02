import { useParams } from "react-router-dom"

import { Page } from "@/components/layout/page-layout"
import { TASKS } from "@/dummy/tasks"

import { TaskDetail } from "./components/task-detail"
import { TaskList } from "./components/task-list"

export function TasksPage() {
  const { taskId } = useParams()
  const selected = TASKS.find((t) => t.id === taskId) ?? TASKS[0]

  return (
    <Page fit title="Tasks" description="취득할 데이터를 Task 단위로 정의합니다. Capture와 Sessions는 Task를 기준으로 묶입니다.">
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)]">
        <TaskList selectedId={selected.id} />
        <TaskDetail key={selected.id} initial={selected} />
      </div>
    </Page>
  )
}

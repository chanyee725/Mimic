import { useParams } from "react-router-dom"

import { Page, Panel } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/common/empty-state"
import { useTasks } from "@/api/tasks"

import { LoadingNote } from "@/components/common/query-state"
import { TaskDetail } from "./components/task-detail"
import { TaskList } from "./components/task-list"

export function TasksPage() {
  const { taskId } = useParams()
  const tasks = useTasks()
  const list = tasks.data ?? []
  // Unknown ids fall back to the first task once the list is in
  const selectedId = tasks.isPending ? taskId : (list.find((t) => t.id === taskId) ?? list[0])?.id

  return (
    <Page fit title="Tasks" description="취득할 데이터를 Task 단위로 정의합니다. Capture와 Sessions는 Task를 기준으로 묶입니다.">
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)]">
        <TaskList selectedId={selectedId} />
        {selectedId ? (
          <TaskDetail key={selectedId} id={selectedId} />
        ) : (
          <Panel className="min-w-0">
            {/* The list panel shows the error and Retry */}
            {tasks.isError ? null : tasks.isPending ? (
              <LoadingNote />
            ) : (
              <EmptyState>Task 가 없습니다. 왼쪽 + 버튼으로 Task 를 만들어 시작하세요.</EmptyState>
            )}
          </Panel>
        )}
      </div>
    </Page>
  )
}

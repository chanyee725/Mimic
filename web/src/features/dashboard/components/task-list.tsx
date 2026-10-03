import { Panel, PanelLink } from "@/components/layout/page-layout"
import { QueryView } from "@/components/common/query-state"
import { useSessions } from "@/api/sessions"
import { useCurrentTask } from "@/api/station"
import { useTasks } from "@/api/tasks"
import type { Session } from "@/domain/session"

import { MAX_TASKS, STATUS_ORDER } from "../lib"
import { TaskRow } from "./task-row"

export function TaskList() {
  const tasksQuery = useTasks()
  const currentId = useCurrentTask().data?.taskId ?? null
  // One sessions request for all rows, grouped by task
  const sessions = useSessions().data
  const byTask = new Map<string, Session[]>()
  for (const s of sessions ?? []) byTask.set(s.taskId, [...(byTask.get(s.taskId) ?? []), s])

  // Task currently being captured first, the rest by status
  const tasks = [...(tasksQuery.data ?? [])].sort((a, b) =>
    a.id === currentId ? -1 : b.id === currentId ? 1 : STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  )
  const shown = tasks.slice(0, MAX_TASKS)
  const hidden = tasks.length - shown.length
  const linkLabel = !tasksQuery.data ? "View all" : hidden > 0 ? `+${hidden} more` : `${tasks.length} tasks`

  return (
    <Panel title="Tasks" action={<PanelLink to="/tasks">{linkLabel}</PanelLink>}>
      <QueryView query={tasksQuery}>
        {() =>
          shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 Task 가 없습니다.</p>
          ) : (
            // Rows share the panel height and scroll inside the panel when they overflow
            <ul className="-mx-2 flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
              {shown.map((t) => (
                <TaskRow key={t.id} task={t} sessions={sessions && (byTask.get(t.id) ?? [])} current={t.id === currentId} />
              ))}
            </ul>
          )
        }
      </QueryView>
    </Panel>
  )
}

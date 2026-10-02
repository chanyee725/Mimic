import { Panel, PanelLink } from "@/components/app/page"
import { CURRENT_TASK_ID } from "@/dummy/station"
import { TASKS } from "@/dummy/tasks"

import { MAX_TASKS, STATUS_ORDER } from "../lib"
import { TaskRow } from "./task-row"

export function TaskList() {
  // Task currently being captured first, the rest by status
  const tasks = [...TASKS].sort((a, b) =>
    a.id === CURRENT_TASK_ID ? -1 : b.id === CURRENT_TASK_ID ? 1 : STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  )
  const shown = tasks.slice(0, MAX_TASKS)
  const hidden = tasks.length - shown.length

  return (
    <Panel title="Tasks" action={<PanelLink to="/tasks">{hidden > 0 ? `+${hidden} more` : `${tasks.length} tasks`}</PanelLink>}>
      {/* Rows share the panel height and scroll inside the panel when they overflow */}
      <ul className="-mx-2 flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
        {shown.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </ul>
    </Panel>
  )
}

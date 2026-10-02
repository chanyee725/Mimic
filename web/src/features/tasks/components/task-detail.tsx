import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { LuCircle, LuUpload } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Panel } from "@/components/app/page"
import { StatusDot } from "@/components/app/status-dot"
import type { Task } from "@/dummy/tasks"

import { STATUS, taskToYaml } from "../lib"
import { TaskDefinition } from "./task-definition"

/** Edit state for the selected task. The parent keys it by task id so it resets when the task changes. */
export function TaskDetail({ initial }: { initial: Task }) {
  const [task, setTask] = useState<Task>(initial)
  const [tab, setTab] = useState("definition")
  const yaml = useMemo(() => taskToYaml(task), [task])
  const status = STATUS[task.status]

  return (
    <Panel className="@container min-w-0 gap-4">
      {/* Title and meta on the left, actions top-right on one line. The title truncates when space runs out */}
      <div className="flex items-start justify-between gap-4">
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <h2 className="min-w-0 truncate text-lg font-semibold">{task.id}</h2>
            {/* On narrow panels, hide the status and badge first so the title is not cut off */}
            <StatusDot tone={status.tone} className="hidden shrink-0 text-[13px] @lg:inline-flex">
              {status.label}
            </StatusDot>
            <Badge variant="outline" className="hidden shrink-0 @2xl:inline-flex">
              SO-101
            </Badge>
          </div>
          <span className="truncate text-[13px] text-muted-foreground tabular-nums">
            v{task.version} · updated {task.updatedAt} by {task.updatedBy}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="ghost" size="icon-sm" aria-label="Import YAML" title="Import YAML" className="text-muted-foreground">
            <LuUpload />
          </Button>
          <Button variant="outline" size="sm">
            Duplicate
          </Button>
          <Button variant="outline" size="sm">
            Save
          </Button>
          <Link to="/capture" className={buttonVariants({ size: "sm" })}>
            <LuCircle className="size-2.5 fill-current" />
            Start capture
          </Link>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="min-h-0 flex-1">
        <TabsList>
          <TabsTrigger value="definition" className="px-3">
            Definition
          </TabsTrigger>
          <TabsTrigger value="yaml" className="px-3">
            YAML
          </TabsTrigger>
        </TabsList>
        {/* Only the tab content scrolls vertically; horizontally it stays within the panel width */}
        <TabsContent value="definition" className="@container min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <TaskDefinition task={task} onChange={(patch) => setTask((t) => ({ ...t, ...patch }))} />
        </TabsContent>
        <TabsContent value="yaml" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <pre className="rounded-md bg-muted p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">{yaml}</pre>
        </TabsContent>
      </Tabs>
    </Panel>
  )
}

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

/** 선택된 Task 의 편집 상태. 부모에서 task id 로 key 를 걸어 Task 전환 시 초기화된다. */
export function TaskDetail({ initial }: { initial: Task }) {
  const [task, setTask] = useState<Task>(initial)
  const [tab, setTab] = useState("definition")
  const yaml = useMemo(() => taskToYaml(task), [task])
  const status = STATUS[task.status]

  return (
    <Panel className="@container min-w-0 gap-4">
      {/* 제목 · 메타는 왼쪽, 액션은 오른쪽 위 한 줄. 폭이 모자라면 제목이 말줄임된다 */}
      <div className="flex items-start justify-between gap-4">
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <h2 className="min-w-0 truncate text-lg font-semibold">{task.id}</h2>
            {/* 패널이 좁으면 제목이 잘리지 않도록 상태·배지를 먼저 숨긴다 */}
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
        {/* 탭 내용만 세로로 스크롤. 가로는 패널 폭에 맞춰 넘치지 않게 한다 */}
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

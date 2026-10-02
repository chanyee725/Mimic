import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { LuCircle, LuPlus, LuSearch, LuUpload } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { StatusDot, type Tone } from "@/components/app/status-dot"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SESSIONS } from "@/dummy/sessions"
import { CURRENT_TASK_ID } from "@/dummy/station"
import { TASKS, type Task, type TaskStatus } from "@/dummy/tasks"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ProgressRing } from "@/components/app/progress-ring"
import { TaskDefinition } from "@/features/tasks/task-definition"
import { taskToYaml } from "@/features/tasks/yaml"

const STATUS: Record<TaskStatus, { tone: Tone; label: string }> = {
  active: { tone: "ok", label: "Active" },
  draft: { tone: "muted", label: "Draft" },
  completed: { tone: "info", label: "Completed" },
}

function successOf(taskId: string) {
  const sessions = SESSIONS.filter((s) => s.taskId === taskId)
  const episodes = sessions.reduce((a, s) => a + s.episodes, 0)
  const success = episodes ? Math.round(sessions.reduce((a, s) => a + s.successPct * s.episodes, 0) / episodes) : null
  return { sessions: sessions.length, success }
}

function TaskList({ selectedId }: { selectedId: string }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const tasks = TASKS.filter((t) => !q || t.id.includes(q) || t.name.toLowerCase().includes(q) || t.instruction.toLowerCase().includes(q))

  // 앱 사이드바와 같은 톤: 구분선 없이 얇은 글자, 선택 행만 배경으로 강조
  return (
    <Panel
      className="gap-2 p-3"
      title={
        <span className="flex items-baseline gap-1.5 px-2 text-[13px] font-medium">
          All tasks
          <span className="font-normal text-muted-foreground tabular-nums">{TASKS.length}</span>
        </span>
      }
      action={
        <Button variant="ghost" size="icon-sm" aria-label="New task" title="New task" className="text-muted-foreground">
          <LuPlus />
        </Button>
      }
    >
      <div className="relative px-1">
        <LuSearch className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search tasks"
          placeholder="Search tasks…"
          className="h-8 border-transparent bg-muted/60 pl-8 text-[13px] shadow-none focus-visible:bg-background"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul className="grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto">
        {tasks.map((t) => {
          const selected = t.id === selectedId
          const current = t.id === CURRENT_TASK_ID
          const pct = Math.min(100, Math.round((t.collected / t.targetEpisodes) * 100))
          const { sessions, success } = successOf(t.id)
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-current={selected ? "page" : undefined}
                onClick={() => navigate(`/tasks/${t.id}`)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60",
                  selected && "bg-accent hover:bg-accent",
                )}
              >
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={cn("min-w-0 truncate text-[13px]", selected ? "font-medium" : "font-normal")}>{t.id}</span>
                    {current && (
                      <span className="shrink-0 rounded-sm bg-bad-muted px-1 text-[10px] font-medium tracking-wide text-bad">REC</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{t.instruction}</p>
                  <p className="truncate text-[11px] text-muted-foreground/80 tabular-nums">
                    {t.collected}/{t.targetEpisodes} · {plural(sessions, "session")} · success {success === null ? "—" : `${success}%`}
                  </p>
                </div>
                <ProgressRing pct={pct} status={t.status} label={`${t.id} progress`} thin className="size-10" />
              </button>
            </li>
          )
        })}
        {tasks.length === 0 && <li className="py-6 text-center text-[13px] text-muted-foreground">No tasks found.</li>}
      </ul>
    </Panel>
  )
}

/** 선택된 Task 의 편집 상태. 부모에서 task id 로 key 를 걸어 Task 전환 시 초기화된다. */
function TaskDetail({ initial }: { initial: Task }) {
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

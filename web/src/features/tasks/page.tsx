import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { LuCircle, LuPlus, LuSearch, LuUpload } from "react-icons/lu"

import { Page, Panel, PanelLink } from "@/components/app/page"
import { StatusDot, type Tone } from "@/components/app/status-dot"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SESSIONS } from "@/dummy/sessions"
import { CURRENT_TASK_ID } from "@/dummy/station"
import { TASKS, type Task, type TaskStatus } from "@/dummy/tasks"
import { cn } from "@/lib/utils"
import { ProgressRing } from "@/features/tasks/progress-ring"
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
  const tasks = TASKS.filter(
    (t) => !q || t.id.includes(q) || t.name.toLowerCase().includes(q) || t.instruction.toLowerCase().includes(q),
  )

  return (
    <Panel title="All tasks" action={<span className="font-mono text-[13px] text-muted-foreground">{TASKS.length}</span>}>
      <div className="relative">
        <LuSearch className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search tasks"
          placeholder="Search tasks…"
          className="h-9 pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul className="-mx-2 min-h-0 flex-1 divide-y overflow-y-auto">
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
                  "my-0.5 flex w-full items-center gap-4 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-muted/50",
                  selected && "bg-muted/60 hover:bg-muted/60",
                )}
              >
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate font-mono text-sm font-medium">{t.id}</span>
                    {current && (
                      <span className="shrink-0 rounded-sm bg-bad-muted px-1.5 text-[11px] font-medium text-bad">REC</span>
                    )}
                  </div>
                  <p className="truncate text-[13px] text-muted-foreground">{t.instruction}</p>
                  <div className="flex flex-wrap gap-x-3 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                    <span className="text-foreground">
                      {t.collected} / {t.targetEpisodes}
                    </span>
                    <span>
                      {sessions} {sessions === 1 ? "session" : "sessions"}
                    </span>
                    <span>success {success === null ? "—" : `${success}%`}</span>
                  </div>
                </div>
                <ProgressRing pct={pct} status={t.status} label={`${t.id} progress`} className="size-12" />
              </button>
            </li>
          )
        })}
        {tasks.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No tasks found.</li>}
      </ul>
    </Panel>
  )
}

function SessionsTable({ taskId }: { taskId: string }) {
  const rows = SESSIONS.filter((s) => s.taskId === taskId)
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No sessions yet.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2.5 pr-4 font-medium">Session</th>
            <th className="px-4 py-2.5 font-medium">Operator</th>
            <th className="px-4 py-2.5 text-right font-medium">Episodes</th>
            <th className="px-4 py-2.5 text-right font-medium">Accepted</th>
            <th className="px-4 py-2.5 text-right font-medium">Success</th>
            <th className="py-2.5 pl-4 font-medium">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((s) => (
            <tr key={s.id} className="transition-colors hover:bg-muted/50">
              <td className="py-2.5 pr-4">
                <Link to={`/sessions?task=${taskId}`} className="font-mono text-[13px] underline-offset-4 hover:underline">
                  {s.id}
                </Link>
              </td>
              <td className="px-4 py-2.5">{s.operator}</td>
              <td className="px-4 py-2.5 text-right font-mono">{s.episodes}</td>
              <td className="px-4 py-2.5 text-right font-mono">{s.accepted}</td>
              <td className="px-4 py-2.5 text-right font-mono">{s.successPct}%</td>
              <td className="py-2.5 pl-4 text-muted-foreground">{s.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 선택된 Task 의 편집 상태. 부모에서 task id 로 key 를 걸어 Task 전환 시 초기화된다. */
function TaskDetail({ initial }: { initial: Task }) {
  const [task, setTask] = useState<Task>(initial)
  const [tab, setTab] = useState("definition")
  const yaml = useMemo(() => taskToYaml(task), [task])
  const sessionCount = SESSIONS.filter((s) => s.taskId === task.id).length
  const status = STATUS[task.status]

  return (
    <Panel className="gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="truncate font-mono text-lg font-semibold">{task.id}</h2>
            <StatusDot tone={status.tone} className="text-[13px]">
              {status.label}
            </StatusDot>
            <Badge variant="outline">SO-101</Badge>
          </div>
          <span className="text-[13px] text-muted-foreground">
            <span className="font-mono">v{task.version}</span> · updated {task.updatedAt} by{" "}
            <span className="font-mono">{task.updatedBy}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline">Duplicate</Button>
          <Button variant="outline">Save</Button>
          <Link to="/capture" className={buttonVariants()}>
            <LuCircle className="size-3 fill-current" />
            Start capture
          </Link>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="min-h-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="definition" className="px-3">
              Definition
            </TabsTrigger>
            <TabsTrigger value="sessions" className="px-3">
              Sessions ({sessionCount})
            </TabsTrigger>
            <TabsTrigger value="yaml" className="px-3">
              YAML
            </TabsTrigger>
          </TabsList>
          {tab === "sessions" && <PanelLink to={`/sessions?task=${task.id}`}>Open in Sessions</PanelLink>}
        </div>
        {/* 탭 내용만 패널 안에서 스크롤 */}
        <TabsContent value="definition" className="min-h-0 flex-1 overflow-y-auto">
          <TaskDefinition task={task} onChange={(patch) => setTask((t) => ({ ...t, ...patch }))} />
        </TabsContent>
        <TabsContent value="sessions" className="min-h-0 flex-1 overflow-y-auto">
          <SessionsTable taskId={task.id} />
        </TabsContent>
        <TabsContent value="yaml" className="min-h-0 flex-1 overflow-y-auto">
          <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed">{yaml}</pre>
        </TabsContent>
      </Tabs>
    </Panel>
  )
}

export function TasksPage() {
  const { taskId } = useParams()
  const selected = TASKS.find((t) => t.id === taskId) ?? TASKS[0]

  return (
    <Page
      fit
      title="Tasks"
      description="취득할 데이터를 Task 단위로 정의합니다. Capture와 Sessions는 Task를 기준으로 묶입니다."
      actions={
        <>
          <Button variant="outline">
            <LuUpload />
            Import YAML
          </Button>
          <Button>
            <LuPlus />
            New task
          </Button>
        </>
      }
    >
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)]">
        <TaskList selectedId={selected.id} />
        <TaskDetail key={selected.id} initial={selected} />
      </div>
    </Page>
  )
}

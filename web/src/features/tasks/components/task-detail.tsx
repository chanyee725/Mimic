import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { LuCircle, LuTrash2, LuUpload } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Panel } from "@/components/layout/page-layout"
import { LinkButton } from "@/components/common/link-button"
import { StatusDot } from "@/components/common/status-dot"
import { ApiError } from "@/api/client"
import { useDeleteTask, useDuplicateTask, useTask, useTaskYaml, useUpdateTask } from "@/api/tasks"
import type { Task } from "@/domain/task"
import { taskInput } from "@/domain/task"
import { formatDateTime } from "@/lib/format"

import { errorText, isDirty, STATUS } from "../lib"
import { DeleteTaskDialog } from "./delete-task-dialog"
import { ImportYamlDialog } from "./import-yaml-dialog"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { TaskDefinition } from "./task-definition"
import { TaskIdDialog } from "./task-id-dialog"

/** Loads the selected task. The parent keys it by task id so the edit state resets when the task changes. */
export function TaskDetail({ id }: { id: string }) {
  const query = useTask(id)

  if (!query.data) {
    return (
      <Panel className="min-w-0">
        {query.isError ? <ErrorNote error={query.error} onRetry={() => void query.refetch()} /> : <LoadingNote />}
      </Panel>
    )
  }
  return <TaskEditor base={query.data} />
}

/** Edit state for one task: Save sends the version the draft is based on; a 409 reloads the current task */
function TaskEditor({ base }: { base: Task }) {
  const navigate = useNavigate()
  const [task, setTask] = useState<Task>(base)
  const [prevBase, setPrevBase] = useState(base)
  const [tab, setTab] = useState("definition")
  const [conflict, setConflict] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const save = useUpdateTask()
  const del = useDeleteTask()
  const duplicate = useDuplicateTask()
  const yaml = useTaskYaml(base.id)

  // Follow server updates (events, refetches) while there are no local edits
  if (base !== prevBase) {
    setPrevBase(base)
    if (!isDirty(task, prevBase)) setTask(base)
  }

  const dirty = isDirty(task, base)
  const status = STATUS[task.status]

  function onSave() {
    setConflict(false)
    save.mutate(
      // Drop empty tags left over from typing "a, "
      { id: task.id, body: { ...taskInput(task), tags: task.tags.filter(Boolean), version: task.version } },
      {
        onSuccess: setTask,
        onError: (err) => {
          if (!(err instanceof ApiError && err.status === 409)) return
          // Someone saved first: load their version and say so
          const current = err.details.current as Task | undefined
          if (current) setTask(current)
          setConflict(true)
        },
      },
    )
  }

  const saveNote = conflict
    ? "다른 곳에서 먼저 저장되어 최신 버전을 다시 불러왔습니다. 변경 내용을 다시 입력한 뒤 저장하세요."
    : save.isError
      ? errorText(save.error)
      : null

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
            {base.envId && `Isaac Sim · ${base.envId} · `}v{base.version} · updated {formatDateTime(base.updatedAt)}
            {dirty && <span className="text-foreground"> · unsaved changes</span>}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Import YAML"
            title="Import YAML"
            className="text-muted-foreground"
            onClick={() => setImporting(true)}
          >
            <LuUpload />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              duplicate.reset()
              setDuplicating(true)
            }}
          >
            Duplicate
          </Button>
          <Button variant="outline" size="sm" disabled={!dirty || save.isPending} onClick={onSave}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <LinkButton to="/capture" size="sm">
            <LuCircle className="size-2.5 fill-current" />
            Start capture
          </LinkButton>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete task"
            title="Delete task"
            className="text-bad hover:text-bad"
            onClick={() => {
              del.reset()
              setDeleting(true)
            }}
          >
            <LuTrash2 />
          </Button>
        </div>
      </div>

      {saveNote && <p className="-mt-2 text-[13px] whitespace-pre-line text-bad">{saveNote}</p>}

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
        <TabsContent value="yaml" className="grid min-h-0 min-w-0 flex-1 content-start gap-2 overflow-y-auto">
          {dirty && <p className="text-xs text-muted-foreground">저장된 버전의 YAML입니다. 저장하지 않은 변경은 반영되지 않습니다.</p>}
          {yaml.isError ? (
            <ErrorNote error={yaml.error} onRetry={() => void yaml.refetch()} />
          ) : yaml.data === undefined ? (
            <LoadingNote />
          ) : (
            <pre className="rounded-md bg-muted p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">{yaml.data}</pre>
          )}
        </TabsContent>
      </Tabs>

      <TaskIdDialog
        open={duplicating}
        onOpenChange={setDuplicating}
        title="Duplicate task"
        description="저장된 설정을 그대로 복사해 Draft 상태의 새 Task로 만듭니다."
        initial={{ id: `${base.id}-copy`, name: `${base.name} (copy)` }}
        submitLabel="Duplicate"
        pending={duplicate.isPending}
        error={errorText(duplicate.error)}
        onSubmit={({ id, name }) =>
          duplicate.mutate(
            { sourceId: base.id, id, name },
            {
              onSuccess: (copy) => {
                setDuplicating(false)
                navigate(`/tasks/${copy.id}`)
              },
            },
          )
        }
      />
      <ImportYamlDialog open={importing} onOpenChange={setImporting} onImported={(t) => navigate(`/tasks/${t.id}`)} />
      <DeleteTaskDialog
        open={deleting}
        onOpenChange={setDeleting}
        taskId={base.id}
        pending={del.isPending}
        error={del.error}
        onConfirm={() =>
          del.mutate(base.id, {
            onSuccess: () => {
              setDeleting(false)
              navigate("/tasks")
            },
          })
        }
      />
    </Panel>
  )
}

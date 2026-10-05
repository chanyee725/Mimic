import { useRef, useState } from "react"
import { LuUpload } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Page, Panel } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/common/empty-state"
import { TaskPicker } from "@/components/pickers/task-picker"
import { useImportRecording } from "@/api/recordings"
import { useTasks } from "@/api/tasks"

import { ErrorNote, QueryNote } from "@/components/common/query-state"
import { ReviewWorkspace } from "./components/review-workspace"

const NO_TASK = "등록된 Task 가 없습니다. Tasks 에서 Task 를 만들고 Capture 에서 녹화하세요."

export function ReviewPage() {
  const tasks = useTasks()
  const [picked, setPicked] = useState<string | null>(null)
  const task = tasks.data?.find((t) => t.id === picked) ?? null

  const importRec = useImportRecording()
  const fileInput = useRef<HTMLInputElement>(null)

  return (
    <Page
      fit
      title="Review"
      description="Task 를 고르고 녹화한 에피소드를 재생해 승인, 거절하거나 지웁니다. 승인한 에피소드만 Convert 에서 변환할 수 있습니다."
      actions={
        <div className="flex items-center gap-3">
          {importRec.data && !importRec.isPending && (
            <span className="text-xs text-muted-foreground">{importRec.data.file} 을 가져왔습니다.</span>
          )}
          <ErrorNote error={importRec.error} className="max-w-80" />
          <input
            ref={fileInput}
            type="file"
            accept=".mcap"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importRec.mutate(file)
              e.target.value = ""
            }}
          />
          <Button variant="outline" size="lg" disabled={importRec.isPending} onClick={() => fileInput.current?.click()}>
            <LuUpload />
            {importRec.isPending ? "Importing…" : "Import MCAP"}
          </Button>
        </div>
      }
    >
      {task ? (
        <ReviewWorkspace key={task.id} taskId={task.id} taskPicker={<TaskPicker task={task} onSelect={setPicked} />} />
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <EmptyState className="grid min-h-[28rem] place-items-center rounded-lg bg-stage py-0 text-sm">
            {tasks.data?.length ? "오른쪽에서 Task 를 고르면 에피소드가 표시됩니다." : "Capture 에서 녹화하면 여기에 표시됩니다."}
          </EmptyState>
          <Panel className="min-h-0 gap-4">
            <QueryNote query={tasks} />
            {tasks.data?.length === 0 && <p className="text-[13px] text-muted-foreground">{NO_TASK}</p>}
            {!!tasks.data?.length && (
              // Same spot as ReviewWorkspace's picker so it doesn't move once a task is picked
              <div className="grid gap-1.5">
                <span className="text-xs text-muted-foreground">Task</span>
                <TaskPicker task={null} onSelect={setPicked} />
              </div>
            )}
          </Panel>
        </div>
      )}
    </Page>
  )
}

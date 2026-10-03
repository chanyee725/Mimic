import { useRef } from "react"
import { LuFileUp } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useImportTask } from "@/api/tasks"
import type { Task } from "@/domain/task"
import { useDraftOnOpen } from "@/hooks/use-draft-on-open"

import { errorText } from "../lib"

/** Create a task from YAML text, pasted or read from a file; line errors from the server show below */
export function ImportYamlDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (task: Task) => void
}) {
  const [text, setText] = useDraftOnOpen(open, "")
  const fileRef = useRef<HTMLInputElement>(null)
  const importTask = useImportTask()

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) importTask.reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import YAML</DialogTitle>
          <DialogDescription>YAML 탭에서 내보낸 형식 그대로 붙여넣거나 파일을 고르세요. 새 Task는 Draft로 만들어집니다.</DialogDescription>
        </DialogHeader>
        <Textarea
          aria-label="Task YAML"
          rows={14}
          className="font-mono text-xs"
          placeholder="task_id: my-task"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          ref={fileRef}
          type="file"
          accept=".yaml,.yml,text/yaml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void file.text().then(setText)
            e.target.value = ""
          }}
        />
        {importTask.isError && <p className="text-[13px] whitespace-pre-line text-bad">{errorText(importTask.error)}</p>}
        <DialogFooter>
          <Button variant="ghost" className="mr-auto" onClick={() => fileRef.current?.click()}>
            <LuFileUp />
            Choose file
          </Button>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            disabled={!text.trim() || importTask.isPending}
            onClick={() =>
              importTask.mutate(text, {
                onSuccess: (task) => {
                  onOpenChange(false)
                  onImported(task)
                },
              })
            }
          >
            {importTask.isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

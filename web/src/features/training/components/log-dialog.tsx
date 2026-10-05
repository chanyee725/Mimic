import { useEffect, useRef, useState } from "react"
import { LuScrollText } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { useJobCommand, useJobLog } from "@/api/training"
import { isActive, type TrainJob } from "@/domain/training"

/** "Log" button and a dialog with the end of the job's train.log, following it while the job is active */
export function LogDialog({ job }: { job: TrainJob }) {
  const [open, setOpen] = useState(false)
  const live = isActive(job)
  const log = useJobLog(job.id, { enabled: open, live: open && live })
  const command = useJobCommand(open ? job.id : undefined)
  const box = useRef<HTMLPreElement>(null)
  // Stay at the bottom while new lines arrive, unless the user scrolled up to read
  const pinned = useRef(true)
  useEffect(() => {
    const el = box.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [log.data])

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          pinned.current = true
          setOpen(true)
        }}
      >
        <LuScrollText />
        Log
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-3 sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Training log</DialogTitle>
            <DialogDescription>
              {live ? "lerobot-train 출력을 2초마다 새로 읽습니다." : "lerobot-train 출력의 마지막 부분입니다."}
              {log.data?.truncated && " 앞부분은 생략했습니다."}
            </DialogDescription>
          </DialogHeader>
          {command.data && (
            <code className="block truncate rounded-md bg-muted px-3 py-2 text-[11px] text-muted-foreground" title={command.data.command}>
              {command.data.command}
            </code>
          )}
          {log.isPending ? (
            <LoadingNote />
          ) : log.isError ? (
            <ErrorNote error={log.error} onRetry={() => log.refetch()} />
          ) : (
            <pre
              ref={box}
              onScroll={(e) => {
                const el = e.currentTarget
                pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
              }}
              className="h-[60vh] overflow-auto rounded-md border bg-stage p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
            >
              {log.data.lines.length ? log.data.lines.join("\n") : "아직 출력이 없습니다."}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

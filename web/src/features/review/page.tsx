import { useState } from "react"
import { LuCheck, LuTrash2, LuUpload, LuX } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { StatusDot } from "@/components/app/status-dot"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { RecordingReview } from "@/dummy/recordings"
import { cn } from "@/lib/utils"
import { deleteRecording, setReview, useRecordings } from "@/lib/recordings-store"
import { McapPlayer } from "./components/mcap-player"
import { RecordingList } from "./components/recording-list"

const REVIEW_TONE = { pending: "muted", accepted: "ok", rejected: "bad" } as const

export function ReviewPage() {
  const recordings = useRecordings()
  const [selectedId, setSelectedId] = useState<string | null>(recordings[0]?.id ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const selected = recordings.find((r) => r.id === selectedId) ?? null

  const review = (id: string, value: RecordingReview) => {
    setReview(id, value)
  }

  const remove = (id: string) => {
    const idx = recordings.findIndex((r) => r.id === id)
    const next = recordings.filter((r) => r.id !== id)
    deleteRecording(id)
    setSelectedId(next[Math.min(idx, next.length - 1)]?.id ?? null)
    setConfirmDelete(false)
  }

  return (
    <Page
      fit
      title="Review"
      description="녹화한 MCAP 에피소드를 재생해 보고 승인, 거절하거나 지웁니다. 승인한 에피소드만 Convert 에서 변환할 수 있습니다."
      actions={
        <Button variant="outline" size="lg">
          <LuUpload />
          Import MCAP
        </Button>
      }
    >
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
        <Panel className="min-h-80 gap-2 p-3">
          <RecordingList
            recordings={recordings}
            selectedId={selectedId}
            onSelect={setSelectedId}
            className="min-h-0 flex-1"
          />
        </Panel>

        <Panel className="min-h-[28rem] gap-3">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid min-w-0 gap-0.5">
                  <h2 className="truncate text-base font-semibold">{selected.file}</h2>
                  <p className="text-[13px] text-muted-foreground tabular-nums">
                    {selected.source === "capture"
                      ? `${selected.taskId}, episode ${selected.episode}, recorded ${selected.recordedAt}`
                      : `Imported file, recorded ${selected.recordedAt}`}
                    {`, ${selected.durationS.toFixed(1)} s, ${selected.sizeMB} MB`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusDot tone={REVIEW_TONE[selected.review]} className="mr-1.5 text-[13px] text-muted-foreground">
                    {selected.review}
                  </StatusDot>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => review(selected.id, "accepted")}
                    disabled={selected.review === "accepted"}
                  >
                    <LuCheck />
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => review(selected.id, "rejected")}
                    disabled={selected.review === "rejected"}
                  >
                    <LuX />
                    Reject
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete recording"
                    title="Delete recording"
                    className="text-bad hover:text-bad"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <LuTrash2 />
                  </Button>
                </div>
              </div>

              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {selected.checks.map((c) => (
                  <li key={c.label}>
                    <StatusDot tone={c.ok ? "ok" : "bad"} className="text-xs text-muted-foreground">
                      {c.label} <span className={cn("tabular-nums", c.ok ? "text-foreground" : "text-bad")}>{c.value}</span>
                    </StatusDot>
                  </li>
                ))}
              </ul>

              <McapPlayer key={selected.id} recording={selected} className="min-h-0 flex-1" />
            </>
          ) : (
            <p className="m-auto text-sm text-muted-foreground">재생할 에피소드를 왼쪽 목록에서 선택하세요.</p>
          )}
        </Panel>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete recording?</DialogTitle>
            <DialogDescription>{selected?.file} 파일을 삭제합니다. 삭제한 MCAP 은 되돌릴 수 없습니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button className="bg-destructive text-white hover:bg-destructive/90" onClick={() => selected && remove(selected.id)}>
              Delete recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

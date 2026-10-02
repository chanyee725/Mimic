import { Button } from "@/components/ui/button"

/** 바뀐 값이 있을 때만 섹션 아래에 뜬다 */
export function SaveBar({ dirty, onSave, onReset }: { dirty: boolean; onSave: () => void; onReset: () => void }) {
  if (!dirty) return null
  return (
    <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3">
      <span className="text-xs text-muted-foreground">저장하지 않은 변경 사항이 있습니다.</span>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onReset}>
          Discard
        </Button>
        <Button size="sm" onClick={onSave}>
          Save changes
        </Button>
      </div>
    </div>
  )
}

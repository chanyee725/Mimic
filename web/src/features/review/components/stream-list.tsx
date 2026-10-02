import type { McapTopic } from "@/dummy/recordings"

/** 영상 · 관절 외 토픽 표 (관절 그래프를 그릴 수 없을 때) */
export function StreamList({ topics }: { topics: McapTopic[] }) {
  return (
    <div className="min-h-0 overflow-y-auto rounded-md border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-normal">Topic</th>
            <th className="px-3 py-2 font-normal">Schema</th>
            <th className="px-3 py-2 text-right font-normal">Rate</th>
            <th className="px-3 py-2 text-right font-normal">Messages</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {topics.map((t) => (
            <tr key={t.name}>
              <td className="max-w-48 truncate px-3 py-1.5">{t.name}</td>
              <td className="max-w-48 truncate px-3 py-1.5 text-muted-foreground">{t.schema}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{t.rateHz === null ? "event" : `${t.rateHz} Hz`}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{t.messages.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

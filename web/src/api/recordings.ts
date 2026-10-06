// Raw MCAP recordings and their review state — spec: docs/api/recordings.md
import { type InfiniteData, useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query"

import type { Recording, RecordingReview, RecordingSamples, RecordingSource, SampleTopic } from "@/domain/recording"
import type { TaskWorld } from "@/domain/task"

import { API_BASE, ApiError, api, type Page } from "./client"
import { qk, queryClient } from "./query"

export type RecordingFilter = {
  taskId?: string
  review?: RecordingReview
  source?: RecordingSource
  /** Episodes recorded on a real or an Isaac Sim rig */
  kind?: TaskWorld
  /** newest first (default), or lowest episode number first */
  order?: "newest" | "episode"
}

const PAGE_SIZE = 200

/** Cursor-paged in `filter.order`; flatten `data.pages` for the full list */
export function useRecordings(filter: RecordingFilter = {}) {
  return useInfiniteQuery({
    queryKey: [...qk.recordings, "list", filter],
    queryFn: ({ pageParam }) => api.get<Page<Recording>>("/recordings", { ...filter, limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  })
}

export function useRecording(id: string | undefined) {
  return useQuery({
    queryKey: [...qk.recordings, "detail", id],
    queryFn: () => api.get<Recording>(`/recordings/${encodeURIComponent(id!)}`),
    enabled: !!id,
  })
}

export function useSetReview() {
  return useMutation({
    mutationFn: ({ id, review }: { id: string; review: RecordingReview }) =>
      api.patch<Recording>(`/recordings/${encodeURIComponent(id)}`, { review }),
    onSuccess: (r) => {
      queryClient.setQueryData([...qk.recordings, "detail", r.id], r)
      queryClient.invalidateQueries({ queryKey: [...qk.recordings, "list"] })
      queryClient.invalidateQueries({ queryKey: qk.convert })
    },
  })
}

/**
 * Take deleted recordings out of the cached lists right away (so the player moves off them) and drop their detail and
 * samples queries, so the refetch that follows doesn't hit a 404.
 */
function forget(ids: string[]) {
  const gone = new Set(ids)
  queryClient.setQueriesData<InfiniteData<Page<Recording>>>(
    { queryKey: [...qk.recordings, "list"] },
    (d) => d && { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.filter((r) => !gone.has(r.id)) })) },
  )
  queryClient.removeQueries({ queryKey: qk.recordings, predicate: (q) => q.queryKey.some((k) => gone.has(k as string)) })
}

export function useDeleteRecording() {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/recordings/${encodeURIComponent(id)}`),
    onSuccess: (_, id) => {
      forget([id])
      for (const key of [qk.recordings, qk.convert, qk.tasks]) queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/** Accept / Reject many recordings in one request */
export function useBulkReview() {
  return useMutation({
    mutationFn: ({ ids, review }: { ids: string[]; review: RecordingReview }) =>
      api.post<{ items: Recording[] }>("/recordings/bulk-review", { ids, review }),
    onSuccess: ({ items }) => {
      for (const r of items) queryClient.setQueryData([...qk.recordings, "detail", r.id], r)
      queryClient.invalidateQueries({ queryKey: [...qk.recordings, "list"] })
      queryClient.invalidateQueries({ queryKey: qk.convert })
    },
  })
}

/** Deletes many recordings in one request; 404 (nothing deleted) if any id is gone */
export function useBulkDelete() {
  return useMutation({
    mutationFn: (ids: string[]) => api.post("/recordings/bulk-delete", { ids }),
    onSuccess: (_, ids) => {
      forget(ids)
      for (const key of [qk.recordings, qk.convert, qk.tasks]) queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export type SamplesQuery = { topics: SampleTopic[]; fromS?: number; toS?: number; hz?: number }

/** Joint series resampled for the Review plots */
export function useRecordingSamples(id: string | undefined, { topics, fromS, toS, hz }: SamplesQuery) {
  return useQuery({
    queryKey: [...qk.recordings, "samples", id, { topics, fromS, toS, hz }],
    queryFn: () => api.get<RecordingSamples>(`/recordings/${encodeURIComponent(id!)}/samples`, { topics, fromS, toS, hz }),
    enabled: !!id && topics.length > 0,
    staleTime: Infinity, // recorded data does not change
  })
}

/** Uploads an external .mcap file (multipart) */
export function useImportRecording() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(`${API_BASE}/recordings/import`, { method: "POST", body: form })
      if (!res.ok) {
        const e = (await res.json().catch(() => null))?.error
        throw new ApiError(res.status, e?.code ?? "error", e?.message ?? res.statusText, e?.details ?? {})
      }
      return (await res.json()) as Recording
    },
    onSuccess: (r) => {
      queryClient.setQueryData([...qk.recordings, "detail", r.id], r)
      queryClient.invalidateQueries({ queryKey: [...qk.recordings, "list"] })
    },
  })
}

/** MCAP download (501 until storage exists) */
export const recordingFileUrl = (id: string) => `${API_BASE}/recordings/${encodeURIComponent(id)}/file`

/** Camera video (H.264 mp4, Range support); the first request builds it from the episode frames */
export const recordingVideoUrl = (id: string, camera: string) =>
  `${API_BASE}/recordings/${encodeURIComponent(id)}/video/${encodeURIComponent(camera)}`

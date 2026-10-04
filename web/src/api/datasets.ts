// Conversion to LeRobot, datasets and HF Hub push — spec: docs/api/datasets.md
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query"

import type { ConvertPreview, Dataset, DatasetEpisode, DatasetKind, MergePreview } from "@/domain/dataset"

import { API_BASE, api, type Page } from "./client"
import { qk, queryClient } from "./query"

// repoId is "<namespace>/<name>"; the backend accepts it URL-encoded
const path = (repoId: string) => `/datasets/${encodeURIComponent(repoId)}`
const detailKey = (repoId: string) => [...qk.datasets, "detail", repoId]

/** Newest first */
export function useDatasets(filter: { kind?: DatasetKind; q?: string } = {}) {
  return useQuery({
    queryKey: [...qk.datasets, "list", filter],
    queryFn: () => api.get<Dataset[]>("/datasets", filter),
    placeholderData: keepPreviousData,
  })
}

export function useDataset(repoId: string | undefined) {
  return useQuery({
    queryKey: detailKey(repoId ?? ""),
    queryFn: () => api.get<Dataset>(path(repoId!)),
    enabled: !!repoId,
  })
}

/** Cursor-paged episodes of one dataset; flatten `data.pages` */
export function useDatasetEpisodes(repoId: string | undefined) {
  return useInfiniteQuery({
    queryKey: [...qk.datasets, "episodes", repoId],
    queryFn: ({ pageParam }) => api.get<Page<DatasetEpisode>>(`${path(repoId!)}/episodes`, { limit: 200, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled: !!repoId,
  })
}

/** Summary of converting the task's accepted recordings minus `exclude` */
export function useConvertPreview(taskId: string | undefined, exclude: string[] = []) {
  const ids = [...exclude].sort()
  return useQuery({
    queryKey: [...qk.convert, "preview", taskId, ids],
    queryFn: () => api.get<ConvertPreview>("/convert/preview", { taskId, exclude: ids }),
    enabled: !!taskId,
    placeholderData: keepPreviousData,
  })
}

const cacheDataset = (d: Dataset) => {
  queryClient.setQueryData(detailKey(d.repoId), d)
  queryClient.invalidateQueries({ queryKey: [...qk.datasets, "list"] })
}

/** Starts a conversion; returns the dataset in "converting" (progress via dataset.updated events) */
export function useConvert() {
  return useMutation({
    mutationFn: (body: { taskId: string; repoId: string; exclude?: string[] }) =>
      api.post<Dataset>("/convert", { ...body, format: "lerobot_v3" }),
    onSuccess: cacheDataset,
  })
}

/** Summary and problems of merging `sources` in order (empty problems = mergeable) */
export function useMergePreview(sources: string[]) {
  return useQuery({
    queryKey: [...qk.datasets, "merge-preview", sources],
    queryFn: () => api.get<MergePreview>("/datasets/merge/preview", { sources }),
    enabled: sources.length > 0,
    placeholderData: keepPreviousData,
  })
}

/**
 * Merges ready LeRobot datasets into a new one; returns it in "converting" (progress via dataset.updated events).
 * 409 when repoId exists, 422 when not mergeable (`details.problems`)
 */
export function useMergeDatasets() {
  return useMutation({
    mutationFn: (body: { sources: string[]; repoId: string }) => api.post<Dataset>("/datasets/merge", body),
    onSuccess: (d) => {
      cacheDataset(d)
      return queryClient.invalidateQueries({ queryKey: qk.datasets })
    },
  })
}

export function usePushDataset() {
  return useMutation({
    mutationFn: ({ repoId, private: isPrivate }: { repoId: string; private: boolean }) =>
      api.post<Dataset>(`${path(repoId)}/push`, { private: isPrivate }),
    onSuccess: cacheDataset,
  })
}

/** Deletes a dataset (cancels a running conversion) */
export function useDeleteDataset() {
  return useMutation({
    mutationFn: (repoId: string) => api.delete(path(repoId)),
    onSuccess: (_, repoId) => {
      queryClient.removeQueries({ queryKey: detailKey(repoId) })
      queryClient.removeQueries({ queryKey: [...qk.datasets, "episodes", repoId] })
      queryClient.invalidateQueries({ queryKey: [...qk.datasets, "list"] })
    },
  })
}

/** First camera frame of the first episode (501 until storage exists) */
export const datasetThumbnailUrl = (repoId: string) => `${API_BASE}${path(repoId)}/thumbnail`

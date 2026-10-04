// Saved models — docs/api/models.md
import { useMutation, useQuery } from "@tanstack/react-query"

import type { Model, ModelFile, ModelLocation } from "@/domain/model"

import { API_BASE, api } from "./client"
import { qk, queryClient } from "./query"

const modelKey = (id: string) => [...qk.models, "detail", id] as const

/** Models, newest first */
export const useModels = ({ taskId, location }: { taskId?: string; location?: ModelLocation } = {}) =>
  useQuery({ queryKey: [...qk.models, "list", { taskId, location }], queryFn: () => api.get<Model[]>("/models", { taskId, location }) })

export const useModel = (id: string | undefined) =>
  useQuery({ queryKey: modelKey(id ?? ""), queryFn: () => api.get<Model>(`/models/${id}`), enabled: !!id })

/** Files inside the saved lerobot checkpoint folder */
export const useModelFiles = (id: string | undefined) =>
  useQuery({ queryKey: [...qk.models, "files", id], queryFn: () => api.get<ModelFile[]>(`/models/${id}/files`), enabled: !!id })

const onModel = (m: Model) => {
  queryClient.setQueryData(modelKey(m.id), m)
  return queryClient.invalidateQueries({ queryKey: qk.models })
}

export const useRenameModel = () =>
  useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.patch<Model>(`/models/${id}`, { name }),
    onSuccess: onModel,
  })

/** Delete a model and its local folder */
export const useDeleteModel = () =>
  useMutation({
    mutationFn: (id: string) => api.delete(`/models/${id}`),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: modelKey(id) })
      return queryClient.invalidateQueries({ queryKey: qk.models })
    },
  })

/** Push to the HF Hub; repo defaults to <hf namespace>/smolvla_<task> */
export const usePushModel = () =>
  useMutation({
    mutationFn: ({ id, ...body }: { id: string; repo?: string; private?: boolean }) => api.post<Model>(`/models/${id}/push`, body),
    onSuccess: onModel,
  })

/** Zip download of the model folder (501 until storage lands) */
export const modelDownloadUrl = (id: string) => `${API_BASE}/models/${id}/download`

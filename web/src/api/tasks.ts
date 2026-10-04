// Tasks and task YAML — docs/api/tasks.md
import { useMutation, useQuery } from "@tanstack/react-query"

import type { Task, TaskInput, TaskStatus, TaskUpdate } from "@/domain/task"

import { api } from "./client"
import { qk, queryClient } from "./query"

const taskKey = (id: string) => [...qk.tasks, "detail", id] as const

const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: qk.tasks })

/** Store the returned task and refetch the lists */
function onTaskSaved(task: Task) {
  queryClient.setQueryData(taskKey(task.id), task)
  return invalidateTasks()
}

export const useTasks = (status?: TaskStatus) =>
  useQuery({ queryKey: [...qk.tasks, "list", status ?? null], queryFn: () => api.get<Task[]>("/tasks", { status }) })

export const useTask = (id: string | undefined) =>
  useQuery({ queryKey: taskKey(id ?? ""), queryFn: () => api.get<Task>(`/tasks/${id}`), enabled: !!id })

/** Task file as YAML text (export → import round-trips) */
export const useTaskYaml = (id: string | undefined) =>
  useQuery({ queryKey: [...qk.tasks, "yaml", id ?? ""], queryFn: () => api.get<string>(`/tasks/${id}/yaml`), enabled: !!id })

/** 409 if the id exists */
export const useCreateTask = () => useMutation({ mutationFn: (body: TaskInput) => api.post<Task>("/tasks", body), onSuccess: onTaskSaved })

/** 409 on a stale version (`ApiError.details.current` holds the current task) */
export const useUpdateTask = () =>
  useMutation({
    mutationFn: ({ id, body }: { id: string; body: TaskUpdate }) => api.put<Task>(`/tasks/${id}`, body),
    onSuccess: onTaskSaved,
  })

/** Copy a task under a new id and name (the copy starts as draft) */
export const useDuplicateTask = () =>
  useMutation({
    mutationFn: ({ sourceId, id, name }: { sourceId: string; id: string; name: string }) =>
      api.post<Task>(`/tasks/${sourceId}/duplicate`, { id, name }),
    onSuccess: onTaskSaved,
  })

/** 409 if the task has recordings (`ApiError.details.recordings` = count) */
export const useDeleteTask = () =>
  useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: taskKey(id) })
      void queryClient.invalidateQueries({ queryKey: qk.station })
      return invalidateTasks()
    },
  })

/** Create a task from YAML text; 422 lists `details.errors = [{ line, loc, msg }]`, 409 if task_id exists */
export const useImportTask = () =>
  useMutation({ mutationFn: (yaml: string) => api.post<Task>("/tasks/import", yaml), onSuccess: onTaskSaved })

// Rigs and rig YAML (read-only) — docs/api/rigs.md
import { useQuery } from "@tanstack/react-query"

import type { Rig } from "@/domain/rig"

import { ApiError, api } from "./client"
import { qk } from "./query"

export const useRigs = () => useQuery({ queryKey: [...qk.rigs, "list"], queryFn: () => api.get<Rig[]>("/rigs") })

/** Falls back to the first rig when the id is unknown (404) */
export const useRig = (id: string | undefined) =>
  useQuery({
    queryKey: [...qk.rigs, "detail", id ?? ""],
    queryFn: async () => {
      try {
        return await api.get<Rig>(`/rigs/${id}`)
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e
        const [first] = await api.get<Rig[]>("/rigs")
        if (!first) throw e
        return first
      }
    },
    enabled: !!id,
  })

/** Rig config as YAML text */
export const useRigYaml = (id: string | undefined) =>
  useQuery({ queryKey: [...qk.rigs, "yaml", id ?? ""], queryFn: () => api.get<string>(`/rigs/${id}/yaml`), enabled: !!id })

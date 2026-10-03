// Settings, secrets, connection tests, disk, shortcuts, versions — docs/api/settings.md
import { useMutation, useQuery } from "@tanstack/react-query"

import type {
  ConnTestResult,
  Disk,
  Secret,
  SecretName,
  Settings,
  SettingsPatch,
  SettingsSection,
  ShortcutGroup,
  TestTarget,
  VersionRow,
} from "@/domain/settings"

import { api } from "./client"
import { qk, queryClient } from "./query"

const settingsKey = [...qk.settings, "doc"] as const

const invalidateSettings = () => queryClient.invalidateQueries({ queryKey: settingsKey })

export const useSettings = () => useQuery({ queryKey: settingsKey, queryFn: () => api.get<Settings>("/settings") })

/** Save one section; `body` carries the document `version` (409 on stale, `ApiError.details.current` = whole document) */
export const usePatchSettings = () =>
  useMutation({
    mutationFn: ({ section, body }: { section: SettingsSection; body: SettingsPatch }) => api.patch<Settings>(`/settings/${section}`, body),
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsKey, settings)
      // storage paths change disk usage (the sim environments folder comes from .env, not settings)
      return queryClient.invalidateQueries({ queryKey: [...qk.settings, "disk"] })
    },
  })

/** Write-only secret (min 8 chars); resets the related integration state to unknown */
export const useSetSecret = () =>
  useMutation({
    mutationFn: ({ name, value }: { name: SecretName; value: string }) => api.put<Secret>(`/settings/secrets/${name}`, { value }),
    onSuccess: invalidateSettings,
  })

export const useDeleteSecret = () =>
  useMutation({ mutationFn: (name: SecretName) => api.delete<Secret>(`/settings/secrets/${name}`), onSuccess: invalidateSettings })

/** The result is also stored in the matching `state` (and `latencyMs`) of the settings document */
export const useTestConnection = () =>
  useMutation({ mutationFn: (target: TestTarget) => api.post<ConnTestResult>(`/settings/test/${target}`), onSuccess: invalidateSettings })

export const useDiskUsage = () => useQuery({ queryKey: [...qk.settings, "disk"], queryFn: () => api.get<Disk>("/settings/disk") })

export const useShortcuts = () =>
  useQuery({ queryKey: [...qk.settings, "shortcuts"], queryFn: () => api.get<ShortcutGroup[]>("/settings/shortcuts"), staleTime: Infinity })

export const useVersions = () =>
  useQuery({ queryKey: [...qk.settings, "versions"], queryFn: () => api.get<VersionRow[]>("/settings/versions"), staleTime: Infinity })

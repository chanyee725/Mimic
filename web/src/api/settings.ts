import { DISK, SETTINGS, SHORTCUTS, VERSIONS } from "@/dummy/settings"
import type { Settings } from "@/domain/settings"

export const getSettings = (): Settings => SETTINGS
export const getDiskUsage = () => DISK
export const getShortcuts = () => SHORTCUTS
export const getVersions = () => VERSIONS

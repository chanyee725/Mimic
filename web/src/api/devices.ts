// Devices, ports, connection test and calibration — docs/api/rigs.md (changes also arrive as device.updated events)
import { useMutation, useQuery } from "@tanstack/react-query"

import type { CalibrationSession, Device, Port } from "@/domain/device"
import { isCalibrating } from "@/domain/device"

import { API_BASE, api } from "./client"
import { qk, queryClient } from "./query"

const deviceKey = (id: string) => [...qk.devices, "detail", id] as const
const calibrationKey = (id: string) => [...qk.devices, "calibration", id] as const

export const useDevices = () => useQuery({ queryKey: [...qk.devices, "list"], queryFn: () => api.get<Device[]>("/devices") })

/** Devices registered in a rig, in Robot → Device → Camera order */
export const useRigDevices = (rigId: string | undefined) =>
  useQuery({
    queryKey: [...qk.devices, "rig", rigId ?? ""],
    queryFn: () => api.get<Device[]>(`/rigs/${rigId}/devices`),
    enabled: !!rigId,
  })

export const useDevice = (id: string | undefined) =>
  useQuery({ queryKey: deviceKey(id ?? ""), queryFn: () => api.get<Device>(`/devices/${id}`), enabled: !!id })

/** Serial and video ports found on the station now (scanned on every fetch) */
export const usePorts = () =>
  useQuery({ queryKey: [...qk.devices, "ports"], queryFn: () => api.get<Port[]>("/devices/ports"), staleTime: 0 })

/** Live MJPEG preview of a scanned video port, for an <img src>. One reader per camera: unmount the image to release it */
export const portPreviewUrl = (path: string) => `${API_BASE}/devices/ports/preview?path=${encodeURIComponent(path)}`

const updated = (device: Device) => {
  queryClient.setQueryData(deviceKey(device.id), device)
  return queryClient.invalidateQueries({ queryKey: qk.devices })
}

/** Port the device uses on this station (written into its rig file); clears the last test */
export const useSetDevicePort = () =>
  useMutation({
    mutationFn: ({ id, port }: { id: string; port: string }) => api.put<Device>(`/devices/${id}/port`, { port }),
    onSuccess: updated,
  })

/** Connection test (about a second). A failed test comes back as `check.ok: false`; 503 when LeRobot is unavailable */
export const useTestDevice = () => useMutation({ mutationFn: (id: string) => api.post<Device>(`/devices/${id}/test`), onSuccess: updated })

/** Calibration session of an arm; polled while it runs (live joint positions). 404 when there is none */
export const useCalibration = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: calibrationKey(id),
    queryFn: () => api.get<CalibrationSession>(`/devices/${id}/calibration`),
    enabled,
    retry: false,
    refetchInterval: (q) => (isCalibrating(q.state.data) ? 100 : false),
  })

const sessionChanged = (s: CalibrationSession) => {
  queryClient.setQueryData(calibrationKey(s.deviceId), s)
  return queryClient.invalidateQueries({ queryKey: [...qk.devices, "rig"] })
}

/** Opens the arm with torque off and waits in the center step. 409 if already calibrating, 503 if the port fails */
export const useStartCalibration = () =>
  useMutation({ mutationFn: (id: string) => api.post<CalibrationSession>(`/devices/${id}/calibrate`), onSuccess: sessionChanged })

/** center → range → done. 409 (details.motors) while some joints have not moved */
export const useNextCalibrationStep = () =>
  useMutation({ mutationFn: (id: string) => api.post<CalibrationSession>(`/devices/${id}/calibration/next`), onSuccess: sessionChanged })

export const useCancelCalibration = () =>
  useMutation({
    mutationFn: (id: string) => api.delete(`/devices/${id}/calibration`),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: calibrationKey(id) })
      return queryClient.invalidateQueries({ queryKey: qk.devices })
    },
  })

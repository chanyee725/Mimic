// Devices and calibration — docs/api/rigs.md (live health / measuredHz arrive as device.updated events)
import { useMutation, useQuery } from "@tanstack/react-query"

import type { Device } from "@/domain/device"

import { api } from "./client"
import { qk, queryClient } from "./query"

const deviceKey = (id: string) => [...qk.devices, "detail", id] as const

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

/**
 * Start calibration (variable: device id). Returns the device with `calibration.done: false`; the result arrives as a
 * device.updated event. 409 if already calibrating, 503 if the device is off.
 */
export const useCalibrateDevice = () =>
  useMutation({
    mutationFn: (id: string) => api.post<Device>(`/devices/${id}/calibrate`),
    onSuccess: (device) => {
      queryClient.setQueryData(deviceKey(device.id), device)
      return queryClient.invalidateQueries({ queryKey: qk.devices })
    },
  })

import { DEVICES, STATION_WARNINGS, devicesOf as rigDevices } from "@/dummy/devices"
import type { Device } from "@/domain/device"

export const listDevices = (): Device[] => DEVICES
/** Devices registered in a rig, in Robot → Device → Camera order */
export const devicesOf = (rigId: string): Device[] => rigDevices(rigId)
export const getStationWarnings = (): string[] => STATION_WARNINGS

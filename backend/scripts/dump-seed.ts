// Exports web/src/dummy to backend/app/seeds/data/*.json. Run from web/ (see backend/README.md).
import { writeFileSync } from "node:fs"
import * as activity from "@/dummy/activity"
import * as datasets from "@/dummy/datasets"
import * as devices from "@/dummy/devices"
import * as models from "@/dummy/models"
import * as recordings from "@/dummy/recordings"
import * as rigs from "@/dummy/rigs"
import * as sessions from "@/dummy/sessions"
import * as settings from "@/dummy/settings"
import * as simulation from "@/dummy/simulation"
import * as station from "@/dummy/station"
import * as tasks from "@/dummy/tasks"
import * as training from "@/dummy/training"

const mods = { activity, datasets, devices, models, recordings, rigs, sessions, settings, simulation, station, tasks, training }
for (const [name, mod] of Object.entries(mods)) {
  const data = Object.fromEntries(Object.entries(mod).filter(([, v]) => typeof v !== "function"))
  writeFileSync(`../backend/app/seeds/data/${name}.json`, JSON.stringify(data, null, 2) + "\n")
}

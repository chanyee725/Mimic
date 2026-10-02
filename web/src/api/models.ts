import { MODELS, MODEL_FILES, getModel as findModel } from "@/dummy/models"
import type { Model } from "@/domain/model"

export const listModels = (): Model[] => MODELS
export const getModel = (id: string): Model | undefined => findModel(id)
/** Files inside a saved lerobot checkpoint folder */
export const getModelFiles = () => MODEL_FILES

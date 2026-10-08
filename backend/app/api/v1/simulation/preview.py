"""Static 3D previews (GLB) of robot and tool USDs for the web viewer."""

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.services import simulation as service

router = APIRouter()

GLB = "model/gltf-binary"


@router.get("/robots/{robot_id}/model.glb", response_class=FileResponse)
def robot_model(robot_id: str):
    return FileResponse(service.preview_model("robot", robot_id), media_type=GLB)


@router.get("/tools/{tool_id}/model.glb", response_class=FileResponse)
def tool_model(tool_id: str):
    return FileResponse(service.preview_model("tool", tool_id), media_type=GLB)

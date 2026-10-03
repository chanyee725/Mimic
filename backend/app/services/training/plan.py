"""Validation of a new training job request (dataset, overrides, GPU and RunPod options)."""

from app.core.errors import ApiError, conflict
from app.schemas.training import JobCreate, LocalGpu, RunPodOptions
from app.services.training import config as cfg
from app.services.training import params


def invalid(msg: str, *loc: str) -> ApiError:
    return ApiError(422, msg, {"errors": [{"loc": ["body", *loc], "msg": msg}]})


class Plan:
    """A validated POST /training/jobs body."""

    def __init__(self, body: JobCreate, local_gpus: list[LocalGpu]) -> None:
        if body.dataset not in cfg.trainable_datasets():
            raise invalid("Dataset is not a ready LeRobot dataset", "dataset")
        if errors := params.check_overrides(body.overrides):
            raise ApiError(422, "Unknown or invalid training parameters", {"errors": errors})
        self.body = body
        self.options: RunPodOptions | None = None
        self.base_price: float | None = None
        if body.compute == "local":
            gpu = next((g for g in local_gpus if body.gpu in (g.id, g.name)), None)
            if gpu is None:
                raise invalid("Unknown local GPU", "gpu")
            self.gpu_name = gpu.name
            return
        rp = next((g for g in cfg.runpod_gpus() if g.name == body.gpu), None)
        if rp is None:
            raise invalid("Unknown RunPod GPU", "gpu")
        if rp.stock == "none":
            raise conflict(f"RunPod GPU '{rp.name}' is out of stock")
        o = body.runpod or cfg.runpod_defaults()
        if o.cloud == "community" and not rp.community:
            raise invalid("GPU is not offered on the community cloud", "runpod", "cloud")
        if o.region not in cfg.runpod_regions():
            raise invalid("Unknown RunPod region", "runpod", "region")
        if o.volume not in {v.id for v in cfg.runpod_volumes()}:
            raise invalid("Unknown RunPod volume", "runpod", "volume")
        self.gpu_name, self.options, self.base_price = rp.name, o, rp.price_per_hr

    @property
    def rate(self) -> float | None:
        if self.options is None or self.base_price is None:
            return None
        return cfg.runpod_rate(self.base_price, self.options)

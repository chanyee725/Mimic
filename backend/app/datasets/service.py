"""Dataset store (in memory, seeded from the web mocks). Episodes are kept apart for paging."""

from app.core.clock import iso
from app.core.seed import load
from app.datasets.schemas import Dataset, DatasetEpisode

_datasets: dict[str, Dataset] = {}
_episodes: dict[str, list[DatasetEpisode]] = {}


def reset() -> None:
    _datasets.clear()
    _episodes.clear()
    for d in load("datasets", "DATASETS"):
        eps = d.pop("episodes")
        d["sizeGb"] = d.pop("sizeGB")
        d["createdAt"] = iso(d["createdAt"])
        d["episodeCount"] = len(eps)
        _datasets[d["repoId"]] = Dataset.model_validate(d)
        _episodes[d["repoId"]] = [DatasetEpisode.model_validate(e) for e in eps]


def list_datasets() -> list[Dataset]:
    return sorted(_datasets.values(), key=lambda d: d.created_at, reverse=True)


def get_dataset(repo_id: str) -> Dataset | None:
    return _datasets.get(repo_id)


def dataset_episodes(repo_id: str) -> list[DatasetEpisode]:
    return _episodes.get(repo_id, [])


reset()

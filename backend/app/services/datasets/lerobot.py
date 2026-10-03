"""LeRobot v3.0 dataset files, written and read with pyarrow (no lerobot dependency).

Layout (lerobot CODEBASE_VERSION "v3.0"):
  meta/info.json                                  features, fps, totals, chunk settings
  meta/stats.json                                 per-feature min / max / mean / std / count / q01…q99
  meta/tasks.parquet                              task (pandas index) → task_index
  meta/subtasks.parquet                           subtask (pandas index) → subtask_index (station extra)
  meta/episodes/chunk-000/file-000.parquet        one row per episode (lengths, file refs, stats/*)
  data/chunk-XXX/file-YYY.parquet                 one row per frame
No videos are written, so features hold only non-video columns and video_path is null.
"""

import json
from pathlib import Path
from typing import Any

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

CODEBASE_VERSION = "v3.0"
CHUNKS_SIZE = 1000
DATA_FILES_SIZE_MB = 100
VIDEO_FILES_SIZE_MB = 200
CHUNK_FILE = "chunk-{chunk_index:03d}/file-{file_index:03d}"
INFO_PATH = "meta/info.json"
STATS_PATH = "meta/stats.json"
TASKS_PATH = "meta/tasks.parquet"
SUBTASKS_PATH = "meta/subtasks.parquet"
EPISODES_DIR = "meta/episodes"
EPISODES_PATH = f"{EPISODES_DIR}/{CHUNK_FILE}.parquet"
DATA_PATH = f"data/{CHUNK_FILE}.parquet"
VIDEO_PATH = "videos/{video_key}/" + CHUNK_FILE + ".mp4"
QUANTILES = (0.01, 0.10, 0.50, 0.90, 0.99)
# Columns the writer numbers itself
WRITER_KEYS = ("episode_index", "index", "task_index")
SUBTASK_KEY = "subtask_index"
NO_SUBTASK = -1

_ARROW = {
    "float32": pa.float32(),
    "float64": pa.float64(),
    "int64": pa.int64(),
    "int32": pa.int32(),
    "int16": pa.int16(),
    "int8": pa.int8(),
    "uint8": pa.uint8(),
    "bool": pa.bool_(),
}


class FormatError(Exception):
    """A dataset folder is not a readable LeRobot v3.0 dataset, or a feature is unsupported."""


def feature(dtype: str, shape: list[int], names: list[str] | None = None) -> dict[str, Any]:
    return {"dtype": dtype, "shape": shape, "names": names}


def default_features() -> dict[str, dict[str, Any]]:
    """lerobot DEFAULT_FEATURES."""
    return {
        "timestamp": feature("float32", [1]),
        "frame_index": feature("int64", [1]),
        "episode_index": feature("int64", [1]),
        "index": feature("int64", [1]),
        "task_index": feature("int64", [1]),
    }


def arrow_type(ft: dict[str, Any]) -> pa.DataType:
    shape = list(ft["shape"])
    base = _ARROW.get(ft["dtype"])
    if base is None or len(shape) != 1:
        raise FormatError(f"Unsupported feature dtype {ft['dtype']} with shape {shape}")
    return base if shape == [1] else pa.list_(base, shape[0])


def is_video(ft: dict[str, Any]) -> bool:
    return ft.get("dtype") in ("video", "image")


def schema(features: dict[str, dict[str, Any]]) -> pa.Schema:
    return pa.schema([(k, arrow_type(ft)) for k, ft in features.items()])


def column(values: np.ndarray, ft: dict[str, Any]) -> pa.Array:
    """numpy (n,) or (n, d) → arrow column of the feature's type."""
    t = arrow_type(ft)
    if isinstance(t, pa.FixedSizeListType):
        flat = pa.array(np.ascontiguousarray(values).reshape(-1), type=t.value_type)
        return pa.FixedSizeListArray.from_arrays(flat, type=t)
    return pa.array(np.asarray(values).reshape(-1), type=t)


def to_numpy(col: pa.Array | pa.ChunkedArray) -> np.ndarray:
    """Arrow column → numpy (n,) or (n, d)."""
    if isinstance(col, pa.ChunkedArray):
        col = col.combine_chunks()
    if isinstance(col.type, pa.FixedSizeListType):
        flat = col.flatten().to_numpy(zero_copy_only=False)
        return flat.reshape(len(col), col.type.list_size)
    return col.to_numpy(zero_copy_only=False)


# --- stats -----------------------------------------------------------------


def _q(q: float) -> str:
    return f"q{round(q * 100):02d}"


def feature_stats(values: np.ndarray) -> dict[str, np.ndarray]:
    """Per-dimension stats of one episode (shape (d,), count (1,)), as lerobot computes them."""
    x = np.asarray(values, dtype=np.float64).reshape(len(values), -1)
    out = {
        "min": x.min(axis=0),
        "max": x.max(axis=0),
        "mean": x.mean(axis=0),
        "std": x.std(axis=0),
        "count": np.array([len(x)]),
    }
    for q in QUANTILES:
        out[_q(q)] = np.quantile(x, q, axis=0)
    return out


def aggregate_stats(items: list[dict[str, np.ndarray]]) -> dict[str, np.ndarray]:
    """Count-weighted merge of episode stats (pooled variance; quantiles weighted, like lerobot)."""
    counts = np.array([s["count"][0] for s in items], dtype=np.float64)
    total = counts.sum()
    w = counts[:, None] / total
    means = np.stack([s["mean"] for s in items])
    mean = (means * w).sum(axis=0)
    var = ((np.stack([s["std"] for s in items]) ** 2 + (means - mean) ** 2) * w).sum(axis=0)
    out = {
        "min": np.stack([s["min"] for s in items]).min(axis=0),
        "max": np.stack([s["max"] for s in items]).max(axis=0),
        "mean": mean,
        "std": np.sqrt(var),
        "count": np.array([int(total)]),
    }
    for q in QUANTILES:
        out[_q(q)] = (np.stack([s[_q(q)] for s in items]) * w).sum(axis=0)
    return out


def _json_stats(stats: dict[str, dict[str, np.ndarray]]) -> dict[str, dict[str, list]]:
    return {k: {s: v.tolist() for s, v in st.items()} for k, st in stats.items()}


# --- name tables (tasks / subtasks) -----------------------------------------


def _write_names(path: Path, index_name: str, names: list[str]) -> None:
    """Same file as pandas DataFrame({"<x>_index": …}, index=Index(names, name=<x>)).to_parquet()."""
    col = f"{index_name}_index"
    pandas_meta = {
        "index_columns": [index_name],
        "column_indexes": [
            {
                "name": None,
                "field_name": None,
                "pandas_type": "unicode",
                "numpy_type": "object",
                "metadata": {"encoding": "UTF-8"},
            }
        ],
        "columns": [
            {
                "name": col,
                "field_name": col,
                "pandas_type": "int64",
                "numpy_type": "int64",
                "metadata": None,
            },
            {
                "name": index_name,
                "field_name": index_name,
                "pandas_type": "unicode",
                "numpy_type": "object",
                "metadata": None,
            },
        ],
        "creator": {"library": "pyarrow", "version": pa.__version__},
        "pandas_version": "2.2.3",
    }
    table = pa.table(
        {col: pa.array(range(len(names)), pa.int64()), index_name: pa.array(names, pa.string())}
    ).replace_schema_metadata({b"pandas": json.dumps(pandas_meta).encode()})
    path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, path)


def read_names(root: Path, rel: str, index_name: str) -> list[str]:
    """Names ordered by their index ([] when the file is missing)."""
    path = root / rel
    if not path.is_file():
        return []
    t = pq.read_table(path)
    idx = t.column(f"{index_name}_index").to_pylist()
    names = t.column(index_name).to_pylist()
    out = [""] * (max(idx) + 1 if idx else 0)
    for i, n in zip(idx, names):
        out[i] = n
    return out


# --- reading ----------------------------------------------------------------


def read_info(root: Path) -> dict[str, Any]:
    path = root / INFO_PATH
    try:
        info = json.loads(path.read_text())
    except (OSError, ValueError) as e:
        raise FormatError(f"{INFO_PATH} could not be read: {e}") from e
    if not isinstance(info, dict) or not isinstance(info.get("features"), dict):
        raise FormatError(f"{INFO_PATH} has no features")
    if info.get("codebase_version") != CODEBASE_VERSION:
        raise FormatError(f"codebase_version {info.get('codebase_version')!r} is not v3.0")
    return info


def read_stats(root: Path) -> dict[str, dict[str, Any]]:
    path = root / STATS_PATH
    return json.loads(path.read_text()) if path.is_file() else {}


def read_episodes(root: Path, columns: list[str] | None = None) -> pa.Table:
    """Episode rows of every meta/episodes file, in episode order."""
    files = sorted((root / EPISODES_DIR).glob("chunk-*/file-*.parquet"))
    if not files:
        raise FormatError("meta/episodes has no parquet files")
    tables = [pq.read_table(f, columns=columns) for f in files]
    table = pa.concat_tables(tables) if len(tables) > 1 else tables[0]
    return table.sort_by("episode_index") if "episode_index" in table.column_names else table


def data_files(root: Path) -> list[Path]:
    return sorted((root / "data").glob("chunk-*/file-*.parquet"))


def folder_size(root: Path) -> int:
    return sum(p.stat().st_size for p in root.rglob("*") if p.is_file())


# --- writing ----------------------------------------------------------------


def _arrow(values: Any) -> pa.Array | pa.ChunkedArray:
    return values if isinstance(values, (pa.Array, pa.ChunkedArray)) else pa.array(values)


class Writer:
    """Writes one dataset episode by episode; finish() writes the meta files."""

    def __init__(
        self, root: Path, fps: int, features: dict[str, dict[str, Any]], robot_type: str | None
    ) -> None:
        if any(is_video(ft) for ft in features.values()):
            raise FormatError("Video features cannot be written yet")
        self.root, self.fps, self.robot_type = root, fps, robot_type
        self.features = features
        self.schema = schema(features)
        self.tasks: dict[str, int] = {}
        self.subtasks: dict[str, int] = {}
        self.frames = 0
        self._episodes: list[dict[str, Any]] = []
        self._stats: list[dict[str, dict[str, np.ndarray]]] = []
        self._chunk = self._file = 0
        self._file_bytes = 0
        self._pq: pq.ParquetWriter | None = None

    @property
    def episodes(self) -> int:
        return len(self._episodes)

    def task_index(self, task: str) -> int:
        return self.tasks.setdefault(task, len(self.tasks))

    def subtask_index(self, name: str) -> int:
        return self.subtasks.setdefault(name, len(self.subtasks))

    def add_episode(self, columns: dict[str, pa.Array], task_index: np.ndarray) -> int:
        """columns: every feature except episode_index / index / task_index; returns its index."""
        n = len(task_index)
        if n == 0:
            raise FormatError("Episode has no frames")
        ep = len(self._episodes)
        cols = dict(columns)
        cols["episode_index"] = pa.array(np.full(n, ep, dtype=np.int64))
        cols["index"] = pa.array(np.arange(self.frames, self.frames + n, dtype=np.int64))
        cols["task_index"] = pa.array(np.asarray(task_index, dtype=np.int64))
        missing = [k for k in self.features if k not in cols]
        if missing:
            raise FormatError(f"Episode is missing features {missing}")
        table = pa.table(
            [_arrow(cols[k]).cast(self.schema.field(k).type) for k in self.features],
            schema=self.schema,
        )
        self._rotate(table.nbytes)
        if self._pq is None:
            path = self.root / DATA_PATH.format(chunk_index=self._chunk, file_index=self._file)
            path.parent.mkdir(parents=True, exist_ok=True)
            self._pq = pq.ParquetWriter(path, self.schema, compression="snappy")
        self._pq.write_table(table)
        self._file_bytes += table.nbytes

        stats = {k: feature_stats(to_numpy(table.column(k))) for k in self.features}
        names = {v: k for k, v in self.tasks.items()}
        row: dict[str, Any] = {
            "episode_index": ep,
            "tasks": [names[int(i)] for i in dict.fromkeys(np.asarray(task_index).tolist())],
            "length": n,
            "data/chunk_index": self._chunk,
            "data/file_index": self._file,
            "dataset_from_index": self.frames,
            "dataset_to_index": self.frames + n,
            "meta/episodes/chunk_index": 0,
            "meta/episodes/file_index": 0,
        }
        for k, st in stats.items():
            for s, v in st.items():
                row[f"stats/{k}/{s}"] = v.tolist()
        self._episodes.append(row)
        self._stats.append(stats)
        self.frames += n
        return ep

    def _rotate(self, incoming: int) -> None:
        """New data file once the current one would pass the size limit (lerobot rule)."""
        if self._pq is None or not self._file_bytes:
            return
        if self._file_bytes + incoming < DATA_FILES_SIZE_MB * 1024 * 1024:
            return
        self._pq.close()
        self._pq, self._file_bytes = None, 0
        if self._file == CHUNKS_SIZE - 1:
            self._chunk, self._file = self._chunk + 1, 0
        else:
            self._file += 1

    def close(self) -> None:
        if self._pq is not None:
            self._pq.close()
            self._pq = None

    def finish(self) -> dict[str, Any]:
        """Writes meta/* and returns info.json."""
        self.close()
        if not self._episodes:
            raise FormatError("Dataset has no episodes")
        episodes = pa.Table.from_pylist(self._episodes, schema=self._episodes_schema())
        path = self.root / EPISODES_PATH.format(chunk_index=0, file_index=0)
        path.parent.mkdir(parents=True, exist_ok=True)
        pq.write_table(episodes, path)
        _write_names(self.root / TASKS_PATH, "task", list(self.tasks))
        if SUBTASK_KEY in self.features:
            _write_names(self.root / SUBTASKS_PATH, "subtask", list(self.subtasks))
        stats = {k: aggregate_stats([s[k] for s in self._stats]) for k in self.features}
        (self.root / STATS_PATH).write_text(json.dumps(_json_stats(stats), indent=4))
        info = {
            "codebase_version": CODEBASE_VERSION,
            "fps": self.fps,
            "features": self.features,
            "total_episodes": len(self._episodes),
            "total_frames": self.frames,
            "total_tasks": len(self.tasks),
            "chunks_size": CHUNKS_SIZE,
            "data_files_size_in_mb": DATA_FILES_SIZE_MB,
            "video_files_size_in_mb": VIDEO_FILES_SIZE_MB,
            "data_path": DATA_PATH,
            "video_path": None,
            "robot_type": self.robot_type,
            "splits": {"train": f"0:{len(self._episodes)}"},
        }
        (self.root / INFO_PATH).write_text(json.dumps(info, indent=4))
        return info

    def _episodes_schema(self) -> pa.Schema:
        fields = [
            ("episode_index", pa.int64()),
            ("tasks", pa.list_(pa.string())),
            ("length", pa.int64()),
            ("data/chunk_index", pa.int64()),
            ("data/file_index", pa.int64()),
            ("dataset_from_index", pa.int64()),
            ("dataset_to_index", pa.int64()),
            ("meta/episodes/chunk_index", pa.int64()),
            ("meta/episodes/file_index", pa.int64()),
        ]
        for k in self.features:
            for s in self._stats[0][k]:
                t = pa.int64() if s == "count" else pa.float64()
                fields.append((f"stats/{k}/{s}", pa.list_(t)))
        return pa.schema(fields)

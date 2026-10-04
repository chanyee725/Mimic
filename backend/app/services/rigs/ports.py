"""Serial / video ports found on the station, and the port each device uses here.

Rig files hold example ports; the port picked on the Rigs page is station-local and kept in
data/ports.local.yaml (git-ignored), keyed by device id.
"""

from pathlib import Path

from app.core import storage
from app.models.rigs import Port

PORTS_FILE = "ports.local.yaml"

# Roots tests can move
DEV = Path("/dev")
SYS_TTY = Path("/sys/class/tty")
SYS_VIDEO = Path("/sys/class/video4linux")


def _read(p: Path) -> str:
    try:
        return p.read_text().strip()
    except OSError:
        return ""


def _by_id(folder: Path) -> dict[str, Path]:
    """Kernel node → stable /dev/…/by-id link."""
    if not folder.is_dir():
        return {}
    return {str(link.resolve()): link for link in sorted(folder.iterdir())}


def _usb_name(sys_dev: Path) -> str:
    # The USB interface sits under device/; product / manufacturer one level up
    usb = (sys_dev / "device").resolve()
    for d in (usb, usb.parent):
        if product := _read(d / "product"):
            maker = _read(d / "manufacturer")
            return f"{maker} {product}".strip()
    return ""


def _video_name(name: str) -> str:
    """'ASUS FHD webcam: ASUS IR camera' → 'ASUS FHD webcam · ASUS IR camera'; drops a truncated repeat."""
    card, _, node = (s.strip() for s in name.partition(":"))
    return f"{card} · {node}" if node and not card.startswith(node) else card


def scan() -> list[Port]:
    """USB serial ports (ttyACM / ttyUSB), then video capture nodes."""
    out: list[Port] = []
    links = _by_id(DEV / "serial" / "by-id")
    for node in sorted([*DEV.glob("ttyACM*"), *DEV.glob("ttyUSB*")]):
        link = links.get(str(node.resolve()))
        label = _usb_name(SYS_TTY / node.name) or (link.name if link else "")
        out.append(
            Port(path=str(link or node), device=str(node), kind="serial", label=label, used_by=[])
        )
    links = _by_id(DEV / "v4l" / "by-id")
    for node in sorted(DEV.glob("video*"), key=lambda p: (len(p.name), p.name)):
        sys_dev = SYS_VIDEO / node.name
        # One capture node per camera: metadata nodes have a non-zero index
        if _read(sys_dev / "index") not in ("", "0"):
            continue
        link = links.get(str(node.resolve()))
        label = _video_name(_read(sys_dev / "name"))
        out.append(
            Port(path=str(link or node), device=str(node), kind="video", label=label, used_by=[])
        )
    return out


def exists(port: str) -> bool:
    return bool(port) and Path(port).exists()


def load_overrides() -> dict[str, str]:
    doc = storage.read(PORTS_FILE)
    return {str(k): str(v) for k, v in doc.items()} if isinstance(doc, dict) else {}


def save_overrides(ports: dict[str, str]) -> None:
    storage.write(PORTS_FILE, dict(sorted(ports.items())))

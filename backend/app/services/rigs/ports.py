"""Serial / video ports found on the station (the Rigs page picks device ports from them)."""

from pathlib import Path

from app.models.rigs import Port

# Roots tests can move
DEV = Path("/dev")
SYS_TTY = Path("/sys/class/tty")
SYS_VIDEO = Path("/sys/class/video4linux")


def _read(p: Path) -> str:
    try:
        return p.read_text().strip()
    except OSError:
        return ""


def _links(folder: Path) -> dict[str, Path]:
    """Kernel node → stable link in a /dev/…/by-id or by-path folder (first one by name)."""
    if not folder.is_dir():
        return {}
    out: dict[str, Path] = {}
    for link in sorted(folder.iterdir()):
        out.setdefault(str(link.resolve()), link)
    return out


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
    # Serial adapters carry a unique serial number: by-id follows the arm to any USB port
    links = _links(DEV / "serial" / "by-id")
    for node in sorted([*DEV.glob("ttyACM*"), *DEV.glob("ttyUSB*")]):
        link = links.get(str(node.resolve()))
        label = _usb_name(SYS_TTY / node.name) or (link.name if link else "")
        out.append(
            Port(path=str(link or node), device=str(node), kind="serial", label=label, used_by=[])
        )
    # Identical cameras often share a serial (one by-id link for both): use the USB port position
    links = _links(DEV / "v4l" / "by-path")
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

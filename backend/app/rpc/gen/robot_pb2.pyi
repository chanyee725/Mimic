from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class JointFrame(_message.Message):
    __slots__ = ("t_ns", "action", "state")
    T_NS_FIELD_NUMBER: _ClassVar[int]
    ACTION_FIELD_NUMBER: _ClassVar[int]
    STATE_FIELD_NUMBER: _ClassVar[int]
    t_ns: int
    action: _containers.RepeatedScalarFieldContainer[float]
    state: _containers.RepeatedScalarFieldContainer[float]
    def __init__(self, t_ns: _Optional[int] = ..., action: _Optional[_Iterable[float]] = ..., state: _Optional[_Iterable[float]] = ...) -> None: ...

class StreamRequest(_message.Message):
    __slots__ = ("rig_id", "hz")
    RIG_ID_FIELD_NUMBER: _ClassVar[int]
    HZ_FIELD_NUMBER: _ClassVar[int]
    rig_id: str
    hz: int
    def __init__(self, rig_id: _Optional[str] = ..., hz: _Optional[int] = ...) -> None: ...

class RatesRequest(_message.Message):
    __slots__ = ("rig_id",)
    RIG_ID_FIELD_NUMBER: _ClassVar[int]
    rig_id: str
    def __init__(self, rig_id: _Optional[str] = ...) -> None: ...

class Rates(_message.Message):
    __slots__ = ("action_hz", "state_hz")
    ACTION_HZ_FIELD_NUMBER: _ClassVar[int]
    STATE_HZ_FIELD_NUMBER: _ClassVar[int]
    action_hz: float
    state_hz: float
    def __init__(self, action_hz: _Optional[float] = ..., state_hz: _Optional[float] = ...) -> None: ...

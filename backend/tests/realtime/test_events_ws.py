from app.core.events import bus
from app.services.realtime.topics import TOPICS, topic_of

# websocket_connect ignores the client's base_url
WS = "/api/v1/ws/events"


def test_topic_mapping():
    assert topic_of("training.updated") == "training"
    assert topic_of("recording.deleted") == "recordings"
    assert topic_of("dataset.updated") == "datasets"
    assert topic_of("device.updated") == "devices"
    assert topic_of("sim.episode") == "sim"
    assert topic_of("unknown.thing") is None


def test_hello_lists_all_topics_by_default(client):
    with client.websocket_connect(f"{WS}") as ws:
        assert ws.receive_json() == {"type": "hello", "topics": list(TOPICS)}


def test_hello_reports_ignored_topics(client):
    with client.websocket_connect(f"{WS}?topics=sim,bogus,training") as ws:
        hello = ws.receive_json()
    assert hello == {"type": "hello", "topics": ["training", "sim"], "ignored": ["bogus"]}


def test_forwards_only_requested_topics(client):
    with client.websocket_connect(f"{WS}?topics=training") as ws:
        ws.receive_json()
        bus.publish("dataset.updated", {"id": "ds-1"})
        bus.publish("training.updated", {"id": "job-1"})
        msg = ws.receive_json()
    assert msg["type"] == "training.updated"
    assert msg["data"] == {"id": "job-1"}
    assert "at" in msg


def test_forwards_schema_models_as_camel_case(client):
    from app.services.rigs import get_rig

    with client.websocket_connect(f"{WS}?topics=devices") as ws:
        ws.receive_json()
        bus.publish("device.updated", get_rig("so101-kit"))
        msg = ws.receive_json()
    assert msg["data"]["targetHz"]["action"] == 60


def test_ping_pong_and_ignores_garbage(client):
    with client.websocket_connect(f"{WS}") as ws:
        ws.receive_json()
        ws.send_text("not json")
        ws.send_json({"type": "other"})
        ws.send_json({"type": "ping"})
        assert ws.receive_json() == {"type": "pong"}


def test_unsubscribes_on_disconnect(client):
    before = bus.subscriber_count
    with client.websocket_connect(f"{WS}") as ws:
        ws.receive_json()
        assert bus.subscriber_count == before + 1
    assert bus.subscriber_count == before

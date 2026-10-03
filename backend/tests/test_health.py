def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_unknown_route_uses_error_body(client):
    body = client.get("/nope").json()
    assert body["error"]["code"] == "not_found"

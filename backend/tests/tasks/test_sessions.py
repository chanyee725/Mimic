def test_list_sessions(client):
    rows = client.get("/sessions").json()
    assert len(rows) == 6
    dates = [s["date"] for s in rows]
    assert dates == sorted(dates, reverse=True)
    assert set(rows[0]) >= {"taskId", "successPct", "failPct", "status"}


def test_list_sessions_by_task(client):
    rows = client.get("/sessions", params={"taskId": "stack-two-blocks"}).json()
    assert rows and all(s["taskId"] == "stack-two-blocks" for s in rows)
    assert client.get("/sessions", params={"taskId": "missing"}).json() == []

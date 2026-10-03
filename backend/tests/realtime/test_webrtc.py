OFFER = {
    "sdp": "v=0\r\n",
    "type": "offer",
    "source": "rig",
    "rigId": "so101-kit",
    "cameras": ["top"],
}


def test_offer_not_implemented(client):
    r = client.post("/webrtc/offer", json=OFFER)
    assert r.status_code == 501
    err = r.json()["error"]
    assert err["code"] == "not_implemented"
    assert "camera pipeline" in err["message"]


def test_offer_unknown_rig(client):
    r = client.post("/webrtc/offer", json={**OFFER, "rigId": "nope"})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_offer_validation(client):
    bad = [
        {**OFFER, "type": "answer"},
        {**OFFER, "source": "camera"},
        {**OFFER, "cameras": []},
        {**OFFER, "sdp": ""},
        {k: v for k, v in OFFER.items() if k != "rigId"},
        {**OFFER, "source": "sim"},
    ]
    for body in bad:
        r = client.post("/webrtc/offer", json=body)
        assert r.status_code == 422, body
        assert r.json()["error"]["code"] == "validation_error"


def test_sim_offer_not_implemented(client):
    body = {**OFFER, "source": "sim", "rigId": None, "simJobId": "sim-1"}
    assert client.post("/webrtc/offer", json=body).status_code == 501


def test_delete_unknown_session(client):
    r = client.delete("/webrtc/sessions/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"

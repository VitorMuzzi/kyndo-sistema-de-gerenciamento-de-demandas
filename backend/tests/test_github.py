import routers.github as github_module
from tests.conftest import auth


def _create_card(client, token, autor, **overrides):
    payload = {"titulo": "Card com PR", "status": "col-1", "autor": autor, **overrides}
    r = client.post("/cards", json=payload, headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


class _FakeResponse:
    def __init__(self, status_code, json_data):
        self.status_code = status_code
        self._json = json_data

    def json(self):
        return self._json


class _FakeClient:
    def __init__(self, responses):
        self._responses = responses

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def get(self, url, headers=None, params=None):
        for key, resp in self._responses.items():
            if key in url:
                return resp
        raise AssertionError(f"Unexpected URL requested in test: {url}")


def _mock_github_api(monkeypatch, responses):
    monkeypatch.setattr(github_module, "GITHUB_TOKEN", "fake-token-for-tests")
    monkeypatch.setattr(github_module.httpx, "Client", lambda *a, **kw: _FakeClient(responses))


def test_card_without_pr_link_reports_not_linked(client, admin_token):
    card = _create_card(client, admin_token, "admin")
    r = client.get(f"/cards/{card['id']}/github", headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json() == {"linked": False}


def test_pr_link_without_token_reports_unconfigured(client, admin_token, monkeypatch):
    monkeypatch.setattr(github_module, "GITHUB_TOKEN", "")
    card = _create_card(client, admin_token, "admin", github_url="https://github.com/acme/kyndo/pull/42")
    r = client.get(f"/cards/{card['id']}/github", headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json() == {"linked": True, "configurado": False}


def test_pr_link_returns_state_checks_and_commits(client, admin_token, monkeypatch):
    responses = {
        "/repos/acme/kyndo/pulls/42/commits": _FakeResponse(200, [
            {"sha": "aaaaaaaaaaaa", "commit": {"message": "primeiro commit\n\ndetalhe", "author": {"name": "Fulano", "date": "2026-01-01T10:00:00Z"}}, "author": {"login": "fulano"}, "html_url": "https://github.com/acme/kyndo/commit/aaaaaaaaaaaa"},
            {"sha": "bbbbbbbbbbbb", "commit": {"message": "segundo commit", "author": {"name": "Fulano", "date": "2026-01-02T10:00:00Z"}}, "author": {"login": "fulano"}, "html_url": "https://github.com/acme/kyndo/commit/bbbbbbbbbbbb"},
        ]),
        "/repos/acme/kyndo/pulls/42": _FakeResponse(200, {
            "state": "open", "merged": False, "title": "Minha PR", "html_url": "https://github.com/acme/kyndo/pull/42",
            "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-02T00:00:00Z", "head": {"sha": "deadbeef"},
        }),
    }
    _mock_github_api(monkeypatch, responses)

    card = _create_card(client, admin_token, "admin", github_url="https://github.com/acme/kyndo/pull/42")
    r = client.get(f"/cards/{card['id']}/github", headers=auth(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert body["linked"] is True
    assert body["configurado"] is True
    assert body["estado"] == "aberta"
    assert "checks_status" not in body
    assert body["numero"] == 42
    assert [c["titulo"] for c in body["commits"]] == ["segundo commit", "primeiro commit"]  # most recent first


def test_pr_link_reports_merged_state(client, admin_token, monkeypatch):
    responses = {
        "/repos/acme/kyndo/pulls/7/commits": _FakeResponse(200, []),
        "/repos/acme/kyndo/pulls/7": _FakeResponse(200, {
            "state": "closed", "merged": True, "title": "PR mergeada", "html_url": "https://github.com/acme/kyndo/pull/7",
            "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-02T00:00:00Z", "head": {"sha": None},
        }),
    }
    _mock_github_api(monkeypatch, responses)

    card = _create_card(client, admin_token, "admin", github_url="https://github.com/acme/kyndo/pull/7")
    r = client.get(f"/cards/{card['id']}/github", headers=auth(admin_token))
    assert r.json()["estado"] == "mergeada"


def test_pr_not_found_on_github_reports_error(client, admin_token, monkeypatch):
    _mock_github_api(monkeypatch, {"/repos/acme/kyndo/pulls/999": _FakeResponse(404, {})})
    card = _create_card(client, admin_token, "admin", github_url="https://github.com/acme/kyndo/pull/999")
    r = client.get(f"/cards/{card['id']}/github", headers=auth(admin_token))
    body = r.json()
    assert body["linked"] is True
    assert "erro" in body


# --- link de repositório (antes era recusado em silêncio) --------------------

def _repo_responses(commits_status=200, commits=None, repo_status=200):
    # A ordem importa: _FakeClient casa por substring, e "/repos/dono/proj" é
    # substring de "/repos/dono/proj/commits" — o mais específico vem primeiro.
    return {
        "/commits": _FakeResponse(commits_status, commits if commits is not None else []),
        "/repos/dono/proj": _FakeResponse(repo_status, {
            "full_name": "dono/proj", "private": True,
            "default_branch": "main", "html_url": "https://github.com/dono/proj",
        }),
    }


def _commit(sha, msg, login="alguem", data="2026-09-01T10:00:00Z"):
    return {
        "sha": sha, "html_url": f"https://github.com/dono/proj/commit/{sha}",
        "author": {"login": login},
        "commit": {"message": msg, "author": {"name": login, "date": data}},
    }


def test_repo_link_returns_recent_commits(client, admin_token, monkeypatch):
    card = _create_card(client, admin_token, "admin", github_url="https://github.com/dono/proj")
    _mock_github_api(monkeypatch, _repo_responses(commits=[
        _commit("aaaaaaaaaa", "commit mais novo\n\ncorpo ignorado"),
        _commit("bbbbbbbbbb", "commit mais antigo"),
    ]))

    r = client.get(f"/cards/{card['id']}/github", headers=auth(admin_token))
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["linked"] is True and d["configurado"] is True
    assert d["tipo"] == "repo"
    assert d["nome_completo"] == "dono/proj"
    assert d["privado"] is True
    assert d["branch"] == "main"
    assert "erro" not in d
    assert [c["sha"] for c in d["commits"]] == ["aaaaaaa", "bbbbbbb"]
    assert d["commits"][0]["titulo"] == "commit mais novo"  # só a primeira linha


def test_repo_link_without_contents_permission_explains_the_403(client, admin_token, monkeypatch):
    """Um PAT só com 'Pull requests' recebe 403 no endpoint de commits do repo.
    Engolir isso numa lista vazia fingia que o repositório não tem commits."""
    card = _create_card(client, admin_token, "admin", github_url="https://github.com/dono/proj")
    _mock_github_api(monkeypatch, _repo_responses(
        commits_status=403, commits={"message": "Resource not accessible by personal access token"},
    ))

    d = client.get(f"/cards/{card['id']}/github", headers=auth(admin_token)).json()
    assert d["tipo"] == "repo"
    assert d["commits"] == []
    assert "Contents" in d["erro"]
    # os dados do repo continuam vindo junto do erro
    assert d["nome_completo"] == "dono/proj"
    assert d["branch"] == "main"


def test_repo_not_found_reports_error(client, admin_token, monkeypatch):
    card = _create_card(client, admin_token, "admin", github_url="https://github.com/dono/proj")
    _mock_github_api(monkeypatch, _repo_responses(repo_status=404))

    d = client.get(f"/cards/{card['id']}/github", headers=auth(admin_token)).json()
    assert d["tipo"] == "repo"
    assert "não encontrado" in d["erro"]


def test_repo_url_variants_are_accepted(client, admin_token, monkeypatch):
    for url in ["https://github.com/dono/proj/", "https://github.com/dono/proj.git",
                "http://github.com/dono/proj", "HTTPS://GitHub.com/dono/proj"]:
        card = _create_card(client, admin_token, "admin", github_url=url)
        _mock_github_api(monkeypatch, _repo_responses(commits=[_commit("cccccccccc", "x")]))
        d = client.get(f"/cards/{card['id']}/github", headers=auth(admin_token)).json()
        assert d.get("tipo") == "repo", f"{url} nao foi aceita como repo: {d}"


def test_unrecognized_github_link_reports_error_instead_of_silence(client, admin_token, monkeypatch):
    """Antes, link fora do formato caía no mesmo `linked: False` de 'não tem
    link' e a seção não desenhava nada — indebugável de fora."""
    for url in ["https://github.com/dono/proj/issues/3", "https://github.com/dono",
                "https://gitlab.com/dono/proj", "sopa de letrinhas"]:
        card = _create_card(client, admin_token, "admin", github_url=url)
        _mock_github_api(monkeypatch, _repo_responses())
        d = client.get(f"/cards/{card['id']}/github", headers=auth(admin_token)).json()
        assert d["linked"] is True, f"{url} voltou como nao-linkada: {d}"
        assert "não reconhecido" in d["erro"], f"{url} -> {d}"


def test_pr_link_still_takes_priority_over_repo_pattern(client, admin_token, monkeypatch):
    card = _create_card(client, admin_token, "admin",
                        github_url="https://github.com/dono/proj/pull/7")
    _mock_github_api(monkeypatch, {
        "/pulls/7/commits": _FakeResponse(200, [_commit("dddddddddd", "da pr")]),
        "/pulls/7": _FakeResponse(200, {
            "title": "Minha PR", "state": "open", "merged": False,
            "html_url": "https://github.com/dono/proj/pull/7",
            "created_at": "2026-09-01T10:00:00Z", "updated_at": "2026-09-02T10:00:00Z",
        }),
    })

    d = client.get(f"/cards/{card['id']}/github", headers=auth(admin_token)).json()
    assert d["tipo"] == "pr"
    assert d["numero"] == 7
    assert d["estado"] == "aberta"

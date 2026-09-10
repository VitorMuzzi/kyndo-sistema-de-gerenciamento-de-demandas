"""Aviso de sugestão pendente: separado do aviso de "não visto".

Diferenças que definem o comportamento:
  - não é por pessoa — é estado do card (há sugestão sem decisão)
  - NÃO some quando alguém lê; some quando alguém decide
  - só quem tem `decidir_sugestoes` recebe
"""
from tests.conftest import auth, create_user


def _create_card(client, token, autor, **overrides):
    payload = {"titulo": "Card sugestao", "status": "col-1", "autor": autor, **overrides}
    r = client.post("/cards", json=payload, headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def _get_card(client, token, card_id):
    r = client.get("/cards", headers=auth(token))
    assert r.status_code == 200
    return next((c for c in r.json() if c["id"] == card_id), None)


def _sugerir(client, token, card_id, texto="por favor mude isso"):
    r = client.post(f"/cards/{card_id}/suggestions",
                    json={"texto": texto, "identificacao": "quem escreveu"},
                    headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def test_sugestao_pendente_aparece_para_quem_decide(client, admin_token, maria):
    card = _create_card(client, admin_token, "admin")
    assert _get_card(client, admin_token, card["id"])["sugestoes_pendentes"] == 0

    _sugerir(client, maria["token"], card["id"])

    assert _get_card(client, admin_token, card["id"])["sugestoes_pendentes"] == 1


def test_contagem_acompanha_varias_sugestoes(client, admin_token, maria):
    card = _create_card(client, admin_token, "admin")
    _sugerir(client, maria["token"], card["id"], "primeira")
    _sugerir(client, maria["token"], card["id"], "segunda")
    _sugerir(client, maria["token"], card["id"], "terceira")

    assert _get_card(client, admin_token, card["id"])["sugestoes_pendentes"] == 3


def test_quem_nao_decide_nao_recebe_o_aviso(client, admin_token, maria, joao):
    card = _create_card(client, admin_token, "admin")
    _sugerir(client, maria["token"], card["id"])

    # joao é usuário comum, sem decidir_sugestoes
    assert _get_card(client, joao["token"], card["id"])["sugestoes_pendentes"] == 0
    # e quem escreveu também não, pela mesma razão
    assert _get_card(client, maria["token"], card["id"])["sugestoes_pendentes"] == 0


def test_ler_o_card_NAO_apaga_o_aviso(client, admin_token, maria):
    """A diferença central pro badge de 'não visto': dar uma olhada não
    resolve uma sugestão, então o aviso não pode sumir por leitura."""
    card = _create_card(client, admin_token, "admin")
    _sugerir(client, maria["token"], card["id"])

    client.post(f"/cards/{card['id']}/seen", headers=auth(admin_token))

    d = _get_card(client, admin_token, card["id"])
    assert d["nao_visto"] is False, "o aviso generico devia ter sido limpo pela leitura"
    assert d["sugestoes_pendentes"] == 1, "o de sugestao NAO podia sumir por leitura"


def test_aceitar_apaga_o_aviso(client, admin_token, maria):
    card = _create_card(client, admin_token, "admin")
    sug = _sugerir(client, maria["token"], card["id"])

    r = client.patch(f"/cards/{card['id']}/suggestions/{sug['id']}",
                     json={"status": "aceita", "prazo_entrega": "2026-12-01"},
                     headers=auth(admin_token))
    assert r.status_code == 200, r.text

    assert _get_card(client, admin_token, card["id"])["sugestoes_pendentes"] == 0


def test_recusar_apaga_o_aviso(client, admin_token, maria):
    card = _create_card(client, admin_token, "admin")
    sug = _sugerir(client, maria["token"], card["id"])

    r = client.patch(f"/cards/{card['id']}/suggestions/{sug['id']}",
                     json={"status": "rejeitada", "motivo_recusa": "nao faz sentido"},
                     headers=auth(admin_token))
    assert r.status_code == 200, r.text

    assert _get_card(client, admin_token, card["id"])["sugestoes_pendentes"] == 0


def test_apagar_a_sugestao_apaga_o_aviso(client, admin_token, maria):
    card = _create_card(client, admin_token, "admin")
    sug = _sugerir(client, maria["token"], card["id"])

    r = client.delete(f"/cards/{card['id']}/suggestions/{sug['id']}", headers=auth(admin_token))
    assert r.status_code == 200, r.text

    assert _get_card(client, admin_token, card["id"])["sugestoes_pendentes"] == 0


def test_decidir_uma_de_duas_deixa_a_outra_acesa(client, admin_token, maria):
    card = _create_card(client, admin_token, "admin")
    a = _sugerir(client, maria["token"], card["id"], "primeira")
    _sugerir(client, maria["token"], card["id"], "segunda")

    client.patch(f"/cards/{card['id']}/suggestions/{a['id']}",
                 json={"status": "aceita", "prazo_entrega": "2026-12-01"},
                 headers=auth(admin_token))

    assert _get_card(client, admin_token, card["id"])["sugestoes_pendentes"] == 1


def test_reabrir_uma_decisao_reacende_o_aviso(client, admin_token, maria):
    """Voltar a decisão pra pendente devolve o aviso — o estado do card é a
    fonte da verdade, não um marcador de leitura."""
    from database import SessionLocal
    from models import SuggestionDB

    card = _create_card(client, admin_token, "admin")
    sug = _sugerir(client, maria["token"], card["id"])
    client.patch(f"/cards/{card['id']}/suggestions/{sug['id']}",
                 json={"status": "rejeitada", "motivo_recusa": "nao"},
                 headers=auth(admin_token))
    assert _get_card(client, admin_token, card["id"])["sugestoes_pendentes"] == 0

    db = SessionLocal()
    try:
        db.query(SuggestionDB).filter(SuggestionDB.id == sug["id"]).first().status = "pendente"
        db.commit()
    finally:
        db.close()

    assert _get_card(client, admin_token, card["id"])["sugestoes_pendentes"] == 1


def test_aviso_conta_por_card_e_nao_vaza_entre_cards(client, admin_token, maria):
    com_sugestao = _create_card(client, admin_token, "admin")
    sem_sugestao = _create_card(client, admin_token, "admin")
    _sugerir(client, maria["token"], com_sugestao["id"])

    assert _get_card(client, admin_token, com_sugestao["id"])["sugestoes_pendentes"] == 1
    assert _get_card(client, admin_token, sem_sugestao["id"])["sugestoes_pendentes"] == 0


def test_cargo_com_decidir_sugestoes_recebe_o_aviso(client, admin_token, maria):
    """Não é privilégio de admin — é a permissão que manda."""
    card = _create_card(client, admin_token, "admin")
    _sugerir(client, maria["token"], card["id"])

    cargo = client.post("/roles", json={
        "nome": "Decisor de sugestoes", "cor": "#888",
        "permissoes": {"decidir_sugestoes": True},
    }, headers=auth(admin_token))
    assert cargo.status_code == 200, cargo.text

    decisor = create_user(client, admin_token, "decisor_sug")
    r = client.put(f"/users/{decisor['id']}/roles",
                   json={"role_ids": [cargo.json()["id"]]}, headers=auth(admin_token))
    assert r.status_code == 200, r.text
    decisor = client.post("/login", json={"nome": "decisor_sug", "senha": "senha123"}).json()

    assert _get_card(client, decisor["token"], card["id"])["sugestoes_pendentes"] == 1

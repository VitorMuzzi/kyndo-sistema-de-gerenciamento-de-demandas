import os
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import CardDB, UserDB
from rbac import get_visible_column_ids
from security import get_current_user

router = APIRouter()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_API = "https://api.github.com"

# Dois formatos aceitos, e a ordem importa: PR primeiro, senão a de repo
# poderia engolir o começo de uma URL de pull request.
PR_URL_RE = re.compile(r"^https?://github\.com/([^/]+)/([^/]+)/pull/(\d+)/?$", re.I)
REPO_URL_RE = re.compile(r"^https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$", re.I)

COMMITS_NO_REPO = 20  # o suficiente pra ver o movimento recente sem virar scroll infinito

# No CI/checks status here on purpose — the Checks API (what GitHub Actions
# reports to) is only readable by GitHub Apps, never by a personal access
# token (fine-grained or classic). The older Commit Statuses API a PAT *can*
# read doesn't reflect Actions results, so it would just show nothing for
# most repos — worse than not having the field at all.


def _assert_card_visible(db, current_user, db_card):
    visible = get_visible_column_ids(db, current_user.id)
    if visible is not None and db_card.status not in visible:
        raise HTTPException(status_code=404, detail="Card não encontrado")


def _headers():
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return headers


def _serializa_commits(commits_raw, mais_recente_primeiro=True):
    itens = list(commits_raw)
    if mais_recente_primeiro is False:
        itens = list(reversed(itens))
    return [
        {
            "sha": c["sha"][:7],
            "titulo": (c.get("commit", {}).get("message") or "").split("\n")[0],
            "autor": (c.get("author") or {}).get("login") or c.get("commit", {}).get("author", {}).get("name") or "?",
            "data": c.get("commit", {}).get("author", {}).get("date"),
            "url": c.get("html_url"),
        }
        for c in itens
    ]


def _info_do_repo(owner, repo):
    """Card apontando pro repositório: mostra os commits recentes do branch
    padrão. É o que a UI sempre pediu ('github.com/usuario/repo') e o que o
    backend recusava, devolvendo silêncio."""
    try:
        with httpx.Client(timeout=10, follow_redirects=True) as client:
            r = client.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=_headers())
            if r.status_code == 404:
                return {"linked": True, "configurado": True, "tipo": "repo",
                        "erro": "Repositório não encontrado (verifique o link ou as permissões do token)"}
            if r.status_code != 200:
                return {"linked": True, "configurado": True, "tipo": "repo",
                        "erro": f"GitHub retornou {r.status_code}"}
            info = r.json()
            branch = info.get("default_branch") or "main"

            r_commits = client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/commits",
                headers=_headers(), params={"sha": branch, "per_page": COMMITS_NO_REPO},
            )
            # Ler commits do repo exige a permissão "Contents" no token; ler
            # commits de uma PR não. Um PAT só com Pull requests devolve 403
            # exatamente aqui, e engolir isso numa lista vazia faria parecer
            # que o repositório não tem commit nenhum.
            if r_commits.status_code == 403:
                return {"linked": True, "configurado": True, "tipo": "repo",
                        "owner": owner, "repo": repo,
                        "nome_completo": info.get("full_name") or f"{owner}/{repo}",
                        "privado": bool(info.get("private")), "branch": branch,
                        "url": info.get("html_url") or f"https://github.com/{owner}/{repo}",
                        "commits": [],
                        "erro": "O token não tem permissão de leitura de Conteúdo (Contents) "
                                "neste repositório, que é o que a API exige pra listar commits. "
                                "Alternativa sem mexer no token: aponte o card para uma pull "
                                "request (github.com/dono/repo/pull/123)."}
            if r_commits.status_code != 200:
                return {"linked": True, "configurado": True, "tipo": "repo",
                        "owner": owner, "repo": repo,
                        "nome_completo": info.get("full_name") or f"{owner}/{repo}",
                        "privado": bool(info.get("private")), "branch": branch,
                        "url": info.get("html_url") or f"https://github.com/{owner}/{repo}",
                        "commits": [],
                        "erro": f"GitHub retornou {r_commits.status_code} ao listar os commits"}

            # A API já devolve do mais recente pro mais antigo aqui.
            commits = _serializa_commits(r_commits.json())

            return {
                "linked": True, "configurado": True, "tipo": "repo",
                "owner": owner, "repo": repo,
                "nome_completo": info.get("full_name") or f"{owner}/{repo}",
                "privado": bool(info.get("private")),
                "branch": branch,
                "url": info.get("html_url") or f"https://github.com/{owner}/{repo}",
                "commits": commits,
            }
    except httpx.HTTPError:
        return {"linked": True, "configurado": True, "tipo": "repo",
                "erro": "Não foi possível conectar ao GitHub"}


@router.get("/cards/{card_id}/github")
def get_github_info(card_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    db_card = db.query(CardDB).filter(CardDB.id == card_id).first()
    if not db_card:
        raise HTTPException(status_code=404, detail="Card não encontrado")
    _assert_card_visible(db, current_user, db_card)

    url = (db_card.github_url or "").strip()
    if not url:
        return {"linked": False}

    match = PR_URL_RE.match(url)
    match_repo = None if match else REPO_URL_RE.match(url)
    if not match and not match_repo:
        # Antes isso caía no mesmo `linked: False` de "não tem URL", e a seção
        # não desenhava nada — indistinguível de integração inexistente.
        return {
            "linked": True, "configurado": bool(GITHUB_TOKEN),
            "erro": "Link do GitHub não reconhecido. Use github.com/dono/repo "
                    "ou github.com/dono/repo/pull/123",
        }
    if not GITHUB_TOKEN:
        return {"linked": True, "configurado": False}

    if match_repo:
        return _info_do_repo(match_repo.group(1), match_repo.group(2))

    owner, repo, numero = match.group(1), match.group(2), int(match.group(3))
    try:
        with httpx.Client(timeout=10, follow_redirects=True) as client:
            r = client.get(f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{numero}", headers=_headers())
            if r.status_code == 404:
                return {"linked": True, "configurado": True, "tipo": "pr", "erro": "Pull request não encontrada (verifique o link ou as permissões do token)"}
            if r.status_code != 200:
                return {"linked": True, "configurado": True, "tipo": "pr", "erro": f"GitHub retornou {r.status_code}"}
            pr = r.json()

            estado = "mergeada" if pr.get("merged") else ("fechada" if pr.get("state") == "closed" else "aberta")

            r_commits = client.get(f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{numero}/commits", headers=_headers(), params={"per_page": 100})
            commits_raw = r_commits.json() if r_commits.status_code == 200 else []
            # Nesse endpoint o GitHub devolve do mais antigo pro mais novo.
            commits = _serializa_commits(commits_raw, mais_recente_primeiro=False)

            return {
                "linked": True, "configurado": True, "tipo": "pr",
                "owner": owner, "repo": repo, "numero": numero,
                "titulo": pr.get("title"), "estado": estado,
                "url": pr.get("html_url"),
                "criado_em": pr.get("created_at"), "atualizado_em": pr.get("updated_at"),
                "commits": commits,
            }
    except httpx.HTTPError:
        return {"linked": True, "configurado": True, "erro": "Não foi possível conectar ao GitHub"}

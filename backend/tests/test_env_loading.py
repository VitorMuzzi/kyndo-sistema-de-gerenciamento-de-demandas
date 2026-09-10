"""O .env tem que ser encontrado pelo caminho do arquivo, não pelo diretório
de trabalho do processo.

Com `load_dotenv()` sem argumento, subir o uvicorn de qualquer lugar que não
fosse backend/ deixava o GITHUB_TOKEN vazio (a tela reportava "integração não
configurada no servidor") e — pior — o SECRET_KEY caía no fallback que está
escrito no código, assinando os tokens de login com uma chave pública.
"""
import os
import subprocess
import sys

import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE = os.path.join(BACKEND_DIR, ".env")
FALLBACK_SECRET = "coloque_sua_chave_secreta_aqui"


def _roda_de_outro_cwd(codigo, cwd):
    """Sobe um Python limpo em `cwd` (fora de backend/) e roda `codigo`.
    Ambiente sem as variáveis, pra forçar a leitura vir do .env."""
    env = {k: v for k, v in os.environ.items()
           if k not in ("SECRET_KEY", "GITHUB_TOKEN", "DATABASE_URL", "UPLOAD_DIR")}
    return subprocess.run(
        [sys.executable, "-c", codigo],
        cwd=cwd, env=env, capture_output=True, text=True, timeout=120,
    )


@pytest.mark.skipif(not os.path.isfile(ENV_FILE), reason="precisa de um backend/.env real")
def test_env_e_lido_mesmo_subindo_de_outro_diretorio():
    pai = os.path.dirname(BACKEND_DIR)  # raiz do repo — nao tem .env
    assert not os.path.isfile(os.path.join(pai, ".env")), \
        "este teste sO vale se a raiz NAO tiver .env"

    codigo = (
        f"import sys; sys.path.insert(0, {BACKEND_DIR!r});"
        "import main, security;"
        "print('SECRET_OK', security.SECRET_KEY != %r)" % FALLBACK_SECRET
    )
    r = _roda_de_outro_cwd(codigo, cwd=pai)
    assert r.returncode == 0, f"stdout={r.stdout}\nstderr={r.stderr}"
    assert "SECRET_OK True" in r.stdout, (
        "SECRET_KEY caiu no fallback do codigo ao subir de outro cwd — "
        f"o .env nao foi encontrado.\nstdout={r.stdout}\nstderr={r.stderr}"
    )


def test_load_dotenv_recebe_caminho_absoluto():
    """Guarda mais barata que o subprocess: um `load_dotenv()` pelado no
    main.py volta a depender do cwd, e é fácil reintroduzir sem perceber."""
    bruto = open(os.path.join(BACKEND_DIR, "main.py"), encoding="utf-8").read()
    # Sem os comentários: o próprio comentário que documenta este bug cita
    # `load_dotenv()` e faria a checagem acusar código que não existe.
    codigo = "\n".join(
        linha for linha in bruto.splitlines() if not linha.lstrip().startswith("#")
    )
    assert "load_dotenv()" not in codigo, \
        "load_dotenv() sem argumento procura o .env a partir do cwd — ancore no __file__"
    assert "load_dotenv(" in codigo and "__file__" in codigo, \
        "main.py deve carregar o .env por um caminho derivado de __file__"

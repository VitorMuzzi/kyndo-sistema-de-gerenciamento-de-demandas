import os

from dotenv import load_dotenv

# Ancorado no diretório deste arquivo, nunca relativo ao cwd — mesmo motivo do
# path do banco em database.py. load_dotenv() sem argumento procura o .env a
# partir do diretório de trabalho do processo, então subir o uvicorn de
# qualquer lugar que não seja backend/ fazia o SECRET_KEY cair no fallback e o
# GITHUB_TOKEN ficar vazio, o que a tela reporta como "integração não
# configurada no servidor".
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from init_data import init_db
from migrations import assign_default_user_roles, run_migrations
from routers import attachments, audit, auth, cards, columns, drawings, github, metrics, notes, roles, suggestions, users

run_migrations()
init_db()
assign_default_user_roles()

app = FastAPI(title="Kyndo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(columns.router)
app.include_router(cards.router)
app.include_router(notes.router)
app.include_router(drawings.router)
app.include_router(audit.router)
app.include_router(suggestions.router)
app.include_router(roles.router)
app.include_router(attachments.router)
app.include_router(metrics.router)
app.include_router(github.router)

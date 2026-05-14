from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy import create_engine, Column, String, Boolean, Integer, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from datetime import datetime, timedelta
import uuid
import jwt
import bcrypt

# Security config
SECRET_KEY = "coloque_sua_chave_secreta_aqui"
ALGORITHM = "HS256"

security = HTTPBearer()

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# Database config
SQLALCHEMY_DATABASE_URL = "sqlite:///./demandas.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Models
class UserDB(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    nome = Column(String, unique=True, index=True)
    senha = Column(String)
    role = Column(String)
    senha_temporaria = Column(Boolean, default=False)

class ColumnDB(Base):
    __tablename__ = "columns"
    id = Column(String, primary_key=True, index=True)
    titulo = Column(String)
    cor = Column(String)
    ordem = Column(Integer)
    publica = Column(Boolean, default=False)
    auto_andamento = Column(Boolean, default=False)
    auto_concluido = Column(Boolean, default=False)
    arquivado = Column(Boolean, default=False)

class CardDB(Base):
    __tablename__ = "cards"
    id = Column(String, primary_key=True, index=True)
    titulo = Column(String)
    descricao = Column(String)
    status = Column(String)
    prioridade = Column(String)
    autor = Column(String)
    prazo = Column(String, nullable=True)
    data_criacao = Column(String)
    checklist = Column(JSON)
    comentarios = Column(JSON)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Kyndo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# JWT Verification
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return user

# DB Initialization
def init_db():
    db = SessionLocal()
    if not db.query(UserDB).filter(UserDB.nome == "admin").first():
        hashed_pw = get_password_hash("admin")
        db.add(UserDB(id=str(uuid.uuid4()), nome="admin", senha=hashed_pw, role="admin", senha_temporaria=False))
    
    if db.query(ColumnDB).count() == 0:
        cols = [
            ColumnDB(id="col-1", titulo="IDEIAS DE PROJETOS", cor="#fef08a", ordem=0, publica=True),
            ColumnDB(id="col-2", titulo="PROJETOS A SEREM INICIADOS", cor="#bfdbfe", ordem=1),
            ColumnDB(id="col-3", titulo="EM ANDAMENTO", cor="#fecaca", ordem=2, auto_andamento=True),
            ColumnDB(id="col-4", titulo="CONCLUÍDO", cor="#bbf7d0", ordem=3, auto_concluido=True)
        ]
        db.add_all(cols)
    db.commit()
    db.close()

init_db()

# Pydantic Schemas
class LoginRequest(BaseModel):
    nome: str
    senha: str

class UserCreate(BaseModel):
    nome: str
    senha: str
    role: str

class PasswordUpdate(BaseModel):
    nova_senha: str

class ColSchema(BaseModel):
    id: str
    titulo: str
    cor: str
    ordem: int
    publica: bool = False
    auto_andamento: bool = False
    auto_concluido: bool = False
    arquivado: bool = False

class CardSchema(BaseModel):
    id: Optional[str] = None
    titulo: str
    descricao: str = ""
    status: str
    prioridade: str = "Normal"
    autor: str
    prazo: str = ""
    checklist: List[Dict[str, Any]] = []
    comentarios: List[Dict[str, Any]] = []

# API Routes
@app.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.nome == req.nome).first()
    if not user or not verify_password(req.senha, user.senha):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode = {"sub": user.id, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return {
        "id": user.id, 
        "nome": user.nome, 
        "role": user.role, 
        "senha_temporaria": user.senha_temporaria,
        "token": encoded_jwt
    }

@app.get("/users")
def get_users(db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    return db.query(UserDB).all()

@app.post("/users")
def create_user(req: UserCreate, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    if db.query(UserDB).filter(UserDB.nome == req.nome).first():
        raise HTTPException(status_code=400, detail="Usuário já existe")
    hashed_pw = get_password_hash(req.senha)
    novo = UserDB(id=str(uuid.uuid4()), nome=req.nome, senha=hashed_pw, role=req.role, senha_temporaria=True)
    db.add(novo)
    db.commit()
    return {"msg": "criado"}

@app.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if user and user.nome != "admin":
        db.delete(user)
        db.commit()
    return {"msg": "deletado"}

@app.put("/users/{user_id}/password")
def update_password(user_id: str, req: PasswordUpdate, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if user:
        user.senha = get_password_hash(req.nova_senha)
        user.senha_temporaria = False
        db.commit()
    return {"msg": "senha atualizada"}

@app.get("/columns")
def get_columns(db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    return db.query(ColumnDB).filter(ColumnDB.arquivado == False).order_by(ColumnDB.ordem).all()

@app.post("/columns")
def create_column(col: ColSchema, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    nova = ColumnDB(**col.dict())
    db.add(nova)
    db.commit()
    return nova

@app.put("/columns/{col_id}")
def update_column(col_id: str, col: ColSchema, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    db_col = db.query(ColumnDB).filter(ColumnDB.id == col_id).first()
    if db_col:
        for key, value in col.dict().items():
            setattr(db_col, key, value)
        db.commit()
    return {"msg": "atualizado"}

@app.get("/cards")
def get_cards(db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    return db.query(CardDB).all()

@app.post("/cards")
def create_card(card: CardSchema, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    data_atual = datetime.now().strftime("%d/%m/%Y")
    novo = CardDB(
        id=f"card-{uuid.uuid4().hex[:8]}",
        titulo=card.titulo,
        descricao=card.descricao,
        status=card.status,
        prioridade=card.prioridade,
        autor=card.autor,
        prazo=card.prazo,
        data_criacao=data_atual,
        checklist=card.checklist,
        comentarios=card.comentarios
    )
    db.add(novo)
    db.commit()
    return novo

@app.put("/cards/{card_id}")
def update_card(card_id: str, card: CardSchema, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    db_card = db.query(CardDB).filter(CardDB.id == card_id).first()
    if db_card:
        db_card.titulo = card.titulo
        db_card.descricao = card.descricao
        db_card.status = card.status
        db_card.prioridade = card.prioridade
        db_card.prazo = card.prazo
        db_card.checklist = card.checklist
        db_card.comentarios = card.comentarios
        db.commit()
    return {"msg": "atualizado"}

@app.delete("/cards/{card_id}")
def delete_card(card_id: str, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    db_card = db.query(CardDB).filter(CardDB.id == card_id).first()
    if db_card:
        db.delete(db_card)
        db.commit()
    return {"msg": "deletado"}
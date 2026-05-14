**Kyndo - Sistema de Gerenciamento de Demandas**

criei esse aplicativo com o intuito de gerir e facilitar as solicitações de tarefas pra desenvolvimento na empresa em que trabalho.


A arquitetura é dividida em um frontend construído em React e uma API REST desenvolvida em Python utilizando FastAPI. O sistema inclui suporte a compilação nativa para Android através do Capacitor.

Funcionalidades Principais

Autenticação e autorização via tokens JWT, com senhas hasheadas via Bcrypt.

Controle de acesso baseado em roles (Administradores e Usuários Padrão).

Gestão de cartões com controle de prioridades, prazos, checklists de progresso e histórico de comentários.

colunas podem ser configuradas para alterar o status da demanda automaticamente (ex: mover para "concluído" ao finalizar o checklist).

Filtros de visualização e busca de cartões.

Painel administrativo integrado para gestão de contas e geração de senhas temporárias.

Frontend: React, Tailwind CSS, @hello-pangea/dnd, Capacitor.

Backend: Python, FastAPI, SQLAlchemy, SQLite, Bcrypt, PyJWT.

Como executar localmente
É necessário ter Node.js e Python 3 instalados no ambiente.

Configuração do Backend (API)
Clone o repositório e acesse a diretório backend.

Crie e ative o ambiente virtual:

Bash
python -m venv venv
venv\Scripts\activate
(Em sistemas baseados em Unix: source venv/bin/activate)

Instale as dependências:

Bash
pip install -r requirements.txt
Inicie o servidor:

Bash
python -m uvicorn main:app --host 0.0.0.0 --port 8095 --reload
Nota: O banco de dados (demandas.db) será gerado automaticamente na raiz da pasta backend durante a primeira execução.

Configuração do Frontend
Em um novo terminal, acesse o diretório frontend.

Instale as dependências do projeto:

Bash
npm install
Inicie o servidor de desenvolvimento:

Bash
npm run dev
Acesso Inicial
A rotina de inicialização do backend cria uma conta de administração padrão caso o banco de dados esteja vazio:

Usuário: admin

Senha: admin

Build para Android
Para gerar o aplicativo e rodar no emulador ou dispositivo físico:

Bash
cd frontend
npm run build
npx cap sync android
npx cap run android
Importante: Se o aplicativo for rodar em um dispositivo acessando um servidor na rede local, atualize a constante API no arquivo App.jsx com o IPv4 da máquina host antes de gerar o build. Apenas usar localhost não funcionará fora do ambiente de desenvolvimento da própria máquina.


ps: primeiramente eu tentei utilizar o androidStudio pra rodar o teste do aplicativo atraves do dispositivo virtual que o software disponibiliza 
alem de eu nao conseguir fazer rodar por conta do consumo absurdo de RAM que isso requeria do meu pc, eu nao consegui estabelecer a conexão do 
banco de dados com o aplicativo de jeito nenhum.
import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, X, AlignLeft, MoreHorizontal, Archive, Palette, CheckSquare, Circle, CheckCircle2, User, Lock, Unlock, Tag, MessageSquare, Filter, Send, Settings, Calendar, RefreshCw, LogOut, Users, Trash2, KeyRound, ChevronDown } from 'lucide-react';

const API = 'http://localhost:8095';

// Auth wrapper
const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('demandaflow_token');
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!headers['Content-Type'] && options.method !== 'GET') headers['Content-Type'] = 'application/json';
  
  return fetch(url, { ...options, headers }).then(res => {
    if (res.status === 401) {
      localStorage.removeItem('demandaflow_user');
      localStorage.removeItem('demandaflow_token');
      window.location.reload();
    }
    return res;
  });
};

const PRIORIDADES_BADGE = { 'Baixa': 'bg-green-600 text-white shadow-sm', 'Normal': 'bg-gray-500 text-white shadow-sm', 'Alta': 'bg-orange-500 text-white shadow-sm', 'Urgente': 'bg-red-600 text-white font-black shadow-sm' };
const PRIORIDADE_CARD_STYLE = { 'Baixa': 'bg-green-100 border-green-500 border-2', 'Normal': 'bg-gray-50 border-gray-300 border-2 hover:border-emerald-400', 'Alta': 'bg-orange-100 border-orange-500 border-2', 'Urgente': 'bg-red-200 border-red-600 border-2 shadow-md shadow-red-300/50' };

function formatarData(dataISO) {
  if (!dataISO) return ''; const [ano, mes, dia] = dataISO.split('-'); return `${dia}/${mes}/${ano}`;
}

// Login Screen
function LoginScreen({ onLogin }) {
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, senha })
      });
      if (res.ok) {
        const user = await res.json();
        onLogin(user);
      } else {
        setErro('Usuário ou senha incorretos.');
      }
    } catch (err) {
      setErro('Erro ao conectar com o servidor.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-800 to-teal-900 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <h1 className="text-3xl font-black text-emerald-700 italic tracking-tighter uppercase mb-2 text-center">Kyndo</h1>
        <p className="text-gray-500 text-center mb-8 text-sm">Acesse o quadro de tarefas</p>
        
        {erro && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm font-bold text-center">{erro}</div>}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Usuário</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500" required />
          </div>
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg mt-4">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

// Change Password Screen
function ChangePasswordScreen({ user, onPasswordChanged }) {
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas digitadas não coincidem.'); return;
    }
    if (novaSenha.length < 4) {
      setErro('A senha deve ter pelo menos 4 caracteres.'); return;
    }

    try {
      const res = await authFetch(`${API}/users/${user.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ nova_senha: novaSenha })
      });

      if (res.ok) {
        onPasswordChanged();
      } else {
        setErro('Erro ao alterar a senha.');
      }
    } catch (err) {
      setErro('Erro de conexão.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-800 to-teal-900 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex justify-center mb-4"><KeyRound size={48} className="text-orange-500" /></div>
        <h2 className="text-2xl font-black text-gray-800 text-center mb-2">Quase lá, {user.nome}!</h2>
        <p className="text-gray-500 text-center mb-6 text-sm">Você está usando uma senha temporária. Por favor, crie uma nova senha de segurança para continuar.</p>
        
        {erro && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm font-bold text-center">{erro}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nova Senha</label>
            <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Confirmar Nova Senha</label>
            <input type="password" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500" required />
          </div>
          <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg mt-4">
            Salvar e Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

// Admin Panel
function AdminPanel({ onBack, currentUsers, refreshUsers }) {
  const [novoNome, setNovoNome] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [novoRole, setNovoRole] = useState('user');
  const [msg, setMsg] = useState('');

  const criarUsuario = async (e) => {
    e.preventDefault();
    const res = await authFetch(`${API}/users`, {
      method: 'POST',
      body: JSON.stringify({ nome: novoNome, senha: novaSenha, role: novoRole })
    });
    if (res.ok) {
      setNovoNome(''); setNovaSenha(''); setMsg('Usuário criado com sucesso!');
      refreshUsers();
      setTimeout(() => setMsg(''), 3000);
    } else {
      const data = await res.json();
      setMsg(`Erro: ${data.detail}`);
    }
  };

  const deletarUsuario = async (id) => {
    if(!window.confirm("Certeza que deseja excluir este usuário?")) return;
    await authFetch(`${API}/users/${id}`, { method: 'DELETE' });
    refreshUsers();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <div className="bg-emerald-700 p-6 flex justify-between items-center text-white">
          <div>
            <h2 className="text-2xl font-black italic tracking-tighter uppercase">Painel Admin</h2>
            <p className="text-emerald-200 text-sm">Gerenciamento de Usuários</p>
          </div>
          <button onClick={onBack} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-bold transition-colors">Voltar ao Quadro</button>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><User size={20}/> Novo Usuário</h3>
            {msg && <div className="mb-4 text-sm font-bold text-emerald-600 bg-emerald-50 p-2 rounded">{msg}</div>}
            
            <form onSubmit={criarUsuario} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nome</label>
                <input type="text" value={novoNome} onChange={e => setNovoNome(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:border-emerald-500" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Senha Temporária</label>
                <input type="text" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:border-emerald-500" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nível de Acesso</label>
                <select value={novoRole} onChange={e => setNovoRole(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:border-emerald-500">
                  <option value="user">Usuário Padrão</option>
                  <option value="admin">Administrador (Admin)</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg transition-colors">Criar Usuário</button>
            </form>
          </div>

          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Users size={20}/> Usuários Cadastrados</h3>
            <div className="space-y-2">
              {currentUsers.map(u => (
                <div key={u.id} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <div>
                    <p className="font-bold text-gray-800">{u.nome}</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${u.role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                  </div>
                  {u.nome !== 'admin' && (
                    <button onClick={() => deletarUsuario(u.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Board Components
function ListActionsMenu({ col, user, onClose, onAddCard, onArchiveList, onUpdateCol }) {
  const menuRef = useRef();

  useEffect(() => {
    function handleClickOutside(event) { if (menuRef.current && !menuRef.current.contains(event.target)) onClose(); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (user.role !== 'admin') return null;

  return (
    <div ref={menuRef} className="absolute top-12 right-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 z-[100] p-3 space-y-1 animate-in fade-in zoom-in-95">
      <div className="flex justify-between items-center pb-2 mb-2 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 text-center flex-grow">Configurações</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100"><X size={16} /></button>
      </div>

      <button onClick={() => { onUpdateCol({ ...col, publica: !col.publica }); onClose(); }} className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 text-gray-800 hover:bg-gray-100 transition-colors font-semibold">
        {col.publica ? <Lock size={16} className="text-orange-500"/> : <Unlock size={16} className="text-emerald-500"/>}
        {col.publica ? 'Tornar Privada' : 'Tornar Pública'}
      </button>

      <button onClick={() => { onAddCard(); onClose(); }} className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 text-gray-800 hover:bg-gray-100 transition-colors">
        <Plus size={16} className="text-gray-500"/> Adicionar cartão
      </button>

      <div className="pt-2 mt-2 border-t border-gray-200">
        <div className="flex items-center gap-2 text-xs text-gray-500 font-bold uppercase tracking-wider mb-1 px-1"><Settings size={14}/> Automações</div>
        <button onClick={() => { onUpdateCol({ ...col, auto_andamento: !col.auto_andamento }); }} className="w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between text-gray-700 hover:bg-gray-100 transition-colors">
          <span>Receber iniciadas {'>0%'}</span>
          {col.auto_andamento ? <CheckCircle2 size={16} className="text-emerald-500"/> : <Circle size={16} className="text-gray-300"/>}
        </button>
        <button onClick={() => { onUpdateCol({ ...col, auto_concluido: !col.auto_concluido }); }} className="w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between text-gray-700 hover:bg-gray-100 transition-colors">
          <span>Receber concluídas 100%</span>
          {col.auto_concluido ? <CheckCircle2 size={16} className="text-green-500"/> : <Circle size={16} className="text-gray-300"/>}
        </button>
      </div>
      
      <button onClick={() => { onArchiveList(); onClose(); }} className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 text-red-700 hover:bg-red-50 mt-2 transition-colors border-t border-gray-200">
        <Archive size={16} className="text-red-500"/> Arquivar lista
      </button>

      <div className="pt-3 mt-2 border-t border-gray-200 space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-700 font-medium"><Palette size={16} className="text-gray-500"/> Cor da Lista</div>
        <div className="grid grid-cols-5 gap-2 pt-1">
          {['#ebecf0', '#fecaca', '#fef08a', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fed7aa', '#fbcfe8'].map(color => (
            <button key={color} onClick={() => onUpdateCol({ ...col, cor: color })} className="w-full h-6 rounded border border-black/10 hover:scale-110 transition-transform" style={{ backgroundColor: color }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CardModal({ card, col, user, allUsers, onClose, onSave, onDelete }) {
  const [titulo, setTitulo] = useState(card?.titulo || '');
  const [desc, setDesc] = useState(card?.descricao || '');
  const [checklist, setChecklist] = useState(card?.checklist || []);
  const [prioridade, setPrioridade] = useState(card?.prioridade || 'Normal');
  const [comentarios, setComentarios] = useState(card?.comentarios || []);
  const [prazo, setPrazo] = useState(card?.prazo || ''); 
  const [novaSubtarefa, setNovaSubtarefa] = useState('');
  const [novoComentario, setNovoComentario] = useState('');
  const [prioridadeAberto, setPrioridadeAberto] = useState(false);

  const isAdmin = user.role === 'admin';
  const isAuthor = card?.autor === user.nome;
  
  const podeEditarDescricao = isAdmin || (col?.publica && (isAuthor || !card?.id));
  const podeDeletar = card?.id && (isAdmin || (isAuthor && col?.id === 'col-1'));

  const mostrarPrioridade = isAdmin || prioridade !== 'Normal' || col?.id !== 'col-1';
  const mostrarPrazo = isAdmin || prazo;
  const mostrarEtapas = isAdmin || checklist.length > 0;

  const handleDescChange = (e) => { setDesc(e.target.value.replace(/(^|\n)-\s/g, "$1• ")); };
  const handleDescKeyDown = (e) => {
    if (e.key === 'Enter') {
      const pos = e.target.selectionStart;
      const lines = desc.substring(0, pos).split('\n');
      const curLine = lines[lines.length - 1];
      if (curLine === '• ') { e.preventDefault(); setDesc(desc.substring(0, pos - 2) + '\n' + desc.substring(pos)); setTimeout(() => e.target.selectionStart = e.target.selectionEnd = pos - 1, 0); return; }
      if (curLine.startsWith('• ')) { e.preventDefault(); setDesc(desc.substring(0, pos) + '\n• ' + desc.substring(pos)); setTimeout(() => e.target.selectionStart = e.target.selectionEnd = pos + 3, 0); return; }
    }
  };

  const addSubtarefa = () => { if (!novaSubtarefa.trim() || !isAdmin) return; setChecklist([...checklist, { id: `sub-${Date.now()}`, texto: novaSubtarefa, concluido: false }]); setNovaSubtarefa(''); };
  const addComentario = () => { if (!novoComentario.trim()) return; const dataAtual = new Date().toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }); setComentarios([...comentarios, { id: `msg-${Date.now()}`, autor: user.nome, texto: novoComentario, data: dataAtual }]); setNovoComentario(''); };

  const percentual = checklist.length > 0 ? Math.round((checklist.filter(c => c.concluido).length / checklist.length) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-2 md:p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="p-4 md:p-6 border-b flex justify-between items-start bg-gray-50/50">
          <div className="flex-grow flex flex-col gap-2 min-w-0">
            <div className="flex justify-between items-center w-full pr-4">
              <input disabled={!podeEditarDescricao} value={titulo} onChange={e => setTitulo(e.target.value)} className={`text-xl md:text-2xl font-bold w-full outline-none bg-transparent ${!podeEditarDescricao ? 'text-gray-600' : ''}`} placeholder="Título da demanda..." />
              
              {mostrarPrioridade && (
                <div className="flex items-center gap-1 md:gap-2 shrink-0 ml-2 relative">
                  <Tag size={14} className="text-gray-400 hidden md:block"/>
                  {isAdmin ? (
                    <div className="relative">
                      <div onClick={() => setPrioridadeAberto(!prioridadeAberto)} className={`flex items-center gap-1 text-[10px] md:text-xs font-bold uppercase rounded-lg px-2 py-1 outline-none cursor-pointer transition-colors ${PRIORIDADES_BADGE[prioridade]}`}>
                        {prioridade} <ChevronDown size={12} />
                      </div>
                      {prioridadeAberto && (
                        <>
                          <div className="fixed inset-0 z-[210]" onClick={() => setPrioridadeAberto(false)} />
                          <div className="absolute top-full mt-1 right-0 w-32 bg-white rounded-xl shadow-xl border border-gray-200 z-[220] overflow-hidden animate-in fade-in zoom-in-95">
                            {['Baixa', 'Normal', 'Alta', 'Urgente'].map(prio => (
                              <div key={prio} onClick={() => { setPrioridade(prio); setPrioridadeAberto(false); }} className={`p-2 px-3 hover:bg-gray-100 cursor-pointer flex items-center transition-colors ${prioridade === prio ? 'bg-gray-50' : ''}`}>
                                <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded w-full text-center ${PRIORIDADES_BADGE[prio]}`}>{prio}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className={`text-[10px] md:text-xs font-bold uppercase rounded-lg px-2 py-1 ${PRIORIDADES_BADGE[prioridade]}`}>{prioridade}</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">
              <p className="text-gray-400">De: {card?.autor || user.nome}</p>
              {card?.data_criacao && <p className="text-gray-400 hidden md:block">Criado em: {card.data_criacao}</p>}
              
              {mostrarPrazo && (
                <div className="flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded text-gray-600">
                  <Calendar size={12} className="text-orange-500" />
                  {isAdmin ? (
                    <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className="bg-transparent outline-none cursor-pointer text-gray-800"/>
                  ) : (
                    <span className="font-bold text-gray-800">{formatarData(prazo)}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 p-1"><X size={24}/></button>
        </div>
        
        <div className="p-4 md:p-8 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-700 font-bold text-sm"><AlignLeft size={16}/> Descrição</div>
            <textarea disabled={!podeEditarDescricao} value={desc} onChange={handleDescChange} onKeyDown={handleDescKeyDown} className="w-full h-24 md:h-32 p-3 md:p-4 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:bg-white text-sm font-mono shadow-inner resize-none" placeholder={podeEditarDescricao ? "Dica: Use '- ' para criar listas..." : "Apenas visualização."} />
          </div>

          {mostrarEtapas && (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-700 font-bold text-sm"><CheckSquare size={16}/> Etapas</div>
                  {checklist.length > 0 && <span className="text-sm font-bold text-gray-500">{percentual}%</span>}
                </div>
                {checklist.length > 0 && (<div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full transition-all duration-300 ${percentual === 100 ? 'bg-emerald-500' : 'bg-teal-500'}`} style={{ width: `${percentual}%` }} /></div>)}
                <div className="space-y-2">
                  {checklist.map(item => (
                    <div key={item.id} className="flex items-center gap-3">
                      <button disabled={!isAdmin} onClick={() => setChecklist(checklist.map(i => i.id === item.id ? {...i, concluido: !i.concluido} : i))} className={`${!isAdmin ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'} shrink-0`}>
                        {item.concluido ? <CheckCircle2 size={18} className="text-emerald-500"/> : <Circle size={18} className="text-gray-300"/>}
                      </button>
                      <span className={`text-sm ${item.concluido ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.texto}</span>
                    </div>
                  ))}
                </div>
                {isAdmin && (
                  <div className="flex flex-row items-center gap-2 pt-2 w-full">
                    <input value={novaSubtarefa} onChange={e => setNovaSubtarefa(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubtarefa()} className="flex-grow min-w-0 p-2 border rounded-lg text-sm outline-none focus:border-emerald-400" placeholder="Adicionar etapa..." />
                    <button onClick={addSubtarefa} className="shrink-0 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-md">Add</button>
                  </div>
                )}
              </div>
              <hr className="border-gray-200" />
            </>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-700 font-bold text-sm"><MessageSquare size={16}/> Comentários</div>
            <div className="space-y-3">
              {comentarios.map(msg => {
                const autorNoBanco = allUsers.find(u => u.nome === msg.autor);
                const isAdminComment = autorNoBanco?.role === 'admin';
                const isAuthorComment = msg.autor === (card?.autor || user.nome);
                let boxClass = "bg-gray-50 border-gray-100"; let badge = null;
                if (isAdminComment) { boxClass = "bg-orange-50 border-orange-100"; badge = <span className="ml-2 text-[9px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Admin</span>; } 
                else if (isAuthorComment) { boxClass = "bg-emerald-50 border-emerald-100"; badge = <span className="ml-2 text-[9px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Solicitante</span>; }
                return (
                  <div key={msg.id} className={`p-3 rounded-xl border ${boxClass}`}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center"><span className="text-xs font-bold text-gray-800">{msg.autor}</span>{badge}</div>
                      <span className="text-[10px] text-gray-400 font-semibold">{msg.data}</span>
                    </div>
                    <p className="text-sm text-gray-700">{msg.texto}</p>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-row gap-2 items-center mt-2 w-full">
              <textarea value={novoComentario} onChange={e => setNovoComentario(e.target.value)} className="flex-grow min-w-0 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-400 resize-none h-16 md:h-20" placeholder="Escreva um comentário..."/>
              <button onClick={addComentario} className="shrink-0 w-16 h-16 md:w-20 md:h-20 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors flex items-center justify-center"><Send size={18} className="ml-1" /></button>
            </div>
          </div>
        </div>
        <div className="p-3 md:p-4 bg-gray-100 flex justify-end gap-2 md:gap-3 border-t">
          {podeDeletar && <button onClick={() => onDelete(card.id)} className="text-red-600 px-2 py-2 md:px-4 font-bold text-[10px] md:text-sm mr-auto hover:bg-red-50 rounded-lg transition-colors">Excluir</button>}
          <button onClick={onClose} className="px-3 md:px-5 py-2 font-bold text-xs md:text-sm hover:bg-gray-200 rounded-lg transition-colors">Fechar</button>
          <button onClick={() => onSave({...card, titulo, descricao: desc, checklist, prioridade, comentarios, prazo, autor: card?.autor || user.nome})} className="px-4 md:px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs md:text-sm shadow-lg hover:bg-emerald-700 transition-colors">Salvar Tudo</button>
        </div>
      </div>
    </div>
  );
}

// Main App
export default function App() {
  const [user, setUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  
  const [currentScreen, setCurrentScreen] = useState('login');
  
  const [filtroAtivo, setFiltroAtivo] = useState('todas');
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [cols, setCols] = useState([]);
  const [cards, setCards] = useState({});
  const [modal, setModal] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('demandaflow_user');
    const token = localStorage.getItem('demandaflow_token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
      setCurrentScreen('board');
    } else {
      handleLogout();
    }
  }, []);

  const fetchUsers = async () => {
    const res = await authFetch(`${API}/users`);
    if(res.ok) {
      const data = await res.json();
      setAllUsers(data);
    }
  };

  const sync = async () => {
    if (!user || currentScreen !== 'board') return;
    setIsSyncing(true);
    try {
      const [cRes, kRes, uRes] = await Promise.all([authFetch(`${API}/columns`), authFetch(`${API}/cards`), authFetch(`${API}/users`)]);
      if(cRes.ok && kRes.ok && uRes.ok) {
        const cData = await cRes.json();
        const kData = await kRes.json();
        const uData = await uRes.json();
        
        setCols(cData);
        setAllUsers(uData);
        
        const map = {};
        kData.forEach(k => { map[k.id] = k; });
        setCards(map);
      }
    } catch(e) {
      console.error("Erro no sync", e);
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  useEffect(() => { if(user && currentScreen === 'board') sync(); }, [user, currentScreen]);

  const handleLogin = (loggedUser) => {
    localStorage.setItem('demandaflow_token', loggedUser.token);
    if (loggedUser.senha_temporaria) {
      setUser(loggedUser);
      setCurrentScreen('change_password');
    } else {
      setUser(loggedUser);
      localStorage.setItem('demandaflow_user', JSON.stringify(loggedUser));
      setCurrentScreen('board');
    }
  };

  const handlePasswordChanged = () => {
    const updatedUser = { ...user, senha_temporaria: false };
    setUser(updatedUser);
    localStorage.setItem('demandaflow_user', JSON.stringify(updatedUser));
    setCurrentScreen('board');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('demandaflow_user');
    localStorage.removeItem('demandaflow_token');
    setCurrentScreen('login');
  };

  const handleSaveCard = (d) => {
    let finalStatus = modal.status; let finalPriority = d.prioridade; 
    const total = d.checklist?.length || 0; const concluidas = d.checklist?.filter(c => c.concluido).length || 0;
    if (total > 0) {
      if (concluidas === total) { const colDestino = cols.find(c => c.auto_concluido); if (colDestino) finalStatus = colDestino.id; } 
      else if (concluidas > 0) { const colDestino = cols.find(c => c.auto_andamento); const colAtual = cols.find(c => c.id === finalStatus); if (colDestino && !colAtual?.auto_concluido && !colAtual?.auto_andamento) { finalStatus = colDestino.id; } }
    }
    const targetCol = cols.find(c => c.id === finalStatus);
    if (targetCol && targetCol.auto_concluido) { finalPriority = 'Baixa'; }

    const method = d.id ? 'PUT' : 'POST'; const url = d.id ? `${API}/cards/${d.id}` : `${API}/cards`;
    authFetch(url, { method, body: JSON.stringify({...d, status: finalStatus, prioridade: finalPriority}) }).then(() => { setModal(null); sync(); });
  };

  const onDragEnd = (result) => {
    const { destination, source, draggableId, type } = result;
    if (!destination || user.role !== 'admin') return;

    if (type === 'column') {
      const newCols = Array.from(cols); const [removed] = newCols.splice(source.index, 1); newCols.splice(destination.index, 0, removed);
      const updated = newCols.map((c, i) => ({ ...c, ordem: i })); setCols(updated);
      updated.forEach(c => authFetch(`${API}/columns/${c.id}`, { method: 'PUT', body: JSON.stringify(c) }));
      return;
    }
    const card = cards[draggableId]; let finalPriority = card.prioridade;
    const targetCol = cols.find(c => c.id === destination.droppableId);
    if (targetCol && targetCol.auto_concluido) { finalPriority = 'Baixa'; }
    authFetch(`${API}/cards/${draggableId}`, { method: 'PUT', body: JSON.stringify({ ...card, status: destination.droppableId, prioridade: finalPriority }) }).then(sync);
  };

  if (!user || currentScreen === 'login') return <LoginScreen onLogin={handleLogin} />;
  if (currentScreen === 'change_password') return <ChangePasswordScreen user={user} onPasswordChanged={handlePasswordChanged} />;
  if (currentScreen === 'admin') return <AdminPanel onBack={() => setCurrentScreen('board')} currentUsers={allUsers} refreshUsers={fetchUsers} />;

  return (
    <div className="relative min-h-[100dvh] p-3 md:p-8 font-sans flex flex-col overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-800 via-teal-900 to-emerald-900 -z-10" />

      {modal && <CardModal card={modal.card} col={cols.find(c => c.id === modal.status)} user={user} allUsers={allUsers} onClose={() => setModal(null)} onSave={handleSaveCard} onDelete={id => authFetch(`${API}/cards/${id}`, { method: 'DELETE' }).then(() => { setModal(null); sync(); })} />}

      <header className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-3 bg-white/10 p-3 md:p-4 rounded-2xl backdrop-blur-md shrink-0 relative z-[110]">
        <div className="w-full flex justify-between items-center sm:w-auto">
          <h1 className="text-2xl md:text-3xl font-black text-white italic tracking-tighter uppercase">Kyndo</h1>
          <button onClick={sync} className="sm:hidden flex items-center justify-center p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white border border-white/10 shadow-lg">
            <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full sm:w-auto justify-end relative">
          <button onClick={sync} className="hidden sm:flex items-center justify-center p-2 px-3 bg-white/20 hover:bg-white/30 rounded-xl text-white border border-white/10 transition-colors shadow-lg">
            <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
          </button>

          <div className="relative flex-grow sm:flex-none">
            <div onClick={() => setFiltroAberto(!filtroAberto)} className="flex items-center justify-between gap-2 bg-white/90 p-2 md:px-4 rounded-xl text-gray-800 shadow-lg border border-white/20 cursor-pointer h-full transition-colors hover:bg-white">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-emerald-600 shrink-0" />
                <span className="font-bold text-xs md:text-sm truncate">
                  {filtroAtivo === 'todas' ? 'Todas Demandas' : filtroAtivo === 'minhas' ? 'Minhas Demandas' : `Prio: ${filtroAtivo}`}
                </span>
              </div>
              <ChevronDown size={14} className="text-gray-500 shrink-0" />
            </div>
            
            {filtroAberto && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFiltroAberto(false)} />
                <div className="absolute top-full mt-2 right-0 sm:right-auto w-full min-w-[180px] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  {[{ val: 'todas', label: 'Todas as Demandas' }, { val: 'minhas', label: 'Minhas Demandas' }, { divider: true }, { val: 'Baixa', label: 'Prioridade: Baixa' }, { val: 'Normal', label: 'Prioridade: Normal' }, { val: 'Alta', label: 'Prioridade: Alta' }, { val: 'Urgente', label: 'Prioridade: Urgente' }].map((opcao, i) => 
                    opcao.divider ? (<div key={`div-${i}`} className="h-px bg-gray-100 my-1 mx-2" />) : (
                      <div key={opcao.val} onClick={() => { setFiltroAtivo(opcao.val); setFiltroAberto(false); }} className={`p-3 px-4 hover:bg-emerald-50 cursor-pointer text-xs md:text-sm font-bold transition-colors ${filtroAtivo === opcao.val ? 'text-emerald-600 bg-emerald-50/50' : 'text-gray-700'}`}>
                        {opcao.label}
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-4 bg-white/20 p-2 md:px-4 rounded-xl text-white border border-white/10">
            <div className="flex items-center gap-1 md:gap-2">
              <User size={16} />
              <span className="font-bold text-xs md:text-sm truncate max-w-[80px] md:max-w-none">{user.nome}</span>
            </div>
            
            {user.role === 'admin' && (
              <button onClick={() => { setCurrentScreen('admin'); fetchUsers(); }} className="text-[10px] md:text-xs bg-orange-500 hover:bg-orange-600 px-2 md:px-3 py-1 rounded font-bold uppercase transition-colors shadow-md">
                Admin
              </button>
            )}

            <button onClick={handleLogout} className="text-red-300 hover:text-red-100 p-1 ml-1 md:ml-2 transition-colors border-l border-white/20 pl-2 md:pl-4" title="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="overflow-y-auto overflow-x-hidden md:overflow-x-auto md:overflow-y-hidden flex-grow pb-10 md:pb-4 custom-scrollbar">
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="board" direction="horizontal" type="column">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="flex flex-col md:flex-row gap-4 md:gap-4 items-center md:items-start h-full w-full md:w-max px-1 md:px-2">
                
                {cols.map((col, index) => (
                  <Draggable key={col.id} draggableId={col.id} index={index} isDragDisabled={user.role !== 'admin'}>
                    {(p, snapshot) => (
                      <div ref={p.innerRef} {...p.draggableProps} className={`w-full md:w-[calc((100vw-9rem)/5)] shrink-0 flex flex-col rounded-2xl shadow-xl h-fit min-h-[120px] md:h-full max-h-[75vh] md:max-h-[calc(100dvh-8rem)] transition-transform ${snapshot.isDragging ? 'rotate-[2deg] scale-105 z-50 ring-2 ring-emerald-400' : ''}`} style={{ ...p.draggableProps.style, backgroundColor: col.cor }}>
                        
                        <div {...p.dragHandleProps} className="p-3 pl-4 flex items-center justify-between gap-2 relative shrink-0">
                          <div className="flex items-center gap-2">
                            {col.publica ? <Unlock size={12} className="text-green-600"/> : <Lock size={12} className="text-gray-500"/>}
                            <input disabled={user.role !== 'admin'} value={col.titulo} onChange={e => {
                                const newCol = {...col, titulo: e.target.value};
                                authFetch(`${API}/columns/${col.id}`, { method: 'PUT', body: JSON.stringify(newCol) }).then(sync);
                            }} className="bg-transparent font-bold text-gray-800 text-[11px] w-full outline-none uppercase tracking-widest" />
                          </div>
                          {user.role === 'admin' && <button onClick={() => setActiveMenu(activeMenu === col.id ? null : col.id)} className="p-1 hover:bg-black/5 rounded transition-colors"><MoreHorizontal size={18}/></button>}
                          {activeMenu === col.id && <ListActionsMenu col={col} user={user} onClose={() => setActiveMenu(null)} onAddCard={() => setModal({status: col.id})} onArchiveList={() => {authFetch(`${API}/columns/${col.id}`, { method: 'PUT', body: JSON.stringify({...col, arquivado: true}) }).then(sync);}} onUpdateCol={(data) => {authFetch(`${API}/columns/${col.id}`, { method: 'PUT', body: JSON.stringify(data) }).then(sync);}} />}
                        </div>

                        <Droppable droppableId={col.id} type="card">
                          {(dp) => (
                            <div {...dp.droppableProps} ref={dp.innerRef} className="px-2 pb-2 flex-grow overflow-y-auto space-y-2 custom-scrollbar min-h-[50px]">
                              {Object.values(cards)
                                .filter(k => k.status === col.id)
                                .filter(k => {
                                  if (filtroAtivo === 'minhas') return k.autor === user.nome;
                                  if (['Baixa', 'Normal', 'Alta', 'Urgente'].includes(filtroAtivo)) return k.prioridade === filtroAtivo;
                                  return true;
                                })
                                .map((card, ki) => {
                                const totalEtapas = card.checklist?.length || 0;
                                const concluidas = card.checklist?.filter(c => c.concluido).length || 0;
                                const progresso = totalEtapas > 0 ? Math.round((concluidas / totalEtapas) * 100) : 0;
                                const isAdmin = user.role === 'admin';
                                const qtdComentarios = card.comentarios?.length || 0;

                                const stylePrioridade = PRIORIDADE_CARD_STYLE[card.prioridade || 'Normal'];

                                return (
                                  <Draggable key={card.id} draggableId={card.id} index={ki} isDragDisabled={!isAdmin}>
                                    {(kp) => (
                                      <div ref={kp.innerRef} {...kp.draggableProps} {...kp.dragHandleProps} onClick={() => setModal({card, status: col.id})} className={`p-3 rounded-xl cursor-pointer hover:opacity-80 transition-all flex flex-col gap-2 ${stylePrioridade}`}>
                                        
                                        <div className="flex justify-between items-start">
                                          <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded ${PRIORIDADES_BADGE[card.prioridade || 'Normal']}`}>
                                            {card.prioridade || 'Normal'}
                                          </span>
                                          {card.prazo && (
                                            <span className="flex items-center gap-1 text-[10px] text-orange-700 bg-orange-100 font-bold px-1.5 py-0.5 rounded">
                                              <Calendar size={10} /> {formatarData(card.prazo)}
                                            </span>
                                          )}
                                        </div>

                                        <p className="text-sm font-bold text-gray-800 leading-tight">{card.titulo}</p>
                                        
                                        {totalEtapas > 0 && concluidas > 0 && (
                                          <div>
                                            <div className="flex justify-between items-center mb-1">
                                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Progresso</span>
                                              <span className="text-[10px] font-bold text-gray-700">{progresso}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-gray-300/50 rounded-full overflow-hidden">
                                              <div className={`h-full transition-all duration-300 ${progresso === 100 ? 'bg-emerald-600' : 'bg-teal-500'}`} style={{ width: `${progresso}%` }} />
                                            </div>
                                          </div>
                                        )}

                                        <div className="flex justify-between items-center mt-1 border-t pt-2 border-black/10">
                                          <p className="text-[9px] text-gray-600 uppercase font-bold tracking-tighter">De: {card.autor}</p>
                                          {qtdComentarios > 0 && (
                                            <div className="flex items-center gap-1 text-[10px] text-gray-600 font-bold bg-white/60 px-1.5 rounded">
                                              <MessageSquare size={10} /> {qtdComentarios}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                )
                              })}
                              {dp.placeholder}
                            </div>
                          )}
                        </Droppable>

                        {(user.role === 'admin' || col.publica) && (
                          <button onClick={() => setModal({status: col.id})} className="m-2 mt-auto shrink-0 p-2 text-xs font-bold text-gray-500 hover:bg-black/5 rounded-xl flex items-center gap-2 transition-colors">
                            <Plus size={16}/> Sugerir demanda
                          </button>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                
                {provided.placeholder}

                {user.role === 'admin' && (
                  <button onClick={() => { authFetch(`${API}/columns`, {method: 'POST', body: JSON.stringify({id: `col-${Date.now()}`, titulo: 'Nova Coluna', cor: '#ebecf0', ordem: cols.length, publica: false, auto_andamento: false, auto_concluido: false})}).then(sync); }} className="w-full md:w-[calc((100vw-9rem)/5)] shrink-0 h-16 bg-white/10 hover:bg-white/20 border-2 border-white/30 border-dashed rounded-2xl flex items-center justify-center text-white transition-all cursor-pointer">
                    <Plus size={20} className="mr-2" />
                    <span className="font-bold text-sm">Adicionar Coluna</span>
                  </button>
                )}

              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
}
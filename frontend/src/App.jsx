import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, MoreHorizontal, Lock, Unlock, Calendar, RefreshCw, LogOut, User, Filter, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2, MessageSquare, Search, Pin, PinOff } from 'lucide-react';

import { API, authFetch } from './api.js';
import { APP_VERSION, PRIORIDADES_BADGE, PRIORIDADE_CARD_STYLE, PRIORIDADE_ORDEM, formatarData, hasPermission, userColor, GitHubIcon } from './constants.jsx';

import LoginScreen from './components/LoginScreen.jsx';
import ChangePasswordScreen from './components/ChangePasswordScreen.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import ListActionsMenu from './components/ListActionsMenu.jsx';
import CardModal from './components/CardModal.jsx';
import CronogramaView from './components/CronogramaView.jsx';
import NotasView from './components/NotasView.jsx';
import DesenhoView from './components/DesenhoView.jsx';
import DashboardView from './components/DashboardView.jsx';
import SearchModal from './components/SearchModal.jsx';

export default function App() {
  const [user, setUser]           = useState(null);
  const [allUsers, setAllUsers]   = useState([]);
  const [currentScreen, setCurrentScreen] = useState('login');
  const [filtroAtivo, setFiltroAtivo]   = useState('todas');
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [ordenacao, setOrdenacao]       = useState('prioridade_desc');
  const [cols, setCols]   = useState([]);
  const [cards, setCards] = useState({});
  const [modal, setModal] = useState(null);
  const [activeMenu, setActiveMenu]     = useState(null);
  const [isSyncing, setIsSyncing]       = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [headerPinned, setHeaderPinned] = useState(() => localStorage.getItem('kyndo_header_pinned') === 'true');
  const [headerHeight, setHeaderHeight] = useState(0);
  const [showLeftArrow, setShowLeftArrow]   = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [activeView, setActiveView] = useState('board');
  const [colOrder, setColOrder] = useState({});   // explicit per-column card order after drag
  const [showSearch, setShowSearch] = useState(false);
  const [pendingOpenItem, setPendingOpenItem] = useState(null); // { type: 'nota'|'desenho', id }
  const boardRef = useRef(null);
  const colTitleTimers = useRef({});
  const isDragging = useRef(false);
  const syncBlockedUntil = useRef(0);
  const cardsRef = useRef({});

  // Mark a card as seen (clears its "changed" badge for this user only) whenever it's opened
  useEffect(() => {
    const id = modal?.card?.id;
    if (!id) return;
    authFetch(`${API}/cards/${id}/seen`, { method: 'POST' });
    setCards(prev => prev[id] ? { ...prev, [id]: { ...prev[id], nao_visto: false, alteracoes_nao_vistas: 0 } } : prev);
  }, [modal?.card?.id]);

  // Make the browser's back/forward buttons navigate between views (Quadro/Cronograma/
  // Notas/Desenho) and open/closed cards instead of leaving the site entirely — by
  // default none of this touches browser history, so "voltar" just exits to whatever
  // page was open before the site. isPopStateNav guards against feeding our own
  // pushState calls back into another pushState when restoring from popstate.
  const isPopStateNav = useRef(false);
  useEffect(() => {
    if (currentScreen !== 'board') return;
    history.replaceState({ view: activeView, cardId: null }, '');
    const onPopState = (e) => {
      isPopStateNav.current = true;
      const state = e.state || {};
      setActiveView(state.view || 'board');
      const card = state.cardId ? cardsRef.current[state.cardId] : null;
      setModal(card ? { card, status: card.status } : null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [currentScreen]);

  const modalNavKey = modal ? (modal.card?.id ?? 'new') : null;
  useEffect(() => {
    if (currentScreen !== 'board') return;
    if (isPopStateNav.current) { isPopStateNav.current = false; return; }
    history.pushState({ view: activeView, cardId: modal?.card?.id ?? null }, '');
  }, [activeView, modalNavKey, currentScreen]);

  // Ctrl+K / Cmd+K to open search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowSearch(s => !s); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Horizontal scroll via mouse wheel on board
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const handler = (e) => { if (e.deltaY !== 0) { e.preventDefault(); el.scrollLeft += e.deltaY; } };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Restore session
  useEffect(() => {
    const savedUser = sessionStorage.getItem('demandaflow_user');
    const token     = sessionStorage.getItem('demandaflow_token');
    if (savedUser && token) { setUser(JSON.parse(savedUser)); setCurrentScreen('board'); }
    else handleLogout();
  }, []);

  const fetchUsers = async () => {
    const res = await authFetch(`${API}/users`);
    if (res.ok) setAllUsers(await res.json());
  };

  const sync = async () => {
    if (!user || currentScreen !== 'board' || isDragging.current || Date.now() < syncBlockedUntil.current) return;
    setIsSyncing(true);
    try {
      const [cRes, kRes, uRes] = await Promise.all([
        authFetch(`${API}/columns`), authFetch(`${API}/cards`), authFetch(`${API}/users`)
      ]);
      if (cRes.ok && kRes.ok && uRes.ok) {
        const [cData, kData, uData] = await Promise.all([cRes.json(), kRes.json(), uRes.json()]);
        setCols(cData);
        setAllUsers(uData);
        const map = {};
        kData.forEach(k => { map[k.id] = k; });
        cardsRef.current = map;
        setCards(map);
      }
    } catch (e) { console.error('sync error', e); }
    finally { setTimeout(() => setIsSyncing(false), 500); }
  };

  useEffect(() => { cardsRef.current = cards; }, [cards]);

  useEffect(() => { if (user && currentScreen === 'board') sync(); }, [user, currentScreen]);
  useEffect(() => {
    if (!user || currentScreen !== 'board') return;
    const t = setInterval(sync, 10000);
    return () => clearInterval(t);
  }, [user, currentScreen]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () =>
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();

  useEffect(() => { localStorage.setItem('kyndo_header_pinned', headerPinned ? 'true' : 'false'); }, [headerPinned]);

  // Measure header height so pinned content can offset itself correctly.
  // Callback ref (not useRef+useEffect) because the header only mounts after
  // login, well after App's initial mount/effects have already run.
  const headerRef = useCallback((node) => {
    if (!node) return;
    const update = () => setHeaderHeight(node.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const showHeader = headerVisible || headerPinned;

  const handleLogin = (loggedUser) => {
    sessionStorage.setItem('demandaflow_token', loggedUser.token);
    if (loggedUser.senha_temporaria) {
      setUser(loggedUser); setCurrentScreen('change_password');
    } else {
      setUser(loggedUser);
      sessionStorage.setItem('demandaflow_user', JSON.stringify(loggedUser));
      setCurrentScreen('board');
    }
  };

  const handlePasswordChanged = () => {
    const updated = { ...user, senha_temporaria: false };
    setUser(updated);
    sessionStorage.setItem('demandaflow_user', JSON.stringify(updated));
    setCurrentScreen('board');
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('demandaflow_user');
    sessionStorage.removeItem('demandaflow_token');
    setCurrentScreen('login');
  };

  const handleSaveCard = (d) => {
    let finalStatus   = modal.status;
    let finalPriority = d.prioridade;
    const cl  = d.checklist || [];
    const pct = cl.length > 0 ? Math.round(cl.reduce((acc, item) => {
      const subs = item.subetapas || [];
      return acc + (subs.length === 0 ? (item.concluido ? 1 : 0) : subs.filter(s => s.concluido).length / subs.length);
    }, 0) / cl.length * 100) : 0;
    if (cl.length > 0) {
      if (pct === 100) { const dest = cols.find(c => c.auto_concluido); if (dest) finalStatus = dest.id; }
      else if (pct > 0) {
        const dest    = cols.find(c => c.auto_andamento);
        const current = cols.find(c => c.id === finalStatus);
        if (dest && !current?.auto_concluido && !current?.auto_andamento) finalStatus = dest.id;
      }
    }
    const targetCol = cols.find(c => c.id === finalStatus);
    if (targetCol?.auto_concluido) finalPriority = 'Baixa';

    const method  = d.id ? 'PUT' : 'POST';
    const url     = d.id ? `${API}/cards/${d.id}` : `${API}/cards`;
    const payload = { ...d, status: finalStatus, prioridade: finalPriority };
    authFetch(url, { method, body: JSON.stringify(payload) }).then(async res => {
      // Fechar o modal sem olhar o status jogava fora tudo que a pessoa
      // digitou quando o servidor recusava (403 ao criar em coluna privada,
      // por exemplo) — e sem nenhuma mensagem. Erro mantém o modal aberto.
      if (!res.ok) {
        const corpo = await res.json().catch(() => ({}));
        alert(corpo.detail || 'Não foi possível salvar. Nada foi perdido — tente de novo.');
        return;
      }
      if (method === 'PUT')
        setCards(prev => prev[d.id] ? { ...prev, [d.id]: { ...prev[d.id], ...payload } } : prev);
      setModal(null);
      sync();
    }).catch(() => alert('Falha de conexão com o servidor. Nada foi salvo.'));
  };

  const onDragStart = () => { isDragging.current = true; };

  // Returns the visible sorted card IDs for a column (matches what's rendered)
  const getColCardIds = (colId, latestCards) => {
    if (colOrder[colId]) {
      // Use explicit order, filtered to only cards still in this column
      return colOrder[colId].filter(id => latestCards[id]?.status === colId);
    }
    return Object.values(latestCards)
      .filter(c => c.status === colId)
      .sort((a, b) => {
        if (ordenacao === 'prioridade_desc') {
          const d = (PRIORIDADE_ORDEM[b.prioridade] || 0) - (PRIORIDADE_ORDEM[a.prioridade] || 0);
          return d !== 0 ? d : (a.ordem ?? 0) - (b.ordem ?? 0);
        }
        if (ordenacao === 'prioridade_asc') {
          const d = (PRIORIDADE_ORDEM[a.prioridade] || 0) - (PRIORIDADE_ORDEM[b.prioridade] || 0);
          return d !== 0 ? d : (a.ordem ?? 0) - (b.ordem ?? 0);
        }
        return (a.ordem ?? 0) - (b.ordem ?? 0);
      })
      .map(c => c.id);
  };

  const onDragEnd = (result) => {
    isDragging.current = false;
    syncBlockedUntil.current = Date.now() + 2000; // block sync for 2s after drag
    const { destination, source, draggableId, type } = result;
    if (!destination) return;
    if (type === 'column' && !hasPermission(user, 'gerenciar_colunas')) return;
    if (type === 'card' && !hasPermission(user, 'reordenar_cards')) return;

    if (type === 'column') {
      const newCols = Array.from(cols);
      const [removed] = newCols.splice(source.index, 1);
      newCols.splice(destination.index, 0, removed);
      const updated = newCols.map((c, i) => ({ ...c, ordem: i }));
      setCols(updated);
      updated.forEach(c => authFetch(`${API}/columns/${c.id}`, { method: 'PUT', body: JSON.stringify(c) }));
      return;
    }

    const latestCards = cardsRef.current;
    const card      = latestCards[draggableId];
    // Um sync que resolva no meio do arrasto pode ter tirado o card do mapa;
    // sem isso, o acesso a card.prioridade logo abaixo estoura.
    if (!card) return;
    const sameCol   = source.droppableId === destination.droppableId;
    const targetCol = cols.find(c => c.id === destination.droppableId);
    const finalPriority = (targetCol?.auto_concluido) ? 'Baixa' : card.prioridade;

    // source.index/destination.index são posições na lista RENDERIZADA, que o
    // filtroAtivo encurta. Aplicar esses índices direto na lista completa move
    // o card errado — por isso os dois ramos abaixo traduzem via âncora.
    const applyFilter = (id) => {
      const c = latestCards[id];
      if (!c) return false;
      if (filtroAtivo === 'minhas') return c.autor === user.nome || (c.responsaveis || []).includes(user.nome);
      if (['Baixa', 'Normal', 'Alta', 'Urgente'].includes(filtroAtivo)) return c.prioridade === filtroAtivo;
      return true;
    };

    if (sameCol) {
      const ids = getColCardIds(source.droppableId, latestCards);
      // Tira o card arrastado e reinsere na frente do card que estava na
      // posição de destino da lista visível (mesma tradução do ramo entre
      // colunas, que já fazia isso certo).
      const semMovido = ids.filter(id => id !== draggableId);
      const visiveisSemMovido = semMovido.filter(applyFilter);
      const anchorId = visiveisSemMovido[destination.index];
      const insertAt = anchorId !== undefined ? semMovido.indexOf(anchorId) : semMovido.length;
      const novaOrdem = [...semMovido];
      novaOrdem.splice(insertAt, 0, draggableId);

      const reordered = novaOrdem.map((id, i) => ({ id, ordem: i }));
      setColOrder(prev => ({ ...prev, [source.droppableId]: novaOrdem }));
      setCards(prev => {
        const next = { ...prev };
        reordered.forEach(({ id, ordem }) => { if (next[id]) next[id] = { ...next[id], ordem }; });
        cardsRef.current = next;
        return next;
      });
      authFetch(`${API}/cards/reorder`, {
        method: 'PUT',
        body: JSON.stringify(reordered),
      });
    } else {
      const updatedCard = { ...card, status: destination.droppableId, prioridade: finalPriority };

      // Clean source: remove ghosts and the dragged card itself
      const newSrcIds = (colOrder[source.droppableId] || getColCardIds(source.droppableId, latestCards))
        .filter(id => id !== draggableId && latestCards[id]?.status === source.droppableId);

      // Clean destination: remove ghosts (cards no longer in this column)
      const cleanDstIds = (colOrder[destination.droppableId] || getColCardIds(destination.droppableId, latestCards))
        .filter(id => id !== draggableId && latestCards[id]?.status === destination.droppableId);

      // destination.index is a position in the rendered (filtroAtivo-filtered) list.
      // Map it to the correct insertion point in cleanDstIds.
      const visibleDstIds = cleanDstIds.filter(applyFilter);
      const anchorId = visibleDstIds[destination.index];
      const insertAt = anchorId !== undefined ? cleanDstIds.indexOf(anchorId) : cleanDstIds.length;
      const newDstIds = [...cleanDstIds];
      newDstIds.splice(insertAt, 0, draggableId);

      setCards(prev => {
        const next = { ...prev, [draggableId]: updatedCard };
        cardsRef.current = next;
        return next;
      });
      setColOrder(prev => ({
        ...prev,
        [source.droppableId]: newSrcIds,
        [destination.droppableId]: newDstIds,
      }));
      // Encadeado, não em paralelo: o PUT do card carrega o `ordem` ANTIGO, e
      // disparar os dois juntos deixava a ordem final na sorte de qual
      // resposta chegasse por último — se o reorder ganhasse a corrida, o card
      // voltava pro lugar de origem no próximo reload.
      const ordensNovas = [
        ...newSrcIds.map((id, i) => ({ id, ordem: i })),
        ...newDstIds.map((id, i) => ({ id, ordem: i })),
      ];
      authFetch(`${API}/cards/${draggableId}`, {
        method: 'PUT',
        body: JSON.stringify(updatedCard),
      }).then(() => authFetch(`${API}/cards/reorder`, {
        method: 'PUT',
        body: JSON.stringify(ordensNovas),
      }));
    }
  };

  const handleColTitleChange = (col, newTitle) => {
    setCols(prev => prev.map(c => c.id === col.id ? { ...c, titulo: newTitle } : c));
    clearTimeout(colTitleTimers.current[col.id]);
    colTitleTimers.current[col.id] = setTimeout(() => {
      authFetch(`${API}/columns/${col.id}`, { method: 'PUT', body: JSON.stringify({ ...col, titulo: newTitle }) });
    }, 500);
  };

  if (!user || currentScreen === 'login') return <LoginScreen onLogin={handleLogin} />;
  if (currentScreen === 'change_password') return <ChangePasswordScreen user={user} onPasswordChanged={handlePasswordChanged} />;
  if (currentScreen === 'admin') return <AdminPanel user={user} onBack={() => setCurrentScreen('board')} currentUsers={allUsers} refreshUsers={fetchUsers} />;

  const canManageColumns = hasPermission(user, 'gerenciar_colunas');
  const canReorderCards = hasPermission(user, 'reordenar_cards');
  const canCreateCardAnywhere = hasPermission(user, 'criar_card_coluna_privada');
  const canAccessAdminPanel = ['gerenciar_usuarios', 'excluir_usuarios', 'gerenciar_cargos', 'ver_log_auditoria']
    .some(key => hasPermission(user, key));
  const cardsArray = Object.values(cards);

  const openLinkedItem = (type, id) => {
    setActiveView(type === 'nota' ? 'notas' : 'desenho');
    setPendingOpenItem({ type, id });
    setModal(null);
  };

  const onNavigateToCard = (cardId) => {
    const card = cardsRef.current[cardId];
    if (card) setModal({ card, status: card.status });
  };

  return (
    <div className="relative h-[100dvh] font-sans overflow-hidden"
      onMouseMove={e => { setShowLeftArrow(e.clientX < 80); setShowRightArrow(e.clientX > window.innerWidth - 80); }}>
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 -z-10" />
      <span className="fixed bottom-1.5 right-2 z-[5] text-[9px] text-white/20 font-mono pointer-events-none select-none">{APP_VERSION}</span>

      {showSearch && (
        <SearchModal
          cards={cards}
          cols={cols}
          onSelect={card => setModal({ card, status: card.status })}
          onClose={() => setShowSearch(false)}
        />
      )}

      {modal && (
        <CardModal
          // Sem key, navegar de card pra card (menção @[card:...], Cronograma,
          // Dashboard, busca, botão voltar) reaproveita a mesma instância — e
          // o CardModal semeia todo o estado editável em inicializadores
          // useState, que só rodam na montagem. O título/descrição/checklist do
          // card anterior ficavam no estado e "Salvar Tudo" gravava o conteúdo
          // de um card em cima do outro. A key força a remontagem.
          key={modal.card?.id || 'novo-card'}
          card={modal.card}
          col={cols.find(c => c.id === modal.status)}
          allColumns={cols}
          user={user}
          allUsers={allUsers}
          allCards={cardsArray}
          onClose={() => setModal(null)}
          onSave={handleSaveCard}
          onDelete={id => authFetch(`${API}/cards/${id}`, { method: 'DELETE' }).then(async res => {
            if (!res.ok) {
              const corpo = await res.json().catch(() => ({}));
              alert(corpo.detail || 'Não foi possível excluir este card.');
              return;
            }
            setModal(null);
            sync();
          }).catch(() => alert('Falha de conexão com o servidor.'))}
          onOpenLinkedItem={openLinkedItem}
          onNavigateToCard={onNavigateToCard}
          onMerged={async ({ destino_id }) => {
            // O card aberto acabou de ser apagado no servidor — fecha antes de
            // recarregar, senão o modal fica preso num card que não existe mais.
            setModal(null);
            syncBlockedUntil.current = 0;
            await sync();
            const destino = cardsRef.current[destino_id];
            if (destino) setModal({ card: destino, status: destino.status });
          }}
        />
      )}

      {/* Header trigger zone */}
      {!headerPinned && (
        <div className="fixed top-0 left-0 right-0 h-4 z-[120]" onMouseEnter={() => setHeaderVisible(true)} />
      )}
      <header
        ref={headerRef}
        className={`fixed top-0 left-0 right-0 z-[110] flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-900/90 border-b border-slate-800 p-3 md:p-4 rounded-b-2xl backdrop-blur-md transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}
        onMouseEnter={() => setHeaderVisible(true)}
        onMouseLeave={() => setHeaderVisible(false)}
      >
        <div className="w-full flex justify-between items-center sm:w-auto">
          <h1 className="text-2xl md:text-3xl font-black text-white italic tracking-tighter uppercase">Kyndo</h1>
          <button onClick={sync} className="sm:hidden flex items-center justify-center p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white border border-white/10 shadow-lg">
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full sm:w-auto justify-end relative">
          <button onClick={() => setHeaderPinned(p => !p)} className={`hidden sm:flex items-center justify-center p-2 px-3 rounded-xl border transition-colors shadow-lg ${headerPinned ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-300' : 'bg-white/20 hover:bg-white/30 text-white border-white/10'}`} title={headerPinned ? 'Desafixar cabeçalho' : 'Fixar cabeçalho'}>
            {headerPinned ? <PinOff size={18} /> : <Pin size={18} />}
          </button>
          <button onClick={toggleFullscreen} className="hidden sm:flex items-center justify-center p-2 px-3 bg-white/20 hover:bg-white/30 rounded-xl text-white border border-white/10 transition-colors shadow-lg" title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}>
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button onClick={sync} className="hidden sm:flex items-center justify-center p-2 px-3 bg-white/20 hover:bg-white/30 rounded-xl text-white border border-white/10 transition-colors shadow-lg">
            <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowSearch(true)} className="hidden sm:flex items-center gap-2 p-2 px-3 bg-white/20 hover:bg-white/30 rounded-xl text-white border border-white/10 transition-colors shadow-lg" title="Buscar cards (Ctrl+K)">
            <Search size={18} />
            <span className="text-xs text-white/50 font-mono">Ctrl K</span>
          </button>

          {/* View tabs */}
          <div className="hidden sm:flex items-center bg-white/10 rounded-xl border border-white/10 p-0.5 shadow-lg">
            {[
              { key: 'board',      label: 'Quadro' },
              { key: 'cronograma', label: 'Cronograma' },
              { key: 'notas',      label: 'Notas' },
              { key: 'desenho',    label: 'Desenho' },
              { key: 'dashboard',  label: 'Dashboard' },
            ].map(v => (
              <button key={v.key} onClick={() => setActiveView(v.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeView === v.key ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow' : 'text-white hover:bg-white/10'}`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Filter dropdown */}
          <div className="relative flex-grow sm:flex-none">
            <div onClick={() => setFiltroAberto(!filtroAberto)} className="flex items-center justify-between gap-2 bg-slate-800/90 p-2 md:px-4 rounded-xl text-slate-100 shadow-lg border border-slate-700 cursor-pointer h-full transition-colors hover:bg-slate-800">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-emerald-400 shrink-0" />
                <span className="font-bold text-xs md:text-sm truncate">
                  {filtroAtivo === 'todas' ? 'Todas Demandas' : filtroAtivo === 'minhas' ? 'Minhas Demandas' : `Prio: ${filtroAtivo}`}
                  {ordenacao !== 'prioridade_desc' && <span className="ml-1 text-emerald-400">{ordenacao === 'prioridade_asc' ? '↑' : '–'}</span>}
                </span>
              </div>
              <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </div>
            {filtroAberto && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFiltroAberto(false)} />
                <div className="absolute top-full mt-2 right-0 sm:right-auto w-full min-w-[180px] bg-slate-800 rounded-xl shadow-2xl border border-slate-700 z-50 overflow-hidden">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-black text-slate-500 uppercase tracking-widest">Filtrar</div>
                  {[
                    { val: 'todas',  label: 'Todas as Demandas' },
                    { val: 'minhas', label: 'Minhas Demandas' },
                    { divider: true },
                    { val: 'Baixa',   label: 'Prioridade: Baixa' },
                    { val: 'Normal',  label: 'Prioridade: Normal' },
                    { val: 'Alta',    label: 'Prioridade: Alta' },
                    { val: 'Urgente', label: 'Prioridade: Urgente' },
                  ].map((o, i) =>
                    o.divider
                      ? <div key={`d${i}`} className="h-px bg-slate-700 my-1 mx-2" />
                      : <div key={o.val} onClick={() => { setFiltroAtivo(o.val); setFiltroAberto(false); }} className={`p-3 px-4 hover:bg-emerald-500/10 cursor-pointer text-xs md:text-sm font-bold transition-colors ${filtroAtivo === o.val ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-300'}`}>{o.label}</div>
                  )}
                  <div className="h-px bg-slate-700 my-1 mx-2" />
                  <div className="px-3 pt-2 pb-1 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ordenação</div>
                  {[
                    { val: 'prioridade_desc', label: '↓ Maior prioridade primeiro' },
                    { val: 'prioridade_asc',  label: '↑ Menor prioridade primeiro' },
                    { val: 'padrao',          label: '– Sem ordenação' },
                  ].map(o => (
                    <div key={o.val} onClick={() => { setOrdenacao(o.val); setFiltroAberto(false); }} className={`p-3 px-4 hover:bg-emerald-500/10 cursor-pointer text-xs md:text-sm font-bold transition-colors ${ordenacao === o.val ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-300'}`}>{o.label}</div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* User info */}
          <div className="flex items-center gap-2 md:gap-4 bg-white/20 p-2 md:px-4 rounded-xl text-white border border-white/10">
            <div className="flex items-center gap-1 md:gap-2">
              <User size={16} />
              <span className="font-bold text-xs md:text-sm truncate max-w-[80px] md:max-w-none">{user.nome}</span>
            </div>
            {canAccessAdminPanel && (
              <button onClick={() => { setCurrentScreen('admin'); fetchUsers(); }} className="text-[10px] md:text-xs bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 px-2 md:px-3 py-1 rounded font-bold uppercase transition-colors shadow-md">
                Config
              </button>
            )}
            <button onClick={handleLogout} className="text-red-300 hover:text-red-100 p-1 ml-1 md:ml-2 transition-colors border-l border-white/20 pl-2 md:pl-4" title="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Scroll arrows */}
      <button onClick={() => boardRef.current && (boardRef.current.scrollLeft -= 320)}
        className={`fixed left-2 top-1/2 -translate-y-1/2 z-[100] w-10 h-16 bg-black/40 text-white rounded-xl flex items-center justify-center transition-all duration-200 backdrop-blur-sm pointer-events-auto ${showLeftArrow && activeView === 'board' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <ChevronLeft size={28} />
      </button>
      <button onClick={() => boardRef.current && (boardRef.current.scrollLeft += 320)}
        className={`fixed right-2 top-1/2 -translate-y-1/2 z-[100] w-10 h-16 bg-black/40 text-white rounded-xl flex items-center justify-center transition-all duration-200 backdrop-blur-sm ${showRightArrow && activeView === 'board' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <ChevronRight size={28} />
      </button>

      {/* Non-board views */}
      {activeView === 'cronograma' && (
        <div className="absolute inset-0 transition-[top] duration-300" style={{ top: headerPinned ? headerHeight : 0 }}>
          <CronogramaView cards={cards} allUsers={allUsers} setModal={setModal} />
        </div>
      )}
      {activeView === 'notas' && (
        <div className="absolute inset-0 transition-[top] duration-300" style={{ top: headerPinned ? headerHeight : 0 }}>
          <NotasView user={user} allUsers={allUsers} cards={cardsArray}
            openItemId={pendingOpenItem?.type === 'nota' ? pendingOpenItem.id : null}
            onOpenItemHandled={() => setPendingOpenItem(null)} />
        </div>
      )}
      {activeView === 'desenho' && (
        <div className="absolute inset-0 transition-[top] duration-300" style={{ top: headerPinned ? headerHeight : 0 }}>
          <DesenhoView user={user} allUsers={allUsers} cards={cardsArray}
            openItemId={pendingOpenItem?.type === 'desenho' ? pendingOpenItem.id : null}
            onOpenItemHandled={() => setPendingOpenItem(null)} />
        </div>
      )}
      {activeView === 'dashboard' && (
        <div className="absolute inset-0 transition-[top] duration-300" style={{ top: headerPinned ? headerHeight : 0 }}>
          <DashboardView cardsById={cards} setModal={setModal} />
        </div>
      )}

      {/* Board view */}
      <div
        ref={boardRef}
        className={`h-full overflow-y-auto overflow-x-hidden md:overflow-x-auto md:overflow-y-hidden p-3 md:p-8 custom-scrollbar transition-[padding-top] duration-300 ${activeView !== 'board' ? 'invisible pointer-events-none absolute' : ''}`}
        style={{ paddingTop: headerPinned ? headerHeight + 12 : undefined }}
      >
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="relative min-h-full w-full">
            <Droppable droppableId="board" direction="horizontal" type="column">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="flex flex-col md:flex-row gap-4 items-start w-full">
                  {cols.map((col, index) => (
                    <Draggable key={col.id} draggableId={col.id} index={index} isDragDisabled={!canManageColumns}>
                      {(p, snapshot) => (
                        <div ref={p.innerRef} {...p.draggableProps}
                          className={`w-full md:flex-1 md:min-w-[220px] flex flex-col rounded-2xl shadow-xl border border-t-[6px] border-slate-800 min-h-[120px] max-h-[calc(100dvh-4rem)] transition-transform ${snapshot.isDragging ? 'rotate-[2deg] scale-105 z-50 ring-2 ring-emerald-400' : ''}`}
                          style={{ ...p.draggableProps.style, borderTopColor: col.cor, background: `linear-gradient(180deg, ${col.cor}2e 0%, #0f172a 60%)` }}>

                          <div {...p.dragHandleProps} className="p-3 pl-4 flex items-center justify-between gap-2 relative shrink-0">
                            <div className="flex items-center gap-2">
                              {col.publica ? <Unlock size={12} className="text-emerald-500" /> : <Lock size={12} className="text-slate-500" />}
                              <input
                                disabled={!canManageColumns}
                                value={col.titulo}
                                onChange={e => handleColTitleChange(col, e.target.value)}
                                className="bg-transparent font-bold text-slate-100 text-sm w-full outline-none uppercase tracking-widest disabled:opacity-100"
                              />
                            </div>
                            {canManageColumns && (
                              <button onClick={() => setActiveMenu(activeMenu === col.id ? null : col.id)} className="p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200 rounded transition-colors">
                                <MoreHorizontal size={18} />
                              </button>
                            )}
                            {activeMenu === col.id && (
                              <ListActionsMenu
                                col={col} user={user}
                                onClose={() => setActiveMenu(null)}
                                onAddCard={() => setModal({ status: col.id })}
                                onArchiveList={() => authFetch(`${API}/columns/${col.id}`, { method: 'PUT', body: JSON.stringify({ ...col, arquivado: true }) }).then(sync)}
                                onUpdateCol={data => authFetch(`${API}/columns/${col.id}`, { method: 'PUT', body: JSON.stringify(data) }).then(sync)}
                              />
                            )}
                          </div>

                          <Droppable droppableId={col.id} type="card">
                            {(dp, dpSnap) => (
                              <div {...dp.droppableProps} ref={dp.innerRef} className="px-2 pb-2 flex-grow overflow-y-auto space-y-2 custom-scrollbar min-h-[50px]">
                                {(() => {
                                    // Use explicit colOrder if set, else fall back to sort
                                    const colIds = colOrder[col.id];
                                    let sorted;
                                    if (colIds) {
                                      sorted = colIds
                                        .map(id => cards[id])
                                        .filter(c => c && c.status === col.id);
                                    } else {
                                      sorted = Object.values(cards)
                                        .filter(k => k.status === col.id)
                                        .sort((a, b) => {
                                          if (ordenacao === 'prioridade_desc') {
                                            const d = (PRIORIDADE_ORDEM[b.prioridade] || 0) - (PRIORIDADE_ORDEM[a.prioridade] || 0);
                                            return d !== 0 ? d : (a.ordem ?? 0) - (b.ordem ?? 0);
                                          }
                                          if (ordenacao === 'prioridade_asc') {
                                            const d = (PRIORIDADE_ORDEM[a.prioridade] || 0) - (PRIORIDADE_ORDEM[b.prioridade] || 0);
                                            return d !== 0 ? d : (a.ordem ?? 0) - (b.ordem ?? 0);
                                          }
                                          return (a.ordem ?? 0) - (b.ordem ?? 0);
                                        });
                                    }
                                    return sorted
                                      .filter(k => {
                                        if (filtroAtivo === 'minhas') return k.autor === user.nome || (k.responsaveis || []).includes(user.nome);
                                        if (['Baixa', 'Normal', 'Alta', 'Urgente'].includes(filtroAtivo)) return k.prioridade === filtroAtivo;
                                        return true;
                                      })
                                  })().map((card, ki) => {
                                    const clCard = card.checklist || [];
                                    const totalEtapas = clCard.length;
                                    const progresso = totalEtapas > 0 ? Math.round(
                                      clCard.reduce((acc, item) => {
                                        const subs = item.subetapas || [];
                                        return acc + (subs.length === 0 ? (item.concluido ? 1 : 0) : subs.filter(s => s.concluido).length / subs.length);
                                      }, 0) / totalEtapas * 100
                                    ) : 0;
                                    const qtdComentarios = card.comentarios?.length || 0;
                                    const stylePrioridade = PRIORIDADE_CARD_STYLE[card.prioridade || 'Normal'];

                                    return (
                                      <Draggable key={card.id} draggableId={card.id} index={ki} isDragDisabled={!canReorderCards}>
                                        {(kp, kSnap) => (
                                          <div ref={kp.innerRef} {...kp.draggableProps} {...kp.dragHandleProps}
                                            onClick={() => setModal({ card, status: col.id })}
                                            className={`relative p-4 rounded-xl bg-slate-800 border border-slate-700/80 cursor-pointer hover:bg-slate-700/70 transition-all flex flex-col gap-2 ${stylePrioridade}`}
                                            style={{ ...kp.draggableProps.style, ...(kSnap.isDropAnimating && { transitionDuration: '0.001s' }) }}>

                                            <div className="flex justify-between items-start gap-1.5">
                                              <span className={`text-xs uppercase px-2 py-0.5 rounded shrink-0 ${PRIORIDADES_BADGE[card.prioridade || 'Normal']}`}>
                                                {card.prioridade || 'Normal'}
                                              </span>
                                              <div className="flex items-center gap-1.5 shrink-0">
                                                {card.prazo && (
                                                  <span className="flex items-center gap-1 text-xs text-orange-300 bg-orange-500/15 font-bold px-1.5 py-0.5 rounded">
                                                    <Calendar size={12} /> {formatarData(card.prazo)}
                                                  </span>
                                                )}
                                                {/* Âmbar com balão = sugestão esperando decisão. Fica aceso
                                                    pra todos os decisores até alguém aceitar ou recusar —
                                                    diferente do vermelho, que é "você não viu" e some sozinho. */}
                                                {card.sugestoes_pendentes > 0 && (
                                                  <span className="flex items-center gap-0.5 h-[19px] px-1.5 bg-amber-500 rounded-full ring-2 ring-white shadow-md text-white text-[10px] font-black leading-none"
                                                    title={`${card.sugestoes_pendentes} sugest${card.sugestoes_pendentes === 1 ? 'ão aguardando' : 'ões aguardando'} decisão`}>
                                                    <MessageSquare size={9} strokeWidth={3}/>
                                                    {card.sugestoes_pendentes > 9 ? '9+' : card.sugestoes_pendentes}
                                                  </span>
                                                )}
                                                {card.nao_visto && (
                                                  <span className="flex items-center justify-center min-w-[19px] h-[19px] px-1 bg-red-500 rounded-full ring-2 ring-white shadow-md animate-pulse text-white text-[10px] font-black leading-none"
                                                    title={`${card.alteracoes_nao_vistas} alteraç${card.alteracoes_nao_vistas === 1 ? 'ão não vista' : 'ões não vistas'}`}>
                                                    {card.alteracoes_nao_vistas > 9 ? '9+' : card.alteracoes_nao_vistas}
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            <p className="text-base font-bold text-slate-100 leading-tight">{card.titulo}</p>

                                            {totalEtapas > 0 && progresso > 0 && (
                                              <div>
                                                <div className="flex justify-between items-center mb-1">
                                                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Progresso</span>
                                                  <span className="text-xl font-black text-slate-100">{progresso}%</span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                                  <div className={`h-full transition-all duration-300 ${progresso === 100 ? 'bg-emerald-600' : 'bg-teal-500'}`} style={{ width: `${progresso}%` }} />
                                                </div>
                                              </div>
                                            )}

                                            <div className="flex justify-between items-center mt-1 border-t pt-2 border-slate-700">
                                              <div className="flex flex-wrap items-center gap-1">
                                                <span className="text-xs text-slate-400 uppercase font-bold">Resp.:</span>
                                                {(card.responsaveis?.length > 0 ? card.responsaveis : [card.autor]).filter(Boolean).map(nome => (
                                                  <span key={nome} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${userColor(nome)}`}>{nome}</span>
                                                ))}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                {card.github_url && (
                                                  <a href={card.github_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title="Abrir repositório no GitHub" className="text-slate-400 hover:text-white transition-colors">
                                                    <GitHubIcon size={14} />
                                                  </a>
                                                )}
                                                {qtdComentarios > 0 && (
                                                  <div className="flex items-center gap-1 text-xs text-slate-300 font-bold bg-slate-900/60 px-1.5 rounded">
                                                    <MessageSquare size={12} /> {qtdComentarios}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </Draggable>
                                    );
                                  })}
                                {/* Hide placeholder in source column when dragging to another column — column shrinks immediately */}
                                {!(dpSnap.draggingFromThisWith && !dpSnap.isDraggingOver) && dp.placeholder}
                              </div>
                            )}
                          </Droppable>

                          {(canCreateCardAnywhere || col.publica) && (
                            <button onClick={() => setModal({ status: col.id })} className="m-2 mt-auto shrink-0 p-2 text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-slate-200 rounded-xl flex items-center gap-2 transition-colors">
                              <Plus size={16} /> Sugerir demanda
                            </button>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>

            {canManageColumns && (
              <button
                onClick={() => authFetch(`${API}/columns`, {
                  method: 'POST',
                  body: JSON.stringify({ id: `col-${Date.now()}`, titulo: 'Nova Coluna', cor: '#ebecf0', ordem: cols.length, publica: false, auto_andamento: false, auto_concluido: false }),
                }).then(sync)}
                className="hidden md:flex absolute top-0 w-64 h-16 bg-white/10 hover:bg-white/20 border-2 border-white/30 border-dashed rounded-2xl items-center justify-center text-white transition-all cursor-pointer"
                style={{ left: 'calc(100% + 3rem)' }}>
                <Plus size={20} className="mr-2" />
                <span className="font-bold text-sm">Adicionar Coluna</span>
              </button>
            )}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}

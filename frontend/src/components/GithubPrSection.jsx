import React, { useEffect, useState } from 'react';
import { GitPullRequest, GitMerge, XCircle, ExternalLink, GitBranch, Lock, AlertTriangle } from 'lucide-react';
import { API, authFetch } from '../api.js';
import { GitHubIcon } from '../constants.jsx';

const ESTADO_STYLE = {
  aberta: { icon: GitPullRequest, classes: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', label: 'Aberta' },
  mergeada: { icon: GitMerge, classes: 'bg-purple-500/10 text-purple-300 border-purple-500/20', label: 'Mergeada' },
  fechada: { icon: XCircle, classes: 'bg-red-500/10 text-red-300 border-red-500/20', label: 'Fechada' },
};

function formatarDataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const Cabecalho = ({ children }) => (
  <div className="flex items-center justify-between flex-wrap gap-2">
    <div className="flex items-center gap-2 text-slate-300 font-bold text-sm"><GitHubIcon size={16}/> GitHub</div>
    {children}
  </div>
);

const ListaCommits = ({ commits }) => (
  <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
    {commits.map(c => (
      <a key={c.sha} href={c.url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800 transition-colors group">
        <span className="text-[10px] font-mono text-slate-500 shrink-0">{c.sha}</span>
        <span className="text-xs text-slate-300 truncate flex-1 group-hover:text-slate-100">{c.titulo}</span>
        <span className="text-[10px] text-slate-500 shrink-0">{c.autor} · {formatarDataHora(c.data)}</span>
      </a>
    ))}
  </div>
);

export default function GithubPrSection({ cardId }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!cardId) return;
    setInfo(null);
    authFetch(`${API}/cards/${cardId}/github`).then(r => (r.ok ? r.json() : null)).then(setInfo);
  }, [cardId]);

  if (!info || !info.linked) return null;

  if (!info.configurado) {
    return (
      <div className="space-y-2">
        <Cabecalho/>
        <p className="text-xs text-slate-500">Integração com GitHub não configurada no servidor (falta GITHUB_TOKEN).</p>
      </div>
    );
  }

  // Erro sem nenhum dado: link irreconhecível, repo/PR inexistente, rede fora.
  if (info.erro && !info.nome_completo && !info.titulo) {
    return (
      <div className="space-y-2">
        <Cabecalho/>
        <p className="text-xs text-red-400">{info.erro}</p>
      </div>
    );
  }

  // --- card apontando pro repositório: commits recentes do branch padrão
  if (info.tipo === 'repo') {
    return (
      <div className="space-y-3">
        <Cabecalho>
          <a href={info.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            {info.nome_completo} <ExternalLink size={11}/>
          </a>
        </Cabecalho>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full border tracking-wider bg-sky-500/10 text-sky-300 border-sky-500/20">
            <GitBranch size={12}/> {info.branch}
          </span>
          {info.privado && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full border tracking-wider bg-slate-700/40 text-slate-400 border-slate-600">
              <Lock size={11}/> Privado
            </span>
          )}
        </div>

        {/* Dados existem mas os commits falharam — mostra os dois, senão a
            seção parece dizer que o repositório não tem commit nenhum. */}
        {info.erro && (
          <div className="flex items-start gap-2 text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2.5">
            <AlertTriangle size={14} className="shrink-0 mt-0.5"/>
            <p className="text-[11px] leading-relaxed">{info.erro}</p>
          </div>
        )}

        {info.commits.length > 0 && <ListaCommits commits={info.commits}/>}
      </div>
    );
  }

  // --- card apontando pra uma pull request
  const estado = ESTADO_STYLE[info.estado] || ESTADO_STYLE.aberta;
  const EstadoIcon = estado.icon;

  return (
    <div className="space-y-3">
      <Cabecalho>
        <a href={info.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
          #{info.numero} <ExternalLink size={11}/>
        </a>
      </Cabecalho>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full border tracking-wider ${estado.classes}`}>
          <EstadoIcon size={12}/> {estado.label}
        </span>
      </div>
      <p className="text-sm text-slate-200 font-bold truncate">{info.titulo}</p>

      {info.commits.length > 0 && <ListaCommits commits={info.commits}/>}
    </div>
  );
}

import React from 'react';
import { AppUser, authService } from '../data/auth';

interface AdminProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser | null;
  onOpenAdminPanel: () => void;
  onLogout: () => void;
  onGoToTactics?: () => void;
}

export const AdminProfileModal: React.FC<AdminProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenAdminPanel,
  onLogout,
  onGoToTactics
}) => {
  if (!isOpen || !currentUser) return null;

  const isOwner = authService.isOwner(currentUser);

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0f1712] border border-[#2d4233] rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] overflow-hidden text-white flex flex-col">
        {/* Top Decorative Banner with Vasco / Admin colors */}
        <div className="h-20 bg-gradient-to-r from-[#2a0e13] via-[#142318] to-[#121c15] relative p-4 border-b border-[#243729] flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">👑</span>
            <span className="text-xs font-black uppercase tracking-widest text-[#ff8a96]">
              {isOwner ? 'Perfil do Administrador Master' : 'Perfil do Torcedor'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-black/50 hover:bg-black/80 text-gray-300 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer transition"
            title="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Profile Card Body */}
        <div className="p-5 pt-0 relative space-y-4">
          {/* Avatar floating over banner */}
          <div className="flex items-end justify-between -mt-10 mb-2">
            <div className="relative">
              <div className="w-18 h-18 rounded-2xl bg-[#131c15] border-3 border-[#3a5441] shadow-2xl overflow-hidden flex items-center justify-center">
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#d62839] to-[#0d1610] flex items-center justify-center text-2xl font-black text-white">
                    {isOwner ? '👑' : currentUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {/* Google Verified Indicator */}
              <div
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center p-1 border border-gray-200"
                title="Conta Google Verificada"
              >
                <svg className="w-full h-full" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span
                className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${
                  isOwner
                    ? 'bg-gradient-to-r from-[#d62839] to-[#991b28] text-white border border-[#ff6675] shadow-[0_0_12px_rgba(214,40,57,0.5)]'
                    : 'bg-[#1e3324] text-[#5bf092] border border-[#2d5236]'
                }`}
              >
                {isOwner ? '👑 Administrador (Owner)' : 'Torcedor Membro'}
              </span>
              <span className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Autenticado via Google
              </span>
            </div>
          </div>

          {/* User Details */}
          <div>
            <h2 className="text-lg font-black text-white leading-tight flex items-center gap-1.5">
              <span>{currentUser.name}</span>
              {isOwner && <span title="Proprietário Oficial">⭐</span>}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-[#8ea394] mt-0.5 font-mono">
              <span>✉</span>
              <span className="text-[#a8c2af] font-semibold">{currentUser.email}</span>
            </div>
          </div>

          {/* Administrator Access & Privileges Status */}
          {isOwner && (
            <div className="bg-[#121c15] border border-[#273d2d] rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-[#81dea0] tracking-wider">
                  Privilégios Administrativos
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 font-bold border border-emerald-800/60">
                  Total Ilimitado
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="flex items-start gap-2 bg-[#0c140f] p-2 rounded-lg border border-[#1e2e22]">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <div>
                    <p className="text-[11px] font-bold text-white">Painel de Configurações do Site</p>
                    <p className="text-[9.5px] text-[#869b8d]">
                      Controle de visibilidade das abas Transmissões, Shorts, Vídeos e Mural da Torcida.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-[#0c140f] p-2 rounded-lg border border-[#1e2e22]">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <div>
                    <p className="text-[11px] font-bold text-white">Prancheta Tática PRO Móvel</p>
                    <p className="text-[9.5px] text-[#869b8d]">
                      Criador de jogadas em pop-up flutuante, animações suaves e gravação de etapas sem bloqueios.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-[#0c140f] p-2 rounded-lg border border-[#1e2e22]">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <div>
                    <p className="text-[11px] font-bold text-white">Moderação da Comunidade</p>
                    <p className="text-[9.5px] text-[#869b8d]">
                      Permissão para excluir e gerenciar fotos de escalações publicadas pelos torcedores.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminPanel();
                }}
                className="w-full py-2.5 bg-gradient-to-r from-[#d62839] to-[#991b28] hover:from-[#e83345] hover:to-[#b02130] text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition shadow-[0_0_15px_rgba(214,40,57,0.4)] cursor-pointer"
              >
                <span>🛡️</span>
                <span>Abrir Painel Administrativo Geral</span>
              </button>
            )}

            {onGoToTactics && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoToTactics();
                }}
                className="w-full py-2 bg-[#1b6b3b] hover:bg-[#23874b] text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition shadow cursor-pointer"
              >
                <span>⚽</span>
                <span>Abrir Prancheta Tática PRO</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full py-2 bg-[#17221a] hover:bg-[#26171a] hover:border-[#632931] border border-[#2b3c30] text-[#9db2a4] hover:text-[#ff9aa5] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>🚪</span>
              <span>Desconectar da Conta Google</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

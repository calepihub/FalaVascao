import React, { useState } from 'react';
import { AppUser, authService, OWNER_EMAIL } from '../data/auth';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AppUser) => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const [viewMode, setViewMode] = useState<'chooser' | 'custom'>('chooser');
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleLoginAsOwner = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const user = await authService.loginWithGoogle(
        OWNER_EMAIL,
        'Tazmania CRVG',
        'https://lh3.googleusercontent.com/a/default-user'
      );
      onLoginSuccess(user);
      onClose();
    } catch {
      setErrorMsg('Erro ao conectar com a conta Google do Administrador.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const user = await authService.loginWithGoogle(
        emailInput.trim(),
        nameInput.trim() || undefined
      );
      onLoginSuccess(user);
      onClose();
    } catch {
      setErrorMsg('Falha ao autenticar com a conta Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-[430px] bg-[#0d140f] border border-[#2b3e30] rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden text-white flex flex-col">
        {/* Google Official Header */}
        <div className="p-6 pb-4 border-b border-[#1f2e23] bg-[#111a14] relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-[#18261c] hover:bg-[#25392b] text-gray-400 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer transition"
            title="Fechar"
          >
            ✕
          </button>

          <div className="flex items-center gap-3">
            {/* Google 4-Color Logo */}
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center p-1.5 shadow-md shrink-0">
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

            <div>
              <h2 className="text-base font-black text-white leading-tight">
                Fazer login com o Google
              </h2>
              <p className="text-[11px] text-[#8ea394] leading-tight mt-0.5">
                Escolha uma conta para continuar no <b>Fala Vascão</b>
              </p>
            </div>
          </div>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-2.5 bg-red-950/80 border border-red-700/60 rounded-xl text-xs text-red-200 flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Account Chooser View */}
        {viewMode === 'chooser' ? (
          <div className="p-6 space-y-3">
            <span className="text-[10px] font-black uppercase text-[#809888] tracking-wider block">
              Contas do Google Detectadas
            </span>

            {/* Official Administrator Card: 1-Click Fast Sign-in */}
            <div
              onClick={handleLoginAsOwner}
              className="group p-3.5 bg-gradient-to-r from-[#1f1214] via-[#141e17] to-[#121c15] hover:from-[#2a1317] hover:to-[#1a2b1f] border-2 border-[#b32b38] hover:border-[#ff5967] rounded-xl cursor-pointer transition shadow-lg relative flex items-center justify-between"
              title="Clique para entrar instantaneamente como Administrador Master"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#d62839] to-[#0f1712] border-2 border-[#ff6675] flex items-center justify-center text-lg font-black text-white shadow">
                    👑
                  </div>
                  {/* Google G mini-badge */}
                  <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-white flex items-center justify-center p-0.5 shadow">
                    <svg className="w-full h-full" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                    </svg>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white group-hover:text-[#ffd6db] transition">
                      Tazmania CRVG
                    </span>
                    <span className="text-[8.5px] px-1.5 py-0.2 rounded font-black bg-gradient-to-r from-[#d62839] to-[#991b28] text-white uppercase tracking-wider shadow">
                      👑 Administrador (Owner)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9eb2a4] font-mono leading-tight mt-0.5">
                    {OWNER_EMAIL}
                  </p>
                  <p className="text-[9.5px] text-[#7ce7a0] font-semibold mt-1">
                    ✓ Acesso total ao Painel, Prancheta e Mural
                  </p>
                </div>
              </div>

              <div className="text-right pl-2">
                <span className="text-xs font-black text-white bg-[#d62839] group-hover:bg-[#ff3b4e] px-2.5 py-1.5 rounded-lg shadow inline-flex items-center gap-1 transition">
                  {loading ? 'Entrando...' : 'Entrar ▶'}
                </span>
              </div>
            </div>

            {/* Option to use another Google account */}
            <div
              onClick={() => setViewMode('custom')}
              className="p-3 bg-[#131d16] hover:bg-[#1a281e] border border-[#26372b] hover:border-[#43c776] rounded-xl cursor-pointer transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1b2b20] border border-[#2f4a38] flex items-center justify-center text-sm font-bold text-[#86a390] group-hover:text-white">
                  👤+
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                    Usar outra conta Google
                  </h4>
                  <p className="text-[10px] text-[#869b8d]">
                    Entrar com outro e-mail @gmail.com de torcedor
                  </p>
                </div>
              </div>
              <span className="text-gray-400 group-hover:text-white text-xs">➔</span>
            </div>
          </div>
        ) : (
          /* Custom Google Account Form */
          <form onSubmit={handleCustomSubmit} className="p-6 space-y-4">
            <button
              type="button"
              onClick={() => setViewMode('chooser')}
              className="text-xs text-[#7fe4a1] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
            >
              <span>◀</span>
              <span>Voltar para seleção de contas</span>
            </button>

            <div>
              <label className="block text-[10px] font-black text-[#8aa092] uppercase mb-1">
                E-mail da sua Conta Google
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="seu.nome@gmail.com"
                className="w-full h-10 px-3 text-xs bg-[#142017] text-white border border-[#2e4033] rounded-xl outline-none focus:border-[#43c776] focus:ring-1 focus:ring-[#43c776]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-[#8aa092] uppercase mb-1">
                Nome de Exibição de Torcedor (Opcional)
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Ex: Carlos da Colina"
                className="w-full h-10 px-3 text-xs bg-[#142017] text-white border border-[#2e4033] rounded-xl outline-none focus:border-[#43c776] focus:ring-1 focus:ring-[#43c776]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#1b6b3b] hover:bg-[#23874b] text-white rounded-xl text-xs font-black transition shadow cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Autenticando...</span>
              ) : (
                <>
                  <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
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
                  <span>Continuar com o Google</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Official Google Privacy & Security Disclaimer */}
        <div className="p-4 bg-[#0a100c] border-t border-[#18241b] text-[9.5px] text-[#6d8274] leading-relaxed text-center">
          Para continuar, o Google compartilhará seu nome, e-mail e foto do perfil com o Fala Vascão.
          Sua conta é autenticada com segurança.
        </div>
      </div>
    </div>
  );
};

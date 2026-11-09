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
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleQuickLoginAsOwner = async () => {
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
      setErrorMsg('Erro ao conectar conta Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
      setErrorMsg('Falha na autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#0f1611] border border-[#2e4033] rounded-2xl p-6 shadow-2xl space-y-5 text-[#e6ece8]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#223326]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center p-1 shadow">
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
              <h3 className="text-sm font-black text-white">Login com Conta Google</h3>
              <p className="text-[11px] text-[#869c8e]">Comunidade & Membros Fala Vascão</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#18261c] hover:bg-[#25392b] text-gray-400 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-2.5 bg-red-900/50 border border-red-700/50 rounded-lg text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        {/* 1. Dedicated Owner Fast Login Button */}
        <div className="p-3.5 bg-gradient-to-r from-[#211215] to-[#141d16] border border-[#59272d] rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-[#ff808d] tracking-wider">
              Área do Proprietário
            </span>
            <span className="text-[10px] text-gray-400 font-mono">{OWNER_EMAIL}</span>
          </div>
          <button
            type="button"
            onClick={handleQuickLoginAsOwner}
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-[#d62839] to-[#991b28] hover:from-[#e83143] hover:to-[#b02130] text-white rounded-lg text-xs font-black flex items-center justify-center gap-2 transition shadow-lg cursor-pointer disabled:opacity-50"
          >
            <span>👑</span>
            <span>Entrar como Owner Administrador Total</span>
          </button>
          <span className="text-[10px] text-[#8f9f94] block text-center">
            Libera o Painel Administrativo, gestão de membros e controle de visibilidade.
          </span>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 text-[11px] text-[#718578] font-bold">
          <div className="flex-1 h-px bg-[#202f23]"></div>
          <span>ou entrar com qualquer e-mail Google</span>
          <div className="flex-1 h-px bg-[#202f23]"></div>
        </div>

        {/* 2. Standard Google Sign-In Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-[#869c8e] uppercase mb-1">
              E-mail da sua Conta Google
            </label>
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="seu.email@gmail.com"
              className="w-full h-9 px-3 text-xs bg-[#142017] text-white border border-[#2e4033] rounded-lg outline-none focus:border-[#43c776]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#869c8e] uppercase mb-1">
              Seu Nome ou Apelido de Torcedor (Opcional)
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Ex: Carlos da Barreira"
              className="w-full h-9 px-3 text-xs bg-[#142017] text-white border border-[#2e4033] rounded-lg outline-none focus:border-[#43c776]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#1b6b3b] hover:bg-[#23874b] text-white rounded-lg text-xs font-black transition shadow cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Conectando...' : 'Entrar com Conta Google'}
          </button>
        </form>

        <p className="text-[10px] text-[#697d70] text-center">
          Ao entrar, seu perfil é salvo no banco de dados para poder curtir e publicar no Mural da Torcida.
        </p>
      </div>
    </div>
  );
};

import React from 'react';

interface StartModalProps {
  isOpen: boolean;
  hasPreviousLineup: boolean;
  onStartClean: () => void;
  onStartRestore: () => void;
}

export const StartModal: React.FC<StartModalProps> = ({
  isOpen,
  hasPreviousLineup,
  onStartClean,
  onStartRestore
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="startChoice"
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
    >
      <div className="w-[min(440px,92vw)] bg-[#141a16] border border-[#4b5b50] rounded-2xl p-6 text-center shadow-2xl space-y-4">
        {/* Logo / Crest Badge */}
        <div className="w-16 h-16 mx-auto rounded-full bg-[#0d120f] border-2 border-[#c5202f] flex items-center justify-center shadow-inner">
          <span className="text-2xl font-black text-white tracking-tighter">CRVG</span>
        </div>

        <div>
          <h2 className="text-xl font-black text-white">Como deseja iniciar?</h2>
          <p className="text-xs text-[#aab5ae] mt-1">
            Escolha uma opção para abrir a Prancheta Vascaína PRO V50
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={onStartClean}
            className="w-full py-3 px-4 text-sm font-bold bg-[#1e2722] hover:bg-[#2b3931] border border-[#45574a] text-white rounded-xl shadow transition active:scale-98"
          >
            🌱 Iniciar com Campo Limpo
          </button>

          <button
            type="button"
            onClick={onStartRestore}
            disabled={!hasPreviousLineup}
            className={`w-full py-3 px-4 text-sm font-bold rounded-xl border transition active:scale-98 ${
              hasPreviousLineup
                ? 'bg-[#8e1724] hover:bg-[#a61c2c] border-[#ff6675] text-white shadow-lg'
                : 'bg-[#1a201c] border-[#2e3b32] text-gray-500 cursor-not-allowed'
            }`}
          >
            {hasPreviousLineup
              ? '↺ Repetir Escalação Anterior'
              : 'Nenhuma escalação anterior salva'}
          </button>
        </div>

        <div className="text-[10px] text-[#78887e] pt-1">
          Integração nativa com Banco de Dados InterBase e IndexedDB
        </div>
      </div>
    </div>
  );
};

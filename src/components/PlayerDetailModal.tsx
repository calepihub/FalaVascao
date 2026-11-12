import React, { useState } from 'react';
import { FieldTokenData } from '../data/storage';
import { getClubColors } from '../data/databaseService';
import { getInitials } from '../tactics/tacticsLogic';

interface PlayerDetailModalProps {
  player: FieldTokenData | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleLock?: (tokenId: string) => void;
  onRemoveToken?: (tokenId: string) => void;
  onUpdateComment?: (tokenId: string, newComment: string) => void;
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  player,
  isOpen,
  onClose,
  onToggleLock,
  onRemoveToken,
  onUpdateComment
}) => {
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [editedComment, setEditedComment] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  // Sync edited comment when player changes
  React.useEffect(() => {
    if (player) {
      setEditedComment(player.comment || '');
      setIsEditingComment(false);
      setImageFailed(false);
    }
  }, [player]);

  if (!isOpen || !player || player.kind === 'ball') return null;

  const clubName = player.club || (player.kind === 'vasco' ? 'CR Vasco da Gama' : 'Clube Adversário');
  const clubColors = getClubColors(clubName);
  const primaryColor = clubColors[0] || '#e32636';
  const secondaryColor = clubColors[1] || '#ffffff';

  const handleSaveComment = () => {
    if (onUpdateComment && player) {
      onUpdateComment(player.id, editedComment);
    }
    setIsEditingComment(false);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#0c120e] border border-[#2b3a30] rounded-xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: `0 20px 45px -10px ${primaryColor}40, 0 0 0 1px #2b3a30`
        }}
      >
        {/* Top Header Bar: Clean, well-spaced, NO overlapping with avatar */}
        <div
          className="h-9 w-full px-3.5 flex items-center justify-between shrink-0 border-b border-white/10"
          style={{
            background: `linear-gradient(90deg, ${primaryColor} 0%, #111a14 70%)`
          }}
        >
          {/* Club badge and name */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-3 h-3 rounded-full border border-white/40 shadow-sm shrink-0"
              style={{ backgroundColor: secondaryColor }}
            />
            <span className="text-[11px] font-black tracking-wide text-white drop-shadow truncate">
              {clubName}
            </span>
          </div>

          {/* Right badges & close */}
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <span className="text-[8.5px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-black/60 text-[#c2d4c7] border border-white/10 uppercase font-bold">
              {player.kind === 'vasco' ? 'Vasco da Gama' : 'Adversário'}
            </span>
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white flex items-center justify-center text-xs font-bold transition cursor-pointer border border-white/10"
              title="Fechar (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-3.5 space-y-2.5 overflow-y-auto scrollbar-thin">
          {/* Player Identity Row: Photo on Left, Name & Position on Right (Clean & Separated) */}
          <div className="flex items-center gap-3 bg-[#111813] border border-[#222e25] rounded-lg p-2.5">
            {/* Player Photo Avatar */}
            <div className="relative shrink-0">
              <div
                className="w-16 h-16 rounded-xl overflow-hidden border-2 shadow-md bg-[#162119] flex items-center justify-center"
                style={{ borderColor: primaryColor }}
              >
                {player.photo && !imageFailed ? (
                  <img
                    src={player.photo}
                    alt={player.name || 'Jogador'}
                    onError={() => setImageFailed(true)}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center font-black text-lg text-white"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
                    }}
                  >
                    {player.name ? getInitials(player.name) : `#${player.num || '?'}`}
                  </div>
                )}
              </div>

              {player.num && (
                <div
                  className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded text-[9px] font-black border border-white/20 text-white shadow-md"
                  style={{ backgroundColor: primaryColor }}
                >
                  #{player.num}
                </div>
              )}
            </div>

            {/* Name, Role & Detailed Position */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black text-white truncate">
                  {player.name || `Jogador #${player.num || ''}`}
                </h3>
                <span
                  className="text-[9px] font-black px-1.5 py-0.5 rounded text-white shrink-0 shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  {player.role || 'JOG'}
                </span>
              </div>
              <p className="text-[11px] text-[#8aa091] font-semibold mt-0.5 truncate">
                {player.rawPosition || player.role || 'Posição em campo'}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[9.5px] text-[#6d8274]">
                <span>{clubName}</span>
                <span>•</span>
                <span>Temporada 2026</span>
              </div>
            </div>
          </div>

          {/* Key Attributes Grid (Data from bd.xlsx) */}
          <div className="grid grid-cols-4 gap-1.5">
            <div className="bg-[#121a14] border border-[#233127] rounded-lg p-2 text-center">
              <span className="block text-[8px] font-bold text-[#728578] uppercase tracking-wider">
                Idade / Nasc.
              </span>
              <span className="text-[11px] font-bold text-white mt-0.5 block truncate">
                {player.age ? `${player.age} anos` : '—'}
              </span>
              {player.birthDate && (
                <span className="text-[8.5px] text-[#869b8d] block font-mono truncate">
                  {player.birthDate}
                </span>
              )}
            </div>

            <div className="bg-[#121a14] border border-[#233127] rounded-lg p-2 text-center">
              <span className="block text-[8px] font-bold text-[#728578] uppercase tracking-wider">
                Nacionalidade
              </span>
              <span className="text-[11px] font-bold text-white mt-0.5 block truncate">
                {player.nationality || 'Brasil'}
              </span>
            </div>

            <div className="bg-[#121a14] border border-[#233127] rounded-lg p-2 text-center">
              <span className="block text-[8px] font-bold text-[#728578] uppercase tracking-wider">
                Valor Mercado
              </span>
              <span className="text-[11px] font-black text-[#5ce18a] mt-0.5 block truncate">
                {player.marketValue && player.marketValue !== '-' ? player.marketValue : 'Não inf.'}
              </span>
            </div>

            <div className="bg-[#121a14] border border-[#233127] rounded-lg p-2 text-center">
              <span className="block text-[8px] font-bold text-[#728578] uppercase tracking-wider">
                Contrato até
              </span>
              <span className="text-[11px] font-bold text-white mt-0.5 block truncate">
                {player.contract && player.contract !== '-' ? player.contract : 'Não inf.'}
              </span>
            </div>
          </div>

          {/* Tactical / Scouting Comment Card */}
          <div className="bg-[#111813] border border-[#233127] rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🧠</span>
                <span className="text-[9px] font-black uppercase tracking-wider text-[#a4baa9]">
                  Comentário Tático & Relatório Atualizado
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingComment(!isEditingComment)}
                className="text-[8.5px] text-[#52be74] hover:text-[#78dc97] font-bold cursor-pointer"
              >
                {isEditingComment ? 'Cancelar' : '✏️ Editar'}
              </button>
            </div>

            {isEditingComment ? (
              <div className="space-y-1.5 mt-1">
                <textarea
                  value={editedComment}
                  onChange={(e) => setEditedComment(e.target.value)}
                  rows={3}
                  className="w-full text-xs bg-[#19241c] text-white p-2 rounded border border-[#374c3d] focus:border-[#52be74] outline-none"
                  placeholder="Escreva anotações táticas sobre este jogador..."
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={handleSaveComment}
                    className="px-2.5 py-0.5 bg-[#206336] hover:bg-[#277942] text-white text-[9.5px] font-bold rounded cursor-pointer"
                  >
                    Salvar Nota
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-[#c6d7cc] leading-relaxed">
                {player.comment || 'Nenhum comentário cadastrado para este atleta.'}
              </p>
            )}
          </div>

          {/* Transfermarkt Profile Link (Coluna O da planilha bd.xlsx) */}
          {player.profileUrl && (
            <div className="flex items-center justify-between p-2 bg-[#131d16] border border-[#233127] rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm">🌐</span>
                <div className="text-[9.5px]">
                  <span className="font-bold text-white block">Perfil do Atleta</span>
                  <span className="text-[#728578]">Transfermarkt oficial</span>
                </div>
              </div>
              <a
                href={player.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-[#1a281f] hover:bg-[#25392b] border border-[#3b4f40] hover:border-[#52be74] text-white text-[9px] font-bold rounded transition flex items-center gap-1 cursor-pointer"
              >
                <span>Transfermarkt</span>
                <span>↗</span>
              </a>
            </div>
          )}

          {/* Action Footer for Tactical Board */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1e2a21]">
            <div className="flex items-center gap-1.5">
              {onToggleLock && (
                <button
                  type="button"
                  onClick={() => onToggleLock(player.id)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                    player.locked
                      ? 'bg-[#e32636]/20 border-[#e32636] text-[#ff808d]'
                      : 'bg-[#18231b] border-[#304034] text-[#a0b5a6] hover:text-white'
                  }`}
                >
                  <span>{player.locked ? '🔒 Bloqueado' : '🔓 Livre'}</span>
                </button>
              )}

              {onRemoveToken && (
                <button
                  type="button"
                  onClick={() => {
                    onRemoveToken(player.id);
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#261517] border border-[#522227] text-[#ff7583] hover:bg-[#3d1a1e] transition flex items-center gap-1 cursor-pointer"
                >
                  <span>🗑️ Remover do Campo</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1 rounded text-[10px] font-black bg-[#1b2820] hover:bg-[#283c2f] border border-[#384c3d] text-white transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { BoardMeta } from '../tactics/tacticsLogic';
import { SavedBoard, FieldTokenData } from '../data/storage';

interface ExtrasPanelProps {
  isOpen: boolean;
  onClose: () => void;
  meta: BoardMeta;
  onMetaChange: (meta: BoardMeta) => void;
  onSaveBoard: () => void;
  savedBoards: SavedBoard[];
  onLoadBoard: (board: SavedBoard) => void;
  onDeleteBoard: (id: number | string) => void;
  onUndoAction: () => void;
  onRedoAction: () => void;
  onToggleLockSelected: () => void;
  onAlignSelected: (type: 'h' | 'v') => void;
  onDistributeSelected: () => void;
  isLoopActive: boolean;
  onToggleLoop: () => void;
  showTrails: boolean;
  onToggleTrails: () => void;
  onDuplicateFrame: () => void;
  onPresentationMode: () => void;
  onExportPNG: () => void;
  tokens: FieldTokenData[];
  selectedClub: string;
  frameCount: number;
}

export const ExtrasPanel: React.FC<ExtrasPanelProps> = ({
  isOpen,
  meta,
  onMetaChange,
  onSaveBoard,
  savedBoards,
  onLoadBoard,
  onDeleteBoard,
  onUndoAction,
  onRedoAction,
  onToggleLockSelected,
  onAlignSelected,
  onDistributeSelected,
  isLoopActive,
  onToggleLoop,
  showTrails,
  onToggleTrails,
  onDuplicateFrame,
  onPresentationMode,
  onExportPNG,
  tokens,
  selectedClub,
  frameCount
}) => {
  const [showLibrary, setShowLibrary] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="bg-[#0f1511] border border-[#334139] rounded-lg p-2.5 mt-2 space-y-2 select-none text-[#d4ddd7]">
      {/* Title */}
      <div className="text-[9px] font-black tracking-wider text-[#a7b7ac] uppercase border-b border-[#253229] pb-1">
        Prancheta Tática & Arquivo
      </div>

      {/* Metadata Inputs */}
      <div className="space-y-1.5">
        <input
          type="text"
          value={meta.title}
          onChange={(e) => onMetaChange({ ...meta, title: e.target.value })}
          placeholder="Nome da prancheta / Jogo"
          className="w-full h-7 px-2 text-[10px] font-bold bg-[#18201a] text-white border border-[#425047] rounded outline-none focus:border-[#d62839]"
        />

        <div className="grid grid-cols-2 gap-1.5">
          <input
            type="text"
            value={meta.competition}
            onChange={(e) => onMetaChange({ ...meta, competition: e.target.value })}
            placeholder="Competição (ex: Brasileirão)"
            className="w-full h-7 px-2 text-[9px] font-bold bg-[#18201a] text-white border border-[#425047] rounded outline-none"
          />
          <input
            type="date"
            value={meta.date}
            onChange={(e) => onMetaChange({ ...meta, date: e.target.value })}
            className="w-full h-7 px-1.5 text-[9px] font-bold bg-[#18201a] text-white border border-[#425047] rounded outline-none"
          />
        </div>

        <textarea
          value={meta.notes}
          onChange={(e) => onMetaChange({ ...meta, notes: e.target.value })}
          placeholder="Observações táticas, bolas paradas, saídas de bola..."
          rows={2}
          className="w-full p-1.5 text-[9px] bg-[#18201a] text-white border border-[#425047] rounded outline-none resize-none"
        />

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onSaveBoard}
            className="h-7 text-[9px] font-black bg-[#1b6b3b] hover:bg-[#23874b] border border-[#43c776] text-white rounded transition shadow-sm"
          >
            💾 Salvar Prancheta
          </button>
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className="h-7 text-[9px] font-bold bg-[#1c2720] hover:bg-[#28372d] border border-[#435749] text-[#c0d4c6] rounded transition"
          >
            📚 Biblioteca ({savedBoards.length})
          </button>
        </div>
      </div>

      {/* Saved Boards Library Drawer */}
      {showLibrary && (
        <div className="bg-[#0b100d] border border-[#26352a] rounded p-2 max-h-36 overflow-y-auto space-y-1">
          <div className="text-[8px] font-bold text-[#86988d]">PRANCHETAS SALVAS</div>
          {savedBoards.length === 0 ? (
            <span className="text-[8px] text-[#6b7b72]">Nenhuma prancheta salva ainda.</span>
          ) : (
            savedBoards.map((b) => (
              <div
                key={b.id || b.meta.title}
                className="flex items-center justify-between bg-[#151c17] p-1.5 rounded border border-[#28362c] text-[9px]"
              >
                <div className="truncate pr-2">
                  <div className="font-bold text-white truncate">{b.meta.title || 'Sem título'}</div>
                  <div className="text-[7px] text-[#86958d]">
                    {b.meta.competition || 'Geral'} • {b.savedAt.slice(0, 10)}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => onLoadBoard(b)}
                    className="px-2 py-0.5 text-[8px] font-bold bg-[#1c2e22] text-[#71e39a] border border-[#3b7851] rounded"
                  >
                    Abrir
                  </button>
                  {b.id && (
                    <button
                      onClick={() => onDeleteBoard(b.id!)}
                      className="px-1 text-[8px] text-[#ff7886] hover:bg-[#3f191f] rounded"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Editing & Alignment Section */}
      <div className="text-[9px] font-black tracking-wider text-[#a7b7ac] uppercase border-b border-[#253229] pb-1 pt-1">
        Edição & Alinhamento
      </div>
      <div className="grid grid-cols-3 gap-1">
        <button
          onClick={onUndoAction}
          className="h-6 text-[8px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#3b4b3f] text-[#c5d2c9] rounded"
        >
          ↶ Desfazer
        </button>
        <button
          onClick={onRedoAction}
          className="h-6 text-[8px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#3b4b3f] text-[#c5d2c9] rounded"
        >
          ↷ Refazer
        </button>
        <button
          onClick={onToggleLockSelected}
          className="h-6 text-[8px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#3b4b3f] text-[#ffcf5c] rounded"
        >
          🔒 Bloquear
        </button>
        <button
          onClick={() => onAlignSelected('h')}
          className="h-6 text-[8px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#3b4b3f] text-[#c5d2c9] rounded"
          title="Alinhar jogadores na mesma linha horizontal"
        >
          ↔ Horizontal
        </button>
        <button
          onClick={() => onAlignSelected('v')}
          className="h-6 text-[8px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#3b4b3f] text-[#c5d2c9] rounded"
          title="Alinhar jogadores na mesma linha vertical"
        >
          ↕ Vertical
        </button>
        <button
          onClick={onDistributeSelected}
          className="h-6 text-[8px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#3b4b3f] text-[#c5d2c9] rounded"
          title="Distribuir jogadores espaçados uniformemente"
        >
          ⇆ Distribuir
        </button>
      </div>

      {/* Animation & Display Section */}
      <div className="text-[9px] font-black tracking-wider text-[#a7b7ac] uppercase border-b border-[#253229] pb-1 pt-1">
        Animação & Exibição
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={onToggleLoop}
          className={`h-7 text-[8px] font-black rounded border transition flex items-center justify-center gap-1 ${
            isLoopActive
              ? 'bg-[#1b6b3b] border-[#43c776] text-white shadow'
              : 'bg-[#19211c] border-[#38483d] text-[#b3c2b8]'
          }`}
        >
          <span>🔁</span>
          <span>Loop: {isLoopActive ? 'LIGADO' : 'DESL.'}</span>
        </button>

        <button
          onClick={onToggleTrails}
          className={`h-7 text-[8px] font-black rounded border transition flex items-center justify-center gap-1 ${
            showTrails
              ? 'bg-[#1b4b6b] border-[#4395c7] text-white shadow'
              : 'bg-[#19211c] border-[#38483d] text-[#b3c2b8]'
          }`}
        >
          <span>⋯</span>
          <span>Rastros: {showTrails ? 'LIGADO' : 'DESL.'}</span>
        </button>

        <button
          onClick={onDuplicateFrame}
          className="h-7 text-[8px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#38483d] text-[#c2d0c6] rounded"
        >
          ⧉ Duplicar Etapa
        </button>

        <button
          onClick={onPresentationMode}
          className="h-7 text-[8px] font-black bg-[#681922] hover:bg-[#85212c] border border-[#e33749] text-white rounded shadow-sm"
        >
          ▶ Apresentação Tática
        </button>
      </div>

      {/* Export */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onExportPNG}
          className="w-full h-8 text-[9px] font-black bg-[#234530] hover:bg-[#2c573d] border border-[#4bb070] text-white rounded flex items-center justify-center gap-1.5 shadow-sm transition"
        >
          <span>🖼</span>
          <span>Baixar Imagem da Prancheta (PNG)</span>
        </button>
      </div>
    </div>
  );
};

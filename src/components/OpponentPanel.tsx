import React from 'react';
import { OPPONENT_CLUBS, TACTICAL_FORMATIONS } from '../data/squad';
import { DrawingTool } from './DrawingCanvas';

interface OpponentPanelProps {
  selectedClub: string;
  onSelectClub: (club: string) => void;
  clubGradientStyle: string;
  usedOpponentNumbers: Set<number>;
  onAddOpponent: (num: number) => void;
  currentTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  currentColor: string;
  onSelectColor: (color: string) => void;
  lineWidth: number;
  onLineWidthChange: (width: number) => void;
  onClearPlayers: () => void;
  onToggleFullscreen: () => void;
  onUndoDraw: () => void;
  onClearDraw: () => void;
  onAddBall: () => void;
  isPolygonActive: boolean;
  polygonPointsCount: number;
  onClosePolygon: () => void;
  onApplyFormation: (formationKey: string) => void;
  onToggleCollapse?: () => void;
}

const COLOR_PALETTE = [
  { name: 'Vermelho', hex: '#e32636' },
  { name: 'Amarelo', hex: '#ffd633' },
  { name: 'Azul', hex: '#32a8ff' },
  { name: 'Verde', hex: '#35d06f' },
  { name: 'Branco', hex: '#ffffff' }
];

export const OpponentPanel: React.FC<OpponentPanelProps> = ({
  selectedClub,
  onSelectClub,
  clubGradientStyle,
  usedOpponentNumbers,
  onAddOpponent,
  currentTool,
  onSelectTool,
  currentColor,
  onSelectColor,
  lineWidth,
  onLineWidthChange,
  onClearPlayers,
  onToggleFullscreen,
  onUndoDraw,
  onClearDraw,
  onAddBall,
  isPolygonActive,
  polygonPointsCount,
  onClosePolygon,
  onApplyFormation,
  onToggleCollapse
}) => {
  return (
    <aside className="w-[230px] min-w-[215px] max-w-[245px] flex flex-col h-full bg-[#0d130f] border border-[#29362d] rounded-lg p-2 overflow-y-auto space-y-2 select-none scrollbar-thin">
      {/* Opponent Selection Section */}
      <section className="bg-[#101712] border border-[#29362d] rounded-lg p-2">
        <div className="flex items-center justify-between text-[9px] font-black tracking-wider text-[#a0aea5] mb-1">
          <span>ADVERSÁRIO</span>
          <div className="flex items-center gap-1.5">
            {selectedClub && (
              <span className="text-[8px] text-[#ff7581] font-bold truncate max-w-[80px]">
                {selectedClub}
              </span>
            )}
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Ocultar painel para aumentar o campo"
                className="text-[8px] px-2 py-0.5 bg-[#1b2820] hover:bg-[#283c2f] border border-[#3c5443] hover:border-[#52be74] text-[#a9c2b2] hover:text-white rounded font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <span>Ocultar</span>
                <span>▶</span>
              </button>
            )}
          </div>
        </div>

        <label className="block text-[8px] font-bold text-[#83948a] mb-1">CLUBE</label>
        <select
          value={selectedClub}
          onChange={(e) => onSelectClub(e.target.value)}
          className="w-full h-7 px-1.5 text-[10px] font-bold bg-[#172019] text-white border border-[#405047] rounded outline-none focus:border-[#c91f32] mb-2"
        >
          <option value="">Selecione o clube adversário</option>
          {Object.keys(OPPONENT_CLUBS).map((club) => (
            <option key={club} value={club}>
              {club}
            </option>
          ))}
        </select>

        {/* 20 Numbered Opponent Tokens */}
        <div className="grid grid-cols-5 gap-1.5 pt-0.5">
          {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => {
            const isUsed = usedOpponentNumbers.has(num);

            return (
              <button
                key={num}
                onClick={() => onAddOpponent(num)}
                title={`Adicionar adversário #${num} ao campo`}
                style={{ background: clubGradientStyle }}
                className={`w-[36px] h-[36px] rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow transition transform active:scale-90 ${
                  isUsed ? 'opacity-40 hover:opacity-80' : 'hover:scale-105'
                }`}
              >
                <span style={{ textShadow: '0 1px 2px #000' }}>{num}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Field Controls */}
      <section className="bg-[#101712] border border-[#29362d] rounded-lg p-2">
        <div className="text-[8px] font-black tracking-wider text-[#8b9c91] mb-1.5">
          CONTROLES DO CAMPO
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onClearPlayers}
            className="h-7 text-[8px] font-bold bg-[#19211c] hover:bg-[#2c1d20] hover:text-[#ff929d] border border-[#3d4b41] hover:border-[#8e2430] text-[#c9d4cd] rounded transition"
          >
            Limpar peças
          </button>
          <button
            onClick={onToggleFullscreen}
            className="h-7 text-[8px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#3d4b41] text-[#c9d4cd] rounded transition"
          >
            ⛶ Campo máximo
          </button>
          <button
            onClick={onUndoDraw}
            className="h-7 text-[8px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#3d4b41] text-[#c9d4cd] rounded transition"
          >
            ↶ Desfazer risco
          </button>
          <button
            onClick={onClearDraw}
            className="h-7 text-[8px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#3d4b41] text-[#c9d4cd] rounded transition"
          >
            ⌫ Limpar riscos
          </button>
        </div>

        {/* Quick Formations */}
        <div className="mt-2 pt-1.5 border-t border-[#232d26]">
          <div className="text-[8px] font-bold text-[#86958c] mb-1">FORMAÇÃO TÁTICA RÁPIDA</div>
          <div className="grid grid-cols-3 gap-1">
            {Object.keys(TACTICAL_FORMATIONS).map((fKey) => (
              <button
                key={fKey}
                onClick={() => onApplyFormation(fKey)}
                title={`Posicionar 11 jogadores do Vasco no ${fKey}`}
                className="h-6 text-[8px] font-black bg-[#162119] hover:bg-[#1f2f24] border border-[#37493b] text-[#86d49a] rounded transition"
              >
                {fKey}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tactical Drawing Tools */}
      <section className="bg-[#101712] border border-[#29362d] rounded-lg p-2">
        <div className="text-[8px] font-black tracking-wider text-[#8b9c91] mb-1.5">
          FERRAMENTAS DE DESENHO
        </div>

        <div className="grid grid-cols-4 gap-1 mb-2">
          <button
            onClick={() => onSelectTool('move')}
            className={`h-9 flex flex-col items-center justify-center rounded border transition ${
              currentTool === 'move'
                ? 'bg-[#8e1724] border-[#ff6675] text-white shadow'
                : 'bg-[#19211c] border-[#38453c] text-[#aab6af] hover:bg-[#222c26]'
            }`}
            title="Mover jogadores e bola"
          >
            <span className="text-[13px] leading-tight">✋</span>
            <span className="text-[7.5px] font-black leading-tight">Mover</span>
          </button>

          <button
            onClick={() => onSelectTool('free')}
            className={`h-9 flex flex-col items-center justify-center rounded border transition ${
              currentTool === 'free'
                ? 'bg-[#8e1724] border-[#ff6675] text-white shadow'
                : 'bg-[#19211c] border-[#38453c] text-[#aab6af] hover:bg-[#222c26]'
            }`}
            title="Desenho livre"
          >
            <span className="text-[13px] leading-tight">✏</span>
            <span className="text-[7.5px] font-black leading-tight">Livre</span>
          </button>

          <button
            onClick={() => onSelectTool('arrow')}
            className={`h-9 flex flex-col items-center justify-center rounded border transition ${
              currentTool === 'arrow'
                ? 'bg-[#8e1724] border-[#ff6675] text-white shadow'
                : 'bg-[#19211c] border-[#38453c] text-[#aab6af] hover:bg-[#222c26]'
            }`}
            title="Seta de movimentação ou passe"
          >
            <span className="text-[13px] leading-tight">➜</span>
            <span className="text-[7.5px] font-black leading-tight">Seta</span>
          </button>

          <button
            onClick={() => onSelectTool('line')}
            className={`h-9 flex flex-col items-center justify-center rounded border transition ${
              currentTool === 'line'
                ? 'bg-[#8e1724] border-[#ff6675] text-white shadow'
                : 'bg-[#19211c] border-[#38453c] text-[#aab6af] hover:bg-[#222c26]'
            }`}
            title="Linha tática reta"
          >
            <span className="text-[13px] leading-tight">━</span>
            <span className="text-[7.5px] font-black leading-tight">Linha</span>
          </button>

          <button
            onClick={() => onSelectTool('zone')}
            className={`h-9 flex flex-col items-center justify-center rounded border transition ${
              currentTool === 'zone'
                ? 'bg-[#8e1724] border-[#ff6675] text-white shadow'
                : 'bg-[#19211c] border-[#38453c] text-[#aab6af] hover:bg-[#222c26]'
            }`}
            title="Área retangular"
          >
            <span className="text-[13px] leading-tight">▭</span>
            <span className="text-[7.5px] font-black leading-tight">Área</span>
          </button>

          <button
            onClick={() => onSelectTool('circle')}
            className={`h-9 flex flex-col items-center justify-center rounded border transition ${
              currentTool === 'circle'
                ? 'bg-[#8e1724] border-[#ff6675] text-white shadow'
                : 'bg-[#19211c] border-[#38453c] text-[#aab6af] hover:bg-[#222c26]'
            }`}
            title="Círculo ou elipse de pressão"
          >
            <span className="text-[13px] leading-tight">◯</span>
            <span className="text-[7.5px] font-black leading-tight">Círculo</span>
          </button>

          <button
            onClick={() => onSelectTool('polygon')}
            className={`h-9 flex flex-col items-center justify-center rounded border transition col-span-2 ${
              currentTool === 'polygon'
                ? 'bg-[#8e1724] border-[#ff6675] text-white shadow'
                : 'bg-[#19211c] border-[#38453c] text-[#aab6af] hover:bg-[#222c26]'
            }`}
            title="Polígono de cobertura por pontos"
          >
            <span className="text-[13px] leading-tight">⬡</span>
            <span className="text-[7.5px] font-black leading-tight">Polígono Livre</span>
          </button>
        </div>

        {/* Color Palette & Stroke Width (shown when not move) */}
        {currentTool !== 'move' && (
          <div className="bg-[#141b16] border border-[#2c372f] rounded p-2 mb-2">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => onSelectColor(c.hex)}
                  title={c.name}
                  style={{ backgroundColor: c.hex }}
                  className={`w-5 h-5 rounded-full border border-gray-500 transition ${
                    currentColor === c.hex ? 'ring-2 ring-white scale-110' : 'opacity-85'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 text-[8px] text-[#93a299]">
              <span>Traço:</span>
              <input
                type="range"
                min="2"
                max="12"
                value={lineWidth}
                onChange={(e) => onLineWidthChange(Number(e.target.value))}
                className="w-full accent-[#d62839] h-1.5 cursor-pointer"
              />
              <span className="w-3 text-right font-mono">{lineWidth}</span>
            </div>
          </div>
        )}

        {/* Close Polygon Action */}
        {currentTool === 'polygon' && (
          <button
            onClick={onClosePolygon}
            disabled={!isPolygonActive || polygonPointsCount < 3}
            className={`w-full h-7 mb-2 text-[9px] font-black rounded border transition flex items-center justify-center gap-1 ${
              isPolygonActive && polygonPointsCount >= 3
                ? 'bg-[#1b6b3b] border-[#43c776] text-white animate-pulse'
                : 'bg-[#1a231d] border-[#334237] text-gray-500 cursor-not-allowed'
            }`}
          >
            <span>✓</span>
            <span>Fechar área ({polygonPointsCount} pontos)</span>
          </button>
        )}

        {/* Quick Tools & Ball */}
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={onUndoDraw}
            title="Desfazer o último traço"
            className="h-7 text-[8px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#38453c] text-[#b3c0b8] rounded"
          >
            ↶ Desfazer
          </button>
          <button
            onClick={onClearDraw}
            title="Limpar todos os desenhos"
            className="h-7 text-[8px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#38453c] text-[#b3c0b8] rounded"
          >
            ⌫ Limpar
          </button>
          <button
            onClick={onAddBall}
            title="Colocar ou reposicionar a bola no centro"
            className="h-7 text-[8px] font-black bg-[#233527] hover:bg-[#2e4734] border border-[#45704d] text-white rounded flex items-center justify-center gap-1 shadow-sm"
          >
            <span>⚽</span>
            <span>Bola</span>
          </button>
        </div>
      </section>
    </aside>
  );
};

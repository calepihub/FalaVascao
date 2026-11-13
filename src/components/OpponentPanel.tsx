import React, { useState } from 'react';
import { TACTICAL_FORMATIONS, POSITION_GROUPS } from '../data/squad';
import { DrawingTool } from './DrawingCanvas';
import { DbClub, DbPlayer } from '../data/databaseService';
import { getInitials } from '../tactics/tacticsLogic';

interface OpponentPanelProps {
  selectedClub: string;
  onSelectClub: (club: string) => void;
  opponentClubs: DbClub[];
  opponentSquad: DbPlayer[];
  onAddOpponentPlayer?: (player: DbPlayer) => void;
  clubGradientStyle: string;
  usedOpponentNumbers: Set<number>;
  usedOpponentPlayerIds?: Set<string>;
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

const OpponentAvatar: React.FC<{
  photoUrl?: string;
  name: string;
  number?: string;
}> = ({ photoUrl, name, number }) => {
  const [failed, setFailed] = useState(false);
  const initials = getInitials(name);

  if (!photoUrl || failed) {
    return (
      <span
        className="text-[9.5px] font-black text-white"
        style={{ textShadow: '0 1px 2px #000' }}
      >
        {number || initials}
      </span>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={name}
      onError={() => setFailed(true)}
      className="w-full h-full object-cover object-top select-none"
    />
  );
};

export const OpponentPanel: React.FC<OpponentPanelProps> = ({
  selectedClub,
  onSelectClub,
  opponentClubs,
  opponentSquad,
  onAddOpponentPlayer,
  clubGradientStyle,
  usedOpponentNumbers,
  usedOpponentPlayerIds = new Set(),
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
  const [activeTab, setActiveTab] = useState<'squad' | 'numbers'>('squad');

  const allDefinedRoles = new Set(POSITION_GROUPS.flatMap(([, roles]) => roles));
  const extraOpponentPlayers = opponentSquad.filter((p) => !allDefinedRoles.has(p.role));

  return (
    <aside className="w-[218px] min-w-[208px] max-w-[230px] flex flex-col h-full bg-[#0d130f] border border-[#29362d] rounded-lg p-1.5 overflow-y-auto space-y-1.5 select-none scrollbar-thin shrink-0">
      {/* Opponent Selection Section */}
      <section className="bg-[#101712] border border-[#29362d] rounded-lg p-1.5 shrink-0">
        <div className="flex items-center justify-between text-[8.5px] font-black tracking-wider text-[#a0aea5] mb-1">
          <span>ADVERSÁRIO</span>
          <div className="flex items-center gap-1">
            {selectedClub && (
              <span className="text-[7.5px] text-[#ff7581] font-bold truncate max-w-[75px]">
                {selectedClub}
              </span>
            )}
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Ocultar painel para aumentar o campo"
                className="text-[7.5px] px-1.5 py-0.5 bg-[#1b2820] hover:bg-[#283c2f] border border-[#3c5443] hover:border-[#52be74] text-[#a9c2b2] hover:text-white rounded font-bold transition flex items-center gap-0.5 cursor-pointer"
              >
                <span>Ocultar</span>
                <span>▶</span>
              </button>
            )}
          </div>
        </div>

        <select
          aria-label="Selecionar equipe adversária"
          value={selectedClub}
          onChange={(e) => onSelectClub(e.target.value)}
          className="w-full h-7 px-1.5 text-[9.5px] font-bold bg-[#172019] text-white border border-[#405047] rounded outline-none focus:border-[#c91f32] cursor-pointer"
        >
          <option value="">Selecione o clube adversário...</option>
          {opponentClubs.map((club) => (
            <option key={club.id || club.name} value={club.name}>
              {club.name}
            </option>
          ))}
        </select>

        {!selectedClub ? (
          <div className="mt-1.5 text-[8.5px] text-[#7c9082] bg-[#131b15] border border-dashed border-[#28382c] rounded p-2 text-center leading-snug">
            Escolha um clube acima para exibir o elenco adversário da base.
          </div>
        ) : (
          <div className="mt-1.5">
            {/* View Mode Toggle: Real Squad from bd.xlsx vs Generic Numbers */}
            <div className="grid grid-cols-2 gap-1 bg-[#151e18] p-0.5 rounded border border-[#28362c] text-[7.5px] font-bold mb-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('squad')}
                className={`py-0.5 rounded text-center transition cursor-pointer ${
                  activeTab === 'squad'
                    ? 'bg-[#25362a] text-white shadow-sm font-black'
                    : 'text-[#849589] hover:text-white'
                }`}
              >
                Elenco ({opponentSquad.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('numbers')}
                className={`py-0.5 rounded text-center transition cursor-pointer ${
                  activeTab === 'numbers'
                    ? 'bg-[#25362a] text-white shadow-sm font-black'
                    : 'text-[#849589] hover:text-white'
                }`}
              >
                Números (1-20)
              </button>
            </div>

            {/* TAB 1: Real Squad from bd.xlsx (bounded container so Controls remain accessible) */}
            {activeTab === 'squad' && (
              <div className="flex flex-col gap-1 max-h-[290px] overflow-y-auto scrollbar-thin pr-0.5">
                {opponentSquad.length === 0 ? (
                  <div className="text-[8.5px] text-[#78887e] text-center py-2.5 bg-[#131b15] rounded border border-[#212b23]">
                    Carregando atletas do {selectedClub}...
                  </div>
                ) : (
                  <>
                    {POSITION_GROUPS.map(([groupName, roles]) => {
                      const players = opponentSquad.filter((p) => roles.includes(p.role));
                      if (!players.length) return null;

                      return (
                        <div
                          key={groupName}
                          className="bg-[#121914] border border-[#232c25] rounded-[6px] p-1"
                        >
                          <div className="flex items-center justify-between text-[7.5px] font-black tracking-wider text-[#9aa99f] mb-0.5 px-0.5 leading-none">
                            <span>{groupName}</span>
                            <span className="text-[7px] font-bold text-[#6d7e73]">
                              {players.length}
                            </span>
                          </div>

                          {/* 5 circular avatars per row, 32px, with wrapping */}
                          <div className="grid grid-cols-5 gap-1 pt-0.5">
                            {players.map((player) => {
                              const isUsed = usedOpponentPlayerIds.has(player.id);

                              return (
                                <button
                                  key={player.id || player.name}
                                  type="button"
                                  onClick={() => onAddOpponentPlayer?.(player)}
                                  title={`${player.name} (${player.role} • ${player.rawPosition}) - Clique para colocar em campo`}
                                  aria-label={`${player.name} - ${player.role}`}
                                  style={{
                                    background: clubGradientStyle
                                  }}
                                  className={`group relative w-[32px] h-[32px] rounded-full p-0 border-[1.5px] border-white hover:scale-105 active:scale-95 transition shadow cursor-pointer flex items-center justify-center mx-auto ${
                                    isUsed ? 'opacity-40 hover:opacity-85' : ''
                                  }`}
                                >
                                  <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center pointer-events-none">
                                    <OpponentAvatar
                                      photoUrl={player.photoUrl}
                                      name={player.name}
                                      number={player.number}
                                    />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {extraOpponentPlayers.length > 0 && (
                      <div className="bg-[#121914] border border-[#232c25] rounded-[6px] p-1">
                        <div className="flex items-center justify-between text-[7.5px] font-black tracking-wider text-[#9aa99f] mb-0.5 px-0.5 leading-none">
                          <span>OUTROS</span>
                          <span className="text-[7px] font-bold text-[#6d7e73]">
                            {extraOpponentPlayers.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-5 gap-1 pt-0.5">
                          {extraOpponentPlayers.map((player) => {
                            const isUsed = usedOpponentPlayerIds.has(player.id);
                            return (
                              <button
                                key={player.id || player.name}
                                type="button"
                                onClick={() => onAddOpponentPlayer?.(player)}
                                title={`${player.name} (${player.role}) - Clique para colocar em campo`}
                                style={{ background: clubGradientStyle }}
                                className={`group relative w-[32px] h-[32px] rounded-full p-0 border-[1.5px] border-white hover:scale-105 active:scale-95 transition shadow cursor-pointer flex items-center justify-center mx-auto ${
                                  isUsed ? 'opacity-40 hover:opacity-85' : ''
                                }`}
                              >
                                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center pointer-events-none">
                                  <OpponentAvatar
                                    photoUrl={player.photoUrl}
                                    name={player.name}
                                    number={player.number}
                                  />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* TAB 2: Numbered Opponent Tokens 1..20 */}
            {activeTab === 'numbers' && (
              <div className="grid grid-cols-5 gap-1 pt-0.5">
                {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => {
                  const isUsed = usedOpponentNumbers.has(num);

                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => onAddOpponent(num)}
                      title={`Adicionar adversário #${num} ao campo`}
                      style={{ background: clubGradientStyle }}
                      className={`w-[32px] h-[32px] rounded-full border-[1.5px] border-white flex items-center justify-center text-[9.5px] font-black text-white shadow transition transform active:scale-90 cursor-pointer mx-auto ${
                        isUsed ? 'opacity-40 hover:opacity-80' : 'hover:scale-105'
                      }`}
                    >
                      <span style={{ textShadow: '0 1px 2px #000' }}>{num}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Field Controls */}
      <section className="bg-[#101712] border border-[#29362d] rounded-lg p-1.5 shrink-0">
        <div className="text-[7.5px] font-black tracking-wider text-[#8b9c91] mb-1">
          CONTROLES DO CAMPO
        </div>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={onClearPlayers}
            className="h-6 text-[7.5px] font-bold bg-[#19211c] hover:bg-[#2c1d20] hover:text-[#ff929d] border border-[#3d4b41] hover:border-[#8e2430] text-[#c9d4cd] rounded transition cursor-pointer"
          >
            Limpar peças
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="h-6 text-[7.5px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#3d4b41] text-[#c9d4cd] rounded transition cursor-pointer"
          >
            ⛶ Campo máximo
          </button>
          <button
            type="button"
            onClick={onUndoDraw}
            className="h-6 text-[7.5px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#3d4b41] text-[#c9d4cd] rounded transition cursor-pointer"
          >
            ↶ Desfazer risco
          </button>
          <button
            type="button"
            onClick={onClearDraw}
            className="h-6 text-[7.5px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#3d4b41] text-[#c9d4cd] rounded transition cursor-pointer"
          >
            ⌫ Limpar riscos
          </button>
        </div>

        {/* Quick Formations */}
        <div className="mt-1.5 pt-1 border-t border-[#232d26]">
          <div className="text-[7.5px] font-bold text-[#86958c] mb-1">
            FORMAÇÃO RÁPIDA (VASCO)
          </div>
          <div className="grid grid-cols-3 gap-1">
            {Object.keys(TACTICAL_FORMATIONS).map((fKey) => (
              <button
                key={fKey}
                type="button"
                onClick={() => onApplyFormation(fKey)}
                title={`Posicionar 11 jogadores do Vasco no ${fKey}`}
                className="h-5.5 text-[7.5px] font-black bg-[#162119] hover:bg-[#1f2f24] border border-[#37493b] text-[#86d49a] rounded transition cursor-pointer"
              >
                {fKey}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tactical Drawing Tools */}
      <section className="bg-[#101712] border border-[#29362d] rounded-lg p-1.5 shrink-0">
        <div className="text-[7.5px] font-black tracking-wider text-[#8b9c91] mb-1">
          FERRAMENTAS DE DESENHO
        </div>

        <div className="grid grid-cols-4 gap-1 mb-1.5">
          <button
            type="button"
            onClick={() => onSelectTool('move')}
            className={`h-8 flex flex-col items-center justify-center rounded border transition cursor-pointer ${
              currentTool === 'move'
                ? 'bg-[#8e1724] border-[#ff6675] text-white shadow'
                : 'bg-[#19211c] border-[#38453c] text-[#aab6af] hover:bg-[#222c26]'
            }`}
            title="Mover jogadores e bola"
          >
            <span className="text-[12px] leading-none">✋</span>
            <span className="text-[7px] font-black leading-tight mt-0.5">Mover</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('free')}
            className={`h-8 flex flex-col items-center justify-center rounded border transition cursor-pointer ${
              currentTool === 'free'
                ? 'bg-[#8e1724] border-[#ff6675] text-white shadow'
                : 'bg-[#19211c] border-[#38453c] text-[#aab6af] hover:bg-[#222c26]'
            }`}
            title="Desenho livre"
          >
            <span className="text-[12px] leading-none">✏</span>
            <span className="text-[7px] font-black leading-tight mt-0.5">Livre</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('arrow')}
            className={`h-8 flex flex-col items-center justify-center rounded border transition cursor-pointer ${
              currentTool === 'arrow'
                ? 'bg-[#8e1724] border-[#ff6675] text-white shadow'
                : 'bg-[#19211c] border-[#38453c] text-[#aab6af] hover:bg-[#222c26]'
            }`}
            title="Seta de movimentação ou passe"
          >
            <span className="text-[12px] leading-none">➜</span>
            <span className="text-[7px] font-black leading-tight mt-0.5">Seta</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('line')}
            className={`h-8 flex flex-col items-center justify-center rounded border transition cursor-pointer ${
              currentTool === 'line'
                ? 'bg-[#8e1724] border-[#ff6675] text-white shadow'
                : 'bg-[#19211c] border-[#38453c] text-[#aab6af] hover:bg-[#222c26]'
            }`}
            title="Linha tática reta"
          >
            <span className="text-[12px] leading-none">━</span>
            <span className="text-[7px] font-black leading-tight mt-0.5">Linha</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('zone')}
            className={`h-8 flex flex-col items-center justify-center rounded border transition cursor-pointer ${
              currentTool === 'zone'
                ? 'bg-[#8e1724] border-[#ff6675] text-white shadow'
                : 'bg-[#19211c] border-[#38453c] text-[#aab6af] hover:bg-[#222c26]'
            }`}
            title="Área retangular"
          >
            <span className="text-[12px] leading-none">▭</span>
            <span className="text-[7px] font-black leading-tight mt-0.5">Área</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('circle')}
            className={`h-8 flex flex-col items-center justify-center rounded border transition cursor-pointer ${
              currentTool === 'circle'
                ? 'bg-[#8e1724] border-[#ff6675] text-white shadow'
                : 'bg-[#19211c] border-[#38453c] text-[#aab6af] hover:bg-[#222c26]'
            }`}
            title="Círculo ou elipse de pressão"
          >
            <span className="text-[12px] leading-none">◯</span>
            <span className="text-[7px] font-black leading-tight mt-0.5">Círculo</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('polygon')}
            className={`h-8 flex flex-col items-center justify-center rounded border transition col-span-2 cursor-pointer ${
              currentTool === 'polygon'
                ? 'bg-[#8e1724] border-[#ff6675] text-white shadow'
                : 'bg-[#19211c] border-[#38453c] text-[#aab6af] hover:bg-[#222c26]'
            }`}
            title="Polígono de cobertura por pontos"
          >
            <span className="text-[12px] leading-none">⬡</span>
            <span className="text-[7px] font-black leading-tight mt-0.5">Polígono Livre</span>
          </button>
        </div>

        {/* Color Palette & Stroke Width (shown when not move) */}
        {currentTool !== 'move' && (
          <div className="bg-[#141b16] border border-[#2c372f] rounded p-1.5 mb-1.5">
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => onSelectColor(c.hex)}
                  title={c.name}
                  style={{ backgroundColor: c.hex }}
                  className={`w-4.5 h-4.5 rounded-full border border-gray-500 transition cursor-pointer ${
                    currentColor === c.hex ? 'ring-2 ring-white scale-110' : 'opacity-85'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 text-[7.5px] text-[#93a299]">
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
            type="button"
            onClick={onClosePolygon}
            disabled={!isPolygonActive || polygonPointsCount < 3}
            className={`w-full h-6 mb-1.5 text-[8.5px] font-black rounded border transition flex items-center justify-center gap-1 ${
              isPolygonActive && polygonPointsCount >= 3
                ? 'bg-[#1b6b3b] border-[#43c776] text-white animate-pulse cursor-pointer'
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
            type="button"
            onClick={onUndoDraw}
            title="Desfazer o último traço"
            className="h-6 text-[7.5px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#38453c] text-[#b3c0b8] rounded cursor-pointer"
          >
            ↶ Desfazer
          </button>
          <button
            type="button"
            onClick={onClearDraw}
            title="Limpar todos os desenhos"
            className="h-6 text-[7.5px] font-bold bg-[#19211c] hover:bg-[#253229] border border-[#38453c] text-[#b3c0b8] rounded cursor-pointer"
          >
            ⌫ Limpar
          </button>
          <button
            type="button"
            onClick={onAddBall}
            title="Colocar ou reposicionar a bola no centro"
            className="h-6 text-[7.5px] font-black bg-[#233527] hover:bg-[#2e4734] border border-[#45704d] text-white rounded flex items-center justify-center gap-1 shadow-sm cursor-pointer"
          >
            <span>⚽</span>
            <span>Bola</span>
          </button>
        </div>
      </section>
    </aside>
  );
};

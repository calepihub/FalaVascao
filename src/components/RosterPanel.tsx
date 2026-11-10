import React, { useRef } from 'react';
import { POSITION_GROUPS, SquadPlayer } from '../data/squad';
import { getInitials, normName, TacticalPlay, PlayFrame } from '../tactics/tacticsLogic';
import { storage, FieldTokenData } from '../data/storage';
import { PlayEditor } from './PlayEditor';

interface RosterPanelProps {
  squad: SquadPlayer[];
  onAddPlayer: (player: SquadPlayer, defaultX?: number, defaultY?: number) => void;
  onTogglePlayEditor: () => void;
  onToggleExtras: () => void;
  isPlayEditorOpen: boolean;
  isExtrasOpen: boolean;
  onStatusMessage: (msg: string) => void;

  // Play editor props passed to render directly inside #playPanelHost
  currentPlay: TacticalPlay;
  onUpdatePlay: (play: TacticalPlay) => void;
  onCaptureFrame: () => void;
  onApplyFrame: (frame: PlayFrame) => void;
  onPlayAnimation: () => void;
  onStopAnimation: () => void;
  onResetToStart: () => void;
  onSavePlay: () => void;
  onNewPlay: () => void;
  savedPlays: TacticalPlay[];
  onLoadSavedPlay: (play: TacticalPlay) => void;
  onDeleteSavedPlay: (id: number | string) => void;
  isAnimating: boolean;
  fieldTokens: FieldTokenData[];
  onLoadDemoPlay: () => void;
  onToggleCollapse?: () => void;
}

export const RosterPanel: React.FC<RosterPanelProps> = ({
  squad,
  onAddPlayer,
  onTogglePlayEditor,
  onToggleExtras,
  isPlayEditorOpen,
  isExtrasOpen,
  onStatusMessage,
  currentPlay,
  onUpdatePlay,
  onCaptureFrame,
  onApplyFrame,
  onPlayAnimation,
  onStopAnimation,
  onResetToStart,
  onSavePlay,
  onNewPlay,
  savedPlays,
  onLoadSavedPlay,
  onDeleteSavedPlay,
  isAnimating,
  fieldTokens,
  onLoadDemoPlay,
  onToggleCollapse
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    let matched = 0;
    const unmatched: string[] = [];

    for (const file of files) {
      const baseName = normName(file.name.replace(/\.[^.]+$/, ''));
      const player = squad.find((p) => {
        const pn = normName(p.name);
        return baseName === pn || baseName.includes(pn) || pn.includes(baseName);
      });

      if (!player) {
        unmatched.push(file.name);
        continue;
      }

      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await storage.storePhoto(player.name, base64);
      matched++;
    }

    onStatusMessage(`${matched} foto(s) importada(s) com sucesso para o banco local.`);
    if (unmatched.length > 0) {
      alert(`${matched} fotos importadas.\nNão identificadas: ${unmatched.join(', ')}`);
    }
    e.target.value = '';
  };

  return (
    <aside className="w-[230px] min-w-[215px] max-w-[245px] flex flex-col h-full bg-[#0d130f] border border-[#29362d] rounded-lg p-2 overflow-y-auto space-y-1.5 select-none scrollbar-thin shrink-0">
      {/* Header with Title and Photo Import */}
      <div className="flex items-center justify-between pb-1 border-b border-[#222c25] shrink-0">
        <div>
          <h2 className="text-[10px] font-black tracking-wider text-[#d2dbd5] uppercase leading-none">
            ELENCO E FUNÇÕES
          </h2>
          <span className="text-[8px] text-[#78887e]">Vasco da Gama • 2026</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handlePhotoImport}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Importar fotos locais do elenco"
            className="text-[8px] px-1.5 py-0.5 bg-[#18211b] hover:bg-[#233027] border border-[#37453b] text-[#b8c5be] rounded font-semibold transition cursor-pointer"
          >
            📷 Fotos
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Ocultar elenco para aumentar o campo"
              className="text-[8px] px-2 py-0.5 bg-[#1b2820] hover:bg-[#283c2f] border border-[#3c5443] hover:border-[#52be74] text-[#a9c2b2] hover:text-white rounded font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <span>◀</span>
              <span>Ocultar</span>
            </button>
          )}
        </div>
      </div>

      {/* Roster Section: Exactly 5 photos per row, no overlap, wraps at 6th player */}
      <div id="roster" className="flex flex-col gap-1.5 shrink-0">
        {POSITION_GROUPS.map(([groupName, roles]) => {
          const players = squad.filter((p) => roles.includes(p.role));
          if (!players.length) return null;

          return (
            <div
              key={groupName}
              className="position-group bg-[#101712] border border-[#232c25] rounded-[6px] p-1.5"
            >
              {/* Header line */}
              <div className="flex items-center justify-between text-[8px] font-black tracking-wider text-[#9aa99f] mb-1">
                <span>{groupName}</span>
                <span className="text-[7.5px] font-bold text-[#6d7e73]">{players.length}</span>
              </div>

              {/* Grid of exactly 5 circular player avatars per row, 36px, wrapping seamlessly */}
              <div className="grid grid-cols-5 gap-1.5 pt-0.5">
                {players.map((player) => {
                  const photoUrl = storage.getPhoto(player.name, player.photo);
                  const initials = getInitials(player.name);

                  return (
                    <button
                      key={player.name}
                      type="button"
                      onClick={() => onAddPlayer(player)}
                      title={`${player.name} (${player.role})`}
                      aria-label={`${player.name} - ${player.role}`}
                      className="group relative w-[36px] h-[36px] rounded-full p-0 border-2 border-[#d2dad5] bg-[#0d100e] hover:border-[#e32636] hover:scale-105 active:scale-95 transition shadow cursor-pointer flex items-center justify-center"
                    >
                      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center pointer-events-none">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={player.name}
                            className="w-full h-full object-cover object-top select-none"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="text-[10px] font-black text-white">{initials}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Buttons directly underneath the roster */}
      <div className="mt-1.5 pt-1 border-t border-[#222c25] space-y-1 shrink-0">
        <button
          type="button"
          onClick={onTogglePlayEditor}
          className={`w-full h-[32px] text-[10px] font-black tracking-wider rounded border transition flex items-center justify-center gap-1.5 cursor-pointer ${
            isPlayEditorOpen
              ? 'bg-[#8e1724] border-[#e35260] text-white shadow-md'
              : 'bg-[#172019] hover:bg-[#253027] border-[#3c4b40] text-white'
          }`}
        >
          <span>🎬</span>
          <span>{isPlayEditorOpen ? 'FECHAR EDITOR DE JOGADAS' : 'CRIAR / EDITAR JOGADAS'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleExtras}
          className={`w-full h-[28px] text-[8.5px] font-black rounded border transition flex items-center justify-center gap-1 cursor-pointer ${
            isExtrasOpen
              ? 'bg-[#7d1520] border-[#ec6571] text-white'
              : 'bg-[#151c17] hover:bg-[#202922] border-[#354339] text-[#cdd8d1]'
          }`}
        >
          <span>⚙</span>
          <span>{isExtrasOpen ? 'FECHAR RECURSOS' : 'RECURSOS DA PRANCHETA'}</span>
        </button>
      </div>

      {/* #playPanelHost: opens directly below the buttons in the empty space below the players */}
      <div id="playPanelHost" className="flex-1 min-h-0 overflow-y-auto mt-1 pr-0.5 scrollbar-thin">
        {isPlayEditorOpen ? (
          <PlayEditor
            isOpen={true}
            onClose={onTogglePlayEditor}
            currentPlay={currentPlay}
            onUpdatePlay={onUpdatePlay}
            onCaptureFrame={onCaptureFrame}
            onApplyFrame={onApplyFrame}
            onPlayAnimation={onPlayAnimation}
            onStopAnimation={onStopAnimation}
            onResetToStart={onResetToStart}
            onSavePlay={onSavePlay}
            onNewPlay={onNewPlay}
            savedPlays={savedPlays}
            onLoadSavedPlay={onLoadSavedPlay}
            onDeleteSavedPlay={onDeleteSavedPlay}
            isAnimating={isAnimating}
            fieldTokens={fieldTokens}
            onLoadDemoPlay={onLoadDemoPlay}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-3 text-[#64756b] border border-dashed border-[#1f2922] rounded-md min-h-[80px]">
            <span className="text-xl mb-1">🎬</span>
            <span className="text-[9px] font-bold text-[#8ba093]">Área de Jogadas</span>
            <span className="text-[7.5px] text-[#55665c] mt-0.5 max-w-[210px]">
              Clique em <b>CRIAR / EDITAR JOGADAS</b> acima para abrir a janela de animação e etapas nesta área.
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};

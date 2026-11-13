import React, { useRef, useState } from 'react';
import { POSITION_GROUPS, SquadPlayer } from '../data/squad';
import { getInitials, normName } from '../tactics/tacticsLogic';
import { storage } from '../data/storage';
import { DbPlayer } from '../data/databaseService';

export type RosterPlayerItem = SquadPlayer & Partial<DbPlayer>;

interface RosterPanelProps {
  squad: RosterPlayerItem[];
  onAddPlayer: (player: RosterPlayerItem, defaultX?: number, defaultY?: number) => void;
  onStatusMessage: (msg: string) => void;
  onToggleCollapse?: () => void;
}

const AvatarWithFallback: React.FC<{
  photoUrl?: string;
  name: string;
}> = ({ photoUrl, name }) => {
  const [failed, setFailed] = useState(false);
  const initials = getInitials(name);

  if (!photoUrl || failed) {
    return <span className="text-[9.5px] font-black text-white">{initials}</span>;
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

export const RosterPanel: React.FC<RosterPanelProps> = ({
  squad,
  onAddPlayer,
  onStatusMessage,
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
      onStatusMessage(`${matched} fotos importadas. Não identificadas: ${unmatched.join(', ')}`);
    }
    e.target.value = '';
  };

  // Track matched roles so no player from bd.xlsx is ever omitted
  const allDefinedRoles = new Set(POSITION_GROUPS.flatMap(([, roles]) => roles));
  const extraPlayers = squad.filter((p) => !allDefinedRoles.has(p.role));

  return (
    <aside className="w-[218px] min-w-[208px] max-w-[230px] flex flex-col h-full bg-[#0d130f] border border-[#29362d] rounded-lg p-1.5 overflow-y-auto space-y-1 select-none scrollbar-thin shrink-0">
      {/* Header with Title and Photo Import */}
      <div className="flex items-center justify-between pb-1 border-b border-[#222c25] shrink-0">
        <div className="min-w-0">
          <h2 className="text-[9.5px] font-black tracking-wider text-[#d2dbd5] uppercase leading-tight truncate">
            ELENCO DO VASCO
          </h2>
          <span className="text-[7.5px] text-[#78887e] block leading-tight">
            CR Vasco da Gama • {squad.length} atletas
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
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
            className="text-[7.5px] px-1.5 py-0.5 bg-[#18211b] hover:bg-[#233027] border border-[#37453b] text-[#b8c5be] rounded font-semibold transition cursor-pointer"
          >
            📷
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Ocultar elenco para aumentar o campo"
              className="text-[7.5px] px-1.5 py-0.5 bg-[#1b2820] hover:bg-[#283c2f] border border-[#3c5443] hover:border-[#52be74] text-[#a9c2b2] hover:text-white rounded font-bold transition flex items-center gap-0.5 cursor-pointer"
            >
              <span>◀</span>
              <span>Ocultar</span>
            </button>
          )}
        </div>
      </div>

      {/* Roster Section: Compact 5-per-row layout so ALL groups including ATACANTES fit cleanly */}
      <div id="roster" className="flex flex-col gap-1 shrink-0">
        {POSITION_GROUPS.map(([groupName, roles]) => {
          const players = squad.filter((p) => roles.includes(p.role));
          if (!players.length) return null;

          return (
            <div
              key={groupName}
              className="position-group bg-[#101712] border border-[#232c25] rounded-[6px] p-1"
            >
              {/* Compact Header line */}
              <div className="flex items-center justify-between text-[7.5px] font-black tracking-wider text-[#9aa99f] mb-0.5 px-0.5 leading-none">
                <span>{groupName}</span>
                <span className="text-[7px] font-bold text-[#6d7e73]">{players.length}</span>
              </div>

              {/* Grid of exactly 5 circular player avatars per row, 33px, wrapping cleanly */}
              <div className="grid grid-cols-5 gap-1 pt-0.5">
                {players.map((player) => {
                  const photoUrl = storage.getPhoto(player.name, player.photoUrl || player.photo);

                  return (
                    <button
                      key={player.id || player.name}
                      type="button"
                      onClick={() => onAddPlayer(player)}
                      title={`${player.name} (${player.role}${player.rawPosition ? ` • ${player.rawPosition}` : ''}) - Clique para colocar em campo`}
                      aria-label={`${player.name} - ${player.role}`}
                      className="group relative w-[33px] h-[33px] rounded-full p-0 border-[1.5px] border-[#d2dad5] bg-[#0d100e] hover:border-[#e32636] hover:scale-105 active:scale-95 transition shadow cursor-pointer flex items-center justify-center mx-auto"
                    >
                      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center pointer-events-none">
                        <AvatarWithFallback photoUrl={photoUrl} name={player.name} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {extraPlayers.length > 0 && (
          <div className="position-group bg-[#101712] border border-[#232c25] rounded-[6px] p-1">
            <div className="flex items-center justify-between text-[7.5px] font-black tracking-wider text-[#9aa99f] mb-0.5 px-0.5 leading-none">
              <span>OUTROS</span>
              <span className="text-[7px] font-bold text-[#6d7e73]">{extraPlayers.length}</span>
            </div>
            <div className="grid grid-cols-5 gap-1 pt-0.5">
              {extraPlayers.map((player) => {
                const photoUrl = storage.getPhoto(player.name, player.photoUrl || player.photo);
                return (
                  <button
                    key={player.id || player.name}
                    type="button"
                    onClick={() => onAddPlayer(player)}
                    title={`${player.name} (${player.role}) - Clique para colocar em campo`}
                    className="group relative w-[33px] h-[33px] rounded-full p-0 border-[1.5px] border-[#d2dad5] bg-[#0d100e] hover:border-[#e32636] hover:scale-105 active:scale-95 transition shadow cursor-pointer flex items-center justify-center mx-auto"
                  >
                    <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center pointer-events-none">
                      <AvatarWithFallback photoUrl={photoUrl} name={player.name} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

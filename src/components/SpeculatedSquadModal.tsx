import React, { useMemo, useRef, useState } from 'react';
import { DbClub, DbPlayer } from '../data/databaseService';
import {
  createCustomSpeculatedPlayer,
  createSpeculatedPlayerFromDb,
  createSpeculatedSquad,
  removePlayerFromSpeculatedSquad,
  sanitizeSpeculatedSquadName,
  SpeculatedPlayer,
  SpeculatedSquad,
  upsertPlayerInSpeculatedSquad
} from '../data/speculatedSquads';
import { POSITION_GROUPS, SquadPlayer } from '../data/squad';
import { getInitials } from '../tactics/tacticsLogic';

interface SpeculatedSquadModalProps {
  isOpen: boolean;
  onClose: () => void;
  officialSquad: Array<SquadPlayer & Partial<DbPlayer>>;
  allClubs: DbClub[];
  allDbPlayers: DbPlayer[];
  speculatedSquads: SpeculatedSquad[];
  activeSquadId: string;
  onSelectSquad: (squadId: string) => void;
  onSaveSquad: (squad: SpeculatedSquad) => Promise<SpeculatedSquad>;
  onDeleteSquad: (squadId: string) => Promise<void>;
  onActivateOnBoard: (squadId: string) => void;
}

const ROLE_OPTIONS = [
  { value: 'GOL', label: 'GOL - Goleiro' },
  { value: 'ZAG', label: 'ZAG - Zagueiro' },
  { value: 'LD', label: 'LD - Lateral Direito' },
  { value: 'LE', label: 'LE - Lateral Esquerdo' },
  { value: 'VOL', label: 'VOL - Volante' },
  { value: 'MC', label: 'MC - Meia Central' },
  { value: 'MEI', label: 'MEI - Meia Ofensivo' },
  { value: 'MD', label: 'MD - Meia Direita' },
  { value: 'ME', label: 'ME - Meia Esquerda' },
  { value: 'PD', label: 'PD - Ponta Direita' },
  { value: 'PE', label: 'PE - Ponta Esquerda' },
  { value: 'SA', label: 'SA - Segundo Atacante' },
  { value: 'CA', label: 'CA - Centroavante' },
  { value: 'ATA', label: 'ATA - Atacante' }
];

const PlayerMiniAvatar: React.FC<{ photo?: string; name: string; highlight?: boolean }> = ({
  photo,
  name,
  highlight
}) => {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center border-2 bg-[#121c15] ${
        highlight ? 'border-[#f59e0b]' : 'border-[#3b5240]'
      }`}
    >
      {photo && !failed ? (
        <img
          src={photo}
          alt={name}
          onError={() => setFailed(true)}
          className="w-full h-full object-cover object-top"
        />
      ) : (
        <span className="text-[10px] font-black text-white">{getInitials(name)}</span>
      )}
    </div>
  );
};

export const SpeculatedSquadModal: React.FC<SpeculatedSquadModalProps> = ({
  isOpen,
  onClose,
  officialSquad,
  allClubs,
  allDbPlayers,
  speculatedSquads,
  activeSquadId,
  onSelectSquad,
  onSaveSquad,
  onDeleteSquad,
  onActivateOnBoard
}) => {
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newSquadName, setNewSquadName] = useState('');
  const [includeVascoBase, setIncludeVascoBase] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  // Market picker state
  const [marketTab, setMarketTab] = useState<'database' | 'custom'>('database');
  const [searchQuery, setSearchQuery] = useState('');
  const [clubFilter, setClubFilter] = useState<string>('ALL_NON_VASCO');
  const [posGroupFilter, setPosGroupFilter] = useState<string>('ALL');
  const [rosterFilter, setRosterFilter] = useState<'all' | 'speculated' | 'base'>('all');

  // Custom player form state
  const [customName, setCustomName] = useState('');
  const [customRole, setCustomRole] = useState('ATA');
  const [customOriginClub, setCustomOriginClub] = useState('');
  const [customAge, setCustomAge] = useState('');
  const [customNationality, setCustomNationality] = useState('Brasil');
  const [customMarketValue, setCustomMarketValue] = useState('');
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [customComment, setCustomComment] = useState('');
  const customPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const activeSquad = useMemo(
    () => speculatedSquads.find((s) => s.id === activeSquadId) || speculatedSquads[0] || null,
    [speculatedSquads, activeSquadId]
  );

  const existingPlayerKeys = useMemo(() => {
    const keys = new Set<string>();
    (activeSquad?.players || []).forEach((p) => {
      if (p.id) keys.add(p.id.toLowerCase());
      if (p.name) keys.add(p.name.trim().toLowerCase());
    });
    return keys;
  }, [activeSquad]);

  const filteredMarketPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allDbPlayers
      .filter((p) => {
        if (clubFilter === 'ALL_NON_VASCO') {
          if (p.club.toLowerCase().includes('vasco')) return false;
        } else if (clubFilter !== 'ALL') {
          if (p.club !== clubFilter) return false;
        }
        if (posGroupFilter !== 'ALL') {
          const group = POSITION_GROUPS.find(([label]) => label === posGroupFilter);
          if (group && !group[1].includes(p.role)) return false;
        }
        if (q) {
          return (
            p.name.toLowerCase().includes(q) ||
            p.club.toLowerCase().includes(q) ||
            p.role.toLowerCase().includes(q) ||
            (p.rawPosition || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .slice(0, 80);
  }, [allDbPlayers, clubFilter, posGroupFilter, searchQuery]);

  if (!isOpen) return null;

  const showNotice = (text: string, tone: 'success' | 'error' = 'success') => {
    setNotice({ text, tone });
    setTimeout(() => {
      setNotice((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  const handleCreateSquadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const cleanName = sanitizeSpeculatedSquadName(newSquadName);
    setSaving(true);
    try {
      const created = createSpeculatedSquad(cleanName, officialSquad, includeVascoBase);
      const saved = await onSaveSquad(created);
      onSelectSquad(saved.id);
      setNewSquadName('');
      setIsCreatingNew(false);
      showNotice(`Elenco "${saved.name}" criado e salvo na sua conta!`);
    } catch (err: any) {
      showNotice(err?.message || 'Não foi possível criar o elenco especulado.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSquad || saving) return;
    setSaving(true);
    try {
      const updated = await onSaveSquad({
        ...activeSquad,
        name: sanitizeSpeculatedSquadName(renameValue)
      });
      setIsRenaming(false);
      showNotice(`Elenco renomeado para "${updated.name}".`);
    } catch (err: any) {
      showNotice(err?.message || 'Erro ao renomear elenco.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteSquad = async (squadId: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await onDeleteSquad(squadId);
      setConfirmDeleteId(null);
      showNotice('Elenco especulado excluído.');
    } catch (err: any) {
      showNotice(err?.message || 'Erro ao excluir elenco.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSignDbPlayer = async (dbPlayer: DbPlayer) => {
    if (!activeSquad || saving) return;
    setSaving(true);
    try {
      const specPlayer = createSpeculatedPlayerFromDb(dbPlayer);
      const nextSquad = upsertPlayerInSpeculatedSquad(activeSquad, specPlayer);
      await onSaveSquad(nextSquad);
      showNotice(`${dbPlayer.name} (${dbPlayer.club}) adicionado às especulações!`);
    } catch (err: any) {
      showNotice(err?.message || 'Erro ao adicionar jogador.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCustomPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCustomPhotoUrl(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddCustomPlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSquad || saving) return;
    if (!customName.trim()) {
      showNotice('Informe o nome do jogador contratado/especulado.', 'error');
      return;
    }
    setSaving(true);
    try {
      const player = createCustomSpeculatedPlayer({
        name: customName,
        role: customRole,
        originClub: customOriginClub,
        age: customAge,
        nationality: customNationality,
        marketValue: customMarketValue,
        photoUrl: customPhotoUrl,
        comment: customComment
      });
      const nextSquad = upsertPlayerInSpeculatedSquad(activeSquad, player);
      await onSaveSquad(nextSquad);
      setCustomName('');
      setCustomOriginClub('');
      setCustomAge('');
      setCustomMarketValue('');
      setCustomPhotoUrl('');
      setCustomComment('');
      showNotice(`Contratação "${player.name}" adicionada ao elenco!`);
    } catch (err: any) {
      showNotice(err?.message || 'Erro ao cadastrar jogador.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePlayer = async (player: SpeculatedPlayer) => {
    if (!activeSquad || saving) return;
    setSaving(true);
    try {
      const nextSquad = removePlayerFromSpeculatedSquad(activeSquad, player.id || player.name);
      await onSaveSquad(nextSquad);
      showNotice(`${player.name} removido do elenco especulado.`);
    } catch (err: any) {
      showNotice(err?.message || 'Erro ao remover atleta.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const speculatedCount = (activeSquad?.players || []).filter((p) => p.isSpeculated).length;
  const baseCount = Math.max(0, (activeSquad?.players.length || 0) - speculatedCount);

  const visibleSquadPlayers = (activeSquad?.players || []).filter((p) => {
    if (rosterFilter === 'speculated') return p.isSpeculated === true;
    if (rosterFilter === 'base') return p.isSpeculated !== true;
    return true;
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9995] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl max-h-[92vh] bg-[#0c130e] border border-[#2f4535] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#e6ece8]"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a281d] via-[#101a13] to-[#0c130e] px-5 py-3.5 border-b border-[#243628] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d97706] to-[#92400e] border border-[#fbbf24] flex items-center justify-center text-xl shadow shrink-0">
              🔮
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-white uppercase tracking-wider">
                  Elencos Especulados & Contratações
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                  Mercado da Bola
                </span>
              </div>
              <p className="text-xs text-[#91a798] truncate">
                Monte seus elencos paralelos com possíveis contratações sem alterar o Elenco Oficial do Vasco.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#18261c] hover:bg-[#25392b] text-gray-400 hover:text-white flex items-center justify-center font-bold transition cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Squad Selector / Creator Strip */}
        <div className="px-5 py-2.5 bg-[#090f0b] border-b border-[#1f2e23] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase text-[#7f9687]">Seus Elencos:</span>

            {speculatedSquads.map((sq) => {
              const isSelected = activeSquad?.id === sq.id;
              return (
                <button
                  key={sq.id}
                  type="button"
                  onClick={() => {
                    onSelectSquad(sq.id);
                    setIsRenaming(false);
                    setConfirmDeleteId(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#b45309] border-[#fbbf24] text-white shadow'
                      : 'bg-[#121c15] border-[#283a2d] text-[#9cb3a4] hover:text-white hover:border-[#415f49]'
                  }`}
                >
                  <span>🔮</span>
                  <span>{sq.name}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-black/35 text-[10px]">
                    {sq.players.length}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setIsCreatingNew((prev) => !prev)}
              className="px-3 py-1 rounded-lg text-xs font-black bg-[#1b6b3b] hover:bg-[#23874b] border border-[#34a362] text-white transition cursor-pointer"
            >
              + Novo Elenco
            </button>
          </div>

          {activeSquad && !isCreatingNew && (
            <div className="flex items-center gap-1.5">
              {isRenaming ? (
                <form onSubmit={handleRenameSubmit} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    maxLength={60}
                    autoFocus
                    className="h-7 px-2 text-xs bg-[#121c15] text-white border border-[#43c776] rounded-md outline-none w-44"
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-2 py-1 text-[11px] font-bold bg-[#1b6b3b] text-white rounded cursor-pointer"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRenaming(false)}
                    className="px-2 py-1 text-[11px] font-bold text-gray-400 hover:text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRenameValue(activeSquad.name);
                      setIsRenaming(true);
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold bg-[#152119] hover:bg-[#1e3024] border border-[#2d4234] text-[#b4c8bb] rounded-md cursor-pointer"
                  >
                    ✏️ Renomear
                  </button>
                  {confirmDeleteId === activeSquad.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleConfirmDeleteSquad(activeSquad.id)}
                        className="px-2.5 py-1 text-[11px] font-black bg-[#991b1b] hover:bg-[#b91c1c] text-white rounded-md cursor-pointer"
                      >
                        Confirmar Exclusão
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 text-[11px] text-gray-400 hover:text-white cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(activeSquad.id)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-[#291517] hover:bg-[#401a1f] border border-[#5a242a] text-[#ff8693] rounded-md cursor-pointer"
                    >
                      🗑️ Excluir
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Inline New Squad Form */}
        {isCreatingNew && (
          <form
            onSubmit={handleCreateSquadSubmit}
            className="px-5 py-3 bg-[#111c14] border-b border-[#294030] flex flex-wrap items-center gap-3 shrink-0"
          >
            <input
              type="text"
              value={newSquadName}
              onChange={(e) => setNewSquadName(e.target.value)}
              placeholder="Nome do elenco (ex: Vasco Janela 2026)"
              maxLength={60}
              required
              autoFocus
              className="h-8 px-3 text-xs bg-[#0a100c] text-white border border-[#324c39] rounded-lg outline-none focus:border-[#43c776] w-64"
            />
            <label className="flex items-center gap-2 text-xs text-[#c2d4c8] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeVascoBase}
                onChange={(e) => setIncludeVascoBase(e.target.checked)}
                className="w-4 h-4 rounded bg-[#162319] border-[#304735]"
              />
              <span>Começar com jogadores atuais do Elenco Oficial ({officialSquad.length})</span>
            </label>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="px-3 py-1 text-xs font-bold text-gray-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 bg-[#1b6b3b] hover:bg-[#23874b] text-white text-xs font-black rounded-lg cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Criando...' : 'Criar Elenco'}
              </button>
            </div>
          </form>
        )}

        {/* Feedback Notice */}
        {notice && (
          <div
            className={`mx-5 mt-3 px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center justify-between shrink-0 ${
              notice.tone === 'error'
                ? 'bg-[#2b1416] border-[#6b262d] text-[#ff919c]'
                : 'bg-[#12291a] border-[#29633c] text-[#7bf2a3]'
            }`}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs opacity-70 hover:opacity-100 cursor-pointer px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Workspace */}
        {!activeSquad ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-3xl">
              🔮
            </div>
            <div className="max-w-md space-y-1.5">
              <h3 className="text-base font-black text-white">
                Crie seu Primeiro Elenco Especulado
              </h3>
              <p className="text-xs text-[#90a697] leading-relaxed">
                O <b>Elenco Oficial</b> continua preservado direto da planilha. Crie quantos elencos paralelos quiser para simular reforços de outros clubes ou cadastrar possíveis contratações na Prancheta!
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreatingNew(true)}
              className="px-5 py-2.5 bg-[#1b6b3b] hover:bg-[#23874b] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow cursor-pointer"
            >
              + Criar Meu Elenco Especulado
            </button>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 sm:p-5 overflow-hidden min-h-0">
            {/* LEFT COLUMN: Add Signings from bd.xlsx or Custom */}
            <div className="bg-[#09100b] border border-[#223227] rounded-xl flex flex-col overflow-hidden min-h-[360px]">
              <div className="p-3 border-b border-[#1d2b21] bg-[#0e1610] flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-[#141f17] p-0.5 rounded-lg border border-[#26382b]">
                  <button
                    type="button"
                    onClick={() => setMarketTab('database')}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      marketTab === 'database'
                        ? 'bg-[#1b6b3b] text-white shadow'
                        : 'text-[#8ea395] hover:text-white'
                    }`}
                  >
                    🔍 Buscar na Base ({allDbPlayers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarketTab('custom')}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      marketTab === 'custom'
                        ? 'bg-[#b45309] text-white shadow'
                        : 'text-[#8ea395] hover:text-white'
                    }`}
                  >
                    ➕ Jogador Novo / Rumor
                  </button>
                </div>
              </div>

              {marketTab === 'database' ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Search & Filters */}
                  <div className="p-3 border-b border-[#1a271e] grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Nome do atleta..."
                      className="h-8 px-2.5 text-xs bg-[#121c15] text-white border border-[#2c4031] rounded-lg outline-none focus:border-[#43c776]"
                    />
                    <select
                      value={clubFilter}
                      onChange={(e) => setClubFilter(e.target.value)}
                      className="h-8 px-2 text-xs bg-[#121c15] text-white border border-[#2c4031] rounded-lg outline-none focus:border-[#43c776]"
                    >
                      <option value="ALL_NON_VASCO">Outros Clubes (Contratações)</option>
                      <option value="ALL">Todos os Clubes (20)</option>
                      {allClubs.map((c) => (
                        <option key={c.id || c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={posGroupFilter}
                      onChange={(e) => setPosGroupFilter(e.target.value)}
                      className="h-8 px-2 text-xs bg-[#121c15] text-white border border-[#2c4031] rounded-lg outline-none focus:border-[#43c776]"
                    >
                      <option value="ALL">Todas as posições</option>
                      {POSITION_GROUPS.map(([groupLabel]) => (
                        <option key={groupLabel} value={groupLabel}>
                          {groupLabel}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Player Results */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
                    {filteredMarketPlayers.length === 0 ? (
                      <div className="py-10 text-center text-xs text-[#798d7f]">
                        Nenhum jogador encontrado com esses filtros. Use a aba &quot;➕ Jogador Novo / Rumor&quot; para cadastrar qualquer atleta de fora da planilha.
                      </div>
                    ) : (
                      filteredMarketPlayers.map((p) => {
                        const alreadyInSquad =
                          existingPlayerKeys.has((p.id || '').toLowerCase()) ||
                          existingPlayerKeys.has(p.name.trim().toLowerCase());
                        return (
                          <div
                            key={`${p.club}_${p.id}_${p.name}`}
                            className="p-2 rounded-xl bg-[#101812] border border-[#213025] hover:border-[#395541] flex items-center justify-between gap-2.5"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <PlayerMiniAvatar photo={p.photoUrl} name={p.name} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-white truncate">
                                    {p.name}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded bg-[#1b2b20] text-[#75eb9d] text-[9px] font-black shrink-0">
                                    {p.role}
                                  </span>
                                </div>
                                <div className="text-[10.5px] text-[#839a8b] truncate">
                                  {p.club}
                                  {p.age ? ` • ${p.age}a` : ''}
                                  {p.marketValue && p.marketValue !== '-' ? ` • ${p.marketValue}` : ''}
                                </div>
                              </div>
                            </div>

                            {alreadyInSquad ? (
                              <span className="px-2.5 py-1 rounded-lg bg-[#142d1d] border border-[#275c39] text-[#6ce897] text-[10.5px] font-bold shrink-0">
                                ✓ No elenco
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleSignDbPlayer(p)}
                                className="px-2.5 py-1 rounded-lg bg-[#b45309] hover:bg-[#d97706] text-white text-[10.5px] font-black transition cursor-pointer shrink-0 disabled:opacity-50"
                              >
                                + Contratar
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleAddCustomPlayerSubmit}
                  className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-[#8aa092] mb-1">
                        Nome do Jogador *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={80}
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Ex: Richarlison, Coutinho..."
                        className="w-full h-8 px-2.5 text-xs bg-[#121c15] text-white border border-[#2c4031] rounded-lg outline-none focus:border-[#f59e0b]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-[#8aa092] mb-1">
                        Posição Tática *
                      </label>
                      <select
                        value={customRole}
                        onChange={(e) => setCustomRole(e.target.value)}
                        className="w-full h-8 px-2 text-xs bg-[#121c15] text-white border border-[#2c4031] rounded-lg outline-none focus:border-[#f59e0b]"
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-[#8aa092] mb-1">
                        Clube Atual / Origem
                      </label>
                      <input
                        type="text"
                        maxLength={80}
                        value={customOriginClub}
                        onChange={(e) => setCustomOriginClub(e.target.value)}
                        placeholder="Ex: Livre, Benfica..."
                        className="w-full h-8 px-2.5 text-xs bg-[#121c15] text-white border border-[#2c4031] rounded-lg outline-none focus:border-[#f59e0b]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-[#8aa092] mb-1">
                        Nacionalidade
                      </label>
                      <input
                        type="text"
                        maxLength={50}
                        value={customNationality}
                        onChange={(e) => setCustomNationality(e.target.value)}
                        placeholder="Brasil"
                        className="w-full h-8 px-2.5 text-xs bg-[#121c15] text-white border border-[#2c4031] rounded-lg outline-none focus:border-[#f59e0b]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-[#8aa092] mb-1">
                          Idade
                        </label>
                        <input
                          type="text"
                          maxLength={10}
                          value={customAge}
                          onChange={(e) => setCustomAge(e.target.value)}
                          placeholder="26"
                          className="w-full h-8 px-2 text-xs bg-[#121c15] text-white border border-[#2c4031] rounded-lg outline-none focus:border-[#f59e0b]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-[#8aa092] mb-1">
                          Valor
                        </label>
                        <input
                          type="text"
                          maxLength={40}
                          value={customMarketValue}
                          onChange={(e) => setCustomMarketValue(e.target.value)}
                          placeholder="€5.0mi"
                          className="w-full h-8 px-2 text-xs bg-[#121c15] text-white border border-[#2c4031] rounded-lg outline-none focus:border-[#f59e0b]"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#8aa092] mb-1">
                      Foto do Jogador (Link URL ou Enviar Imagem)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customPhotoUrl}
                        onChange={(e) => setCustomPhotoUrl(e.target.value)}
                        placeholder="https://... (opcional)"
                        className="flex-1 h-8 px-2.5 text-xs bg-[#121c15] text-white border border-[#2c4031] rounded-lg outline-none focus:border-[#f59e0b]"
                      />
                      <input
                        ref={customPhotoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCustomPhotoUpload}
                      />
                      <button
                        type="button"
                        onClick={() => customPhotoInputRef.current?.click()}
                        className="h-8 px-3 bg-[#18261c] hover:bg-[#233729] border border-[#344e3c] text-xs font-bold rounded-lg cursor-pointer shrink-0"
                      >
                        📷 Arquivo
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#8aa092] mb-1">
                      Comentário / Rumor da Negociação
                    </label>
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={customComment}
                      onChange={(e) => setCustomComment(e.target.value)}
                      placeholder="Ex: Especulado por empréstimo para reforçar o ataque..."
                      className="w-full p-2.5 text-xs bg-[#121c15] text-white border border-[#2c4031] rounded-lg outline-none focus:border-[#f59e0b] resize-none"
                    />
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving || !customName.trim()}
                      className="px-4 py-2 bg-[#b45309] hover:bg-[#d97706] text-white text-xs font-black rounded-lg shadow transition cursor-pointer disabled:opacity-50"
                    >
                      {saving ? 'Adicionando...' : '+ Adicionar Contratação ao Elenco'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* RIGHT COLUMN: Current Speculated Squad Roster */}
            <div className="bg-[#09100b] border border-[#223227] rounded-xl flex flex-col overflow-hidden min-h-[360px]">
              <div className="p-3 border-b border-[#1d2b21] bg-[#0e1610] flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    {activeSquad.name}
                  </h3>
                  <span className="text-[10.5px] text-[#839a8b]">
                    {activeSquad.players.length} atletas •{' '}
                    <b className="text-amber-300">{speculatedCount} reforço(s) especulado(s)</b>
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[10.5px] font-bold">
                  <button
                    type="button"
                    onClick={() => setRosterFilter('all')}
                    className={`px-2 py-1 rounded cursor-pointer ${
                      rosterFilter === 'all'
                        ? 'bg-[#1b6b3b] text-white'
                        : 'bg-[#131d16] text-[#8ba092] hover:text-white'
                    }`}
                  >
                    Todos ({activeSquad.players.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRosterFilter('speculated')}
                    className={`px-2 py-1 rounded cursor-pointer ${
                      rosterFilter === 'speculated'
                        ? 'bg-[#b45309] text-white'
                        : 'bg-[#131d16] text-amber-300/80 hover:text-amber-200'
                    }`}
                  >
                    🔮 Reforços ({speculatedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRosterFilter('base')}
                    className={`px-2 py-1 rounded cursor-pointer ${
                      rosterFilter === 'base'
                        ? 'bg-[#26382c] text-white'
                        : 'bg-[#131d16] text-[#8ba092] hover:text-white'
                    }`}
                  >
                    🏛️ Base ({baseCount})
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
                {visibleSquadPlayers.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#798d7f]">
                    Nenhum atleta neste filtro. Adicione contratações usando a coluna ao lado!
                  </div>
                ) : (
                  visibleSquadPlayers.map((p) => (
                    <div
                      key={`${p.id}_${p.name}`}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2.5 ${
                        p.isSpeculated
                          ? 'bg-[#1c160b] border-[#784b12]'
                          : 'bg-[#101812] border-[#213025]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PlayerMiniAvatar
                          photo={p.photoUrl || p.photo}
                          name={p.name}
                          highlight={p.isSpeculated}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white truncate">{p.name}</span>
                            <span className="px-1.5 py-0.2 rounded bg-[#1b2b20] text-[#75eb9d] text-[9px] font-black">
                              {p.role}
                            </span>
                            {p.isSpeculated && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-black">
                                🔮 Especulado
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-[#839a8b] truncate">
                            {p.isSpeculated
                              ? `Origem: ${p.originClub || 'Mercado da Bola'}`
                              : 'CR Vasco da Gama (Base Oficial)'}
                            {p.marketValue && p.marketValue !== '-' ? ` • ${p.marketValue}` : ''}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleRemovePlayer(p)}
                        title={`Remover ${p.name} deste elenco`}
                        className="px-2 py-1 rounded bg-[#271517] hover:bg-[#3f1c20] border border-[#54252b] text-[#ff8794] text-[10.5px] font-bold transition cursor-pointer shrink-0"
                      >
                        Remover
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[#090e0a] border-t border-[#1f2d22] flex items-center justify-between gap-2 shrink-0 text-xs">
          <span className="text-[#7e9185] hidden sm:inline">
            O Elenco Oficial permanece intocado. Alterne a qualquer momento na barra lateral da Prancheta.
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-[#17251c] hover:bg-[#23382a] text-white rounded-lg font-bold transition cursor-pointer"
            >
              Fechar
            </button>
            {activeSquad && (
              <button
                type="button"
                onClick={() => {
                  onActivateOnBoard(activeSquad.id);
                  onClose();
                }}
                className="px-4 py-1.5 bg-[#1b6b3b] hover:bg-[#23874b] text-white rounded-lg font-black transition shadow cursor-pointer"
              >
                Usar na Prancheta Agora
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

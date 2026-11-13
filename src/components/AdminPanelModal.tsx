import React, { useState, useEffect } from 'react';
import { AppUser, UserRole, UserStatus, SiteSettings, authService, OWNER_EMAIL } from '../data/auth';
import { CommunityLineup, storage } from '../data/storage';
import { FIREBASE_PROJECT_ID, FIRESTORE_DATABASE_ID } from '../data/firebase';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser | null;
  onSettingsChanged?: (settings: SiteSettings) => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSettingsChanged
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'visibility' | 'mural' | 'database'>('members');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [settings, setSettings] = useState<SiteSettings>({
    muralVisible: true,
    muralPublicPosting: true,
    tacticsVisible: true,
    advancedToolsVisible: true,
    liveStreamsVisible: true,
    kickBannerVisible: true
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState('');

  // Mural moderation state
  const [muralList, setMuralList] = useState<CommunityLineup[]>([]);
  const [loadingMural, setLoadingMural] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const [adminNotice, setAdminNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !authService.isAdminOrOwner(currentUser)) return;

    async function loadAdminData() {
      setLoadingUsers(true);
      try {
        const userList = await authService.getRegisteredUsers();
        setUsers(userList);
      } catch (err) {
        console.warn('Erro ao carregar usuários do Firestore:', err);
        setAdminNotice('Não foi possível carregar os usuários do Firestore. Verifique se você está autenticado com a conta Google de Administrador.');
      } finally {
        setLoadingUsers(false);
      }

      const currentSettings = await authService.getSiteSettings();
      setSettings(currentSettings);

      setLoadingMural(true);
      try {
        const lineups = await storage.getCommunityLineups();
        setMuralList(lineups);
      } catch (err) {
        console.warn('Erro ao carregar mural do Firestore:', err);
      } finally {
        setLoadingMural(false);
      }
    }

    loadAdminData();
  }, [isOpen, currentUser]);

  if (!isOpen || !authService.isAdminOrOwner(currentUser)) return null;

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const updated = await authService.updateUser({ id: userId, role: newRole });
    if (updated) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    }
  };

  const handleStatusChange = async (userId: string, newStatus: UserStatus) => {
    const updated = await authService.updateUser({ id: userId, status: newStatus });
    if (updated) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));
    }
  };

  const handlePermissionToggle = async (
    userId: string,
    permKey: keyof AppUser['permissions'],
    currentVal: boolean
  ) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    if (target.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) return; // Owner permissions cannot be changed

    const newPerms = { ...target.permissions, [permKey]: !currentVal };
    const updated = await authService.updateUser({
      id: userId,
      permissions: newPerms
    });

    if (updated) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, permissions: newPerms } : u))
      );
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (email.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
      setAdminNotice('O Proprietário principal não pode ser removido.');
      return;
    }

    const ok = await authService.deleteUser(userId);
    if (ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setAdminNotice(`Membro ${email} removido do banco de dados Firebase.`);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const updated = await authService.updateSiteSettings(settings);
      if (updated) {
        setSettings(updated);
        onSettingsChanged?.(updated);
        setSettingsSavedMessage('Configurações salvas e sincronizadas no Firestore em tempo real!');
        setTimeout(() => setSettingsSavedMessage(''), 3500);
      }
    } catch {
      setAdminNotice('Falha ao salvar configurações no Firestore.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteMuralItem = async (lineupId: string, title: string) => {
    const ok = await storage.deleteCommunityLineup(lineupId);
    if (ok) {
      setMuralList((prev) => prev.filter((l) => l.id !== lineupId));
      setAdminNotice(`Publicação "${title}" removida do Mural da Torcida.`);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl max-h-[92vh] bg-[#0c130e] border border-[#2b3d30] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#e6ece8]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#17241a] via-[#101b13] to-[#0c130e] px-6 py-4 border-b border-[#243628] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d62839] to-[#80131e] border border-[#ff6675] flex items-center justify-center text-xl shadow-lg">
              🛡️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white uppercase tracking-wider">
                  Painel Administrativo Fala Vascão
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-[#d62839] text-white rounded-md tracking-wider shadow">
                  OWNER & ADMIN
                </span>
              </div>
              <p className="text-xs text-[#90a697]">
                Logado como: <b className="text-white">{currentUser?.name || 'Tazmania CRVG'}</b> ({currentUser?.email || OWNER_EMAIL})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#18261c] hover:bg-[#25392b] text-gray-400 hover:text-white flex items-center justify-center font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-2 border-b border-[#1f2d22] bg-[#090e0a] text-xs font-bold overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'members'
                ? 'bg-[#1b6b3b] text-white shadow-md'
                : 'text-[#8ba091] hover:text-white hover:bg-[#131d16]'
            }`}
          >
            <span>👥</span>
            <span>Membros & Permissões</span>
            <span className="px-1.5 py-0.2 bg-black/40 text-[10px] rounded-full">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('visibility')}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'visibility'
                ? 'bg-[#1b6b3b] text-white shadow-md'
                : 'text-[#8ba091] hover:text-white hover:bg-[#131d16]'
            }`}
          >
            <span>👁️</span>
            <span>Visibilidade de Recursos</span>
          </button>

          <button
            onClick={() => setActiveTab('mural')}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'mural'
                ? 'bg-[#1b6b3b] text-white shadow-md'
                : 'text-[#8ba091] hover:text-white hover:bg-[#131d16]'
            }`}
          >
            <span>🖼️</span>
            <span>Mural da Torcida (Moderação)</span>
            <span className="px-1.5 py-0.2 bg-black/40 text-[10px] rounded-full">
              {muralList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'database'
                ? 'bg-[#1b6b3b] text-white shadow-md'
                : 'text-[#8ba091] hover:text-white hover:bg-[#131d16]'
            }`}
          >
            <span>🔥</span>
            <span>Firebase & Sincronização</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {adminNotice && (
            <div className="mb-4 p-3 bg-[#152419] border border-[#2d5838] rounded-xl text-xs text-[#89eba8] flex items-center justify-between">
              <span>{adminNotice}</span>
              <button
                type="button"
                onClick={() => setAdminNotice(null)}
                className="text-gray-400 hover:text-white font-bold px-1.5 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: MEMBERS & PERMISSIONS */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#213025]">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Controle de Acesso de Membros (Google OAuth)
                  </h3>
                  <p className="text-xs text-[#8ca092]">
                    Todo torcedor que entra com sua Conta Google aparece aqui automaticamente para controle de cargo e permissões.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome ou e-mail..."
                    className="h-8 px-3 text-xs bg-[#121c15] text-white border border-[#2b3c30] rounded-lg outline-none focus:border-[#43c776] w-48 sm:w-64"
                  />
                </div>
              </div>

              {loadingUsers ? (
                <div className="py-12 text-center text-[#7e9185]">Carregando membros...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-[#7e9185] bg-[#09100b] rounded-xl border border-[#1f2e23]">
                  Nenhum membro encontrado.
                </div>
              ) : (
                <div className="border border-[#26372a] rounded-xl overflow-hidden bg-[#0e1610]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#142017] border-b border-[#26372a] text-[#8ea394] font-bold">
                        <th className="py-3 px-4">Membro / Torcedor</th>
                        <th className="py-3 px-3">Cargo / Role</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-center">Mural (Postar)</th>
                        <th className="py-3 px-3 text-center">Prancheta</th>
                        <th className="py-3 px-3 text-center">Avançado</th>
                        <th className="py-3 px-3 text-center">Moderar</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1c291f]">
                      {filteredUsers.map((user) => {
                        const isThisOwner = user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

                        return (
                          <tr
                            key={user.id}
                            className={`hover:bg-[#121d14] transition ${
                              isThisOwner ? 'bg-[#18271a]/50' : ''
                            }`}
                          >
                            {/* Member info */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d62839] to-[#1f3022] border border-[#3b5240] flex items-center justify-center font-black text-white text-xs shrink-0 overflow-hidden">
                                  {user.avatar ? (
                                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                  ) : (
                                    user.name.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white truncate">{user.name}</span>
                                    {isThisOwner && (
                                      <span className="px-1.5 py-0.2 bg-[#d62839] text-white text-[9px] font-black rounded uppercase">
                                        Proprietário
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-[#7d9384] truncate block">
                                    {user.email}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Role selector */}
                            <td className="py-3 px-3">
                              {isThisOwner ? (
                                <span className="text-[11px] font-black text-[#5ce68b] uppercase">
                                  Owner Total
                                </span>
                              ) : (
                                <select
                                  value={user.role}
                                  onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                                  className="h-7 px-2 text-xs bg-[#17251a] text-white border border-[#324937] rounded-md outline-none cursor-pointer focus:border-[#43c776]"
                                >
                                  <option value="member">Membro Comum</option>
                                  <option value="vip">Membro VIP / Barreira</option>
                                  <option value="moderator">Moderador</option>
                                  <option value="admin">Administrador</option>
                                </select>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3">
                              {isThisOwner ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#14361e] text-[#63f798] border border-[#276e3c]">
                                  Ativo (Fixo)
                                </span>
                              ) : (
                                <select
                                  value={user.status}
                                  onChange={(e) => handleStatusChange(user.id, e.target.value as UserStatus)}
                                  className={`h-7 px-2 text-[11px] font-bold rounded-md outline-none cursor-pointer border ${
                                    user.status === 'active'
                                      ? 'bg-[#14361e] text-[#63f798] border-[#276e3c]'
                                      : user.status === 'pending'
                                      ? 'bg-[#3b2f12] text-[#f7d363] border-[#735a22]'
                                      : 'bg-[#381619] text-[#f76371] border-[#6b252a]'
                                  }`}
                                >
                                  <option value="active">Ativo</option>
                                  <option value="pending">Pendente</option>
                                  <option value="blocked">Bloqueado</option>
                                </select>
                              )}
                            </td>

                            {/* Permission: Mural */}
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={user.permissions?.canPostMural}
                                disabled={isThisOwner}
                                onChange={() =>
                                  handlePermissionToggle(user.id, 'canPostMural', user.permissions?.canPostMural)
                                }
                                className="w-4 h-4 rounded text-emerald-500 bg-[#162319] border-[#304735] focus:ring-0 cursor-pointer"
                              />
                            </td>

                            {/* Permission: Tactics */}
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={user.permissions?.canUseTactics}
                                disabled={isThisOwner}
                                onChange={() =>
                                  handlePermissionToggle(user.id, 'canUseTactics', user.permissions?.canUseTactics)
                                }
                                className="w-4 h-4 rounded text-emerald-500 bg-[#162319] border-[#304735] focus:ring-0 cursor-pointer"
                              />
                            </td>

                            {/* Permission: Advanced Tools */}
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={user.permissions?.canUseAdvancedTools}
                                disabled={isThisOwner}
                                onChange={() =>
                                  handlePermissionToggle(user.id, 'canUseAdvancedTools', user.permissions?.canUseAdvancedTools)
                                }
                                className="w-4 h-4 rounded text-emerald-500 bg-[#162319] border-[#304735] focus:ring-0 cursor-pointer"
                              />
                            </td>

                            {/* Permission: Moderate */}
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={user.permissions?.canModerate}
                                disabled={isThisOwner}
                                onChange={() =>
                                  handlePermissionToggle(user.id, 'canModerate', user.permissions?.canModerate)
                                }
                                className="w-4 h-4 rounded text-emerald-500 bg-[#162319] border-[#304735] focus:ring-0 cursor-pointer"
                              />
                            </td>

                            {/* Action: Delete */}
                            <td className="py-3 px-4 text-right">
                              {!isThisOwner && (
                                <button
                                  onClick={() => handleDeleteUser(user.id, user.email)}
                                  className="px-2 py-1 bg-[#261618] hover:bg-[#3d1a1e] border border-[#522428] text-[#ff808d] rounded text-[11px] font-bold transition cursor-pointer"
                                >
                                  Remover
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VISIBILITY & FEATURE FLAGS */}
          {activeTab === 'visibility' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Visibilidade de Recursos e Ferramentas
                </h3>
                <p className="text-xs text-[#8ca092]">
                  Defina quais módulos do portal e da prancheta ficam visíveis para torcedores e membros da comunidade.
                </p>
              </div>

              {settingsSavedMessage && (
                <div className="p-3 bg-[#13331b] border border-[#2b6d3b] rounded-xl text-xs text-[#70f093] font-bold flex items-center gap-2">
                  <span>✓</span>
                  <span>{settingsSavedMessage}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* 1. Mural da Torcida */}
                <div className="p-4 bg-[#0f1712] border border-[#28382c] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Mural da Torcida (Escalações)</h4>
                    <p className="text-[11px] text-[#86998c]">
                      Exibir a seção pública onde fotos de escalações dos membros são compartilhadas.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.muralVisible}
                      onChange={(e) => setSettings({ ...settings, muralVisible: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#212f25] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1b6b3b]"></div>
                  </label>
                </div>

                {/* 2. Publicações no Mural */}
                <div className="p-4 bg-[#0f1712] border border-[#28382c] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Permitir Novas Publicações no Mural</h4>
                    <p className="text-[11px] text-[#86998c]">
                      Se desativado, o mural fica em modo somente leitura (apenas o Administrador pode postar).
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.muralPublicPosting}
                      onChange={(e) => setSettings({ ...settings, muralPublicPosting: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#212f25] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1b6b3b]"></div>
                  </label>
                </div>

                {/* 3. Prancheta Tática PRO */}
                <div className="p-4 bg-[#0f1712] border border-[#28382c] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Acesso à Prancheta Tática PRO</h4>
                    <p className="text-[11px] text-[#86998c]">
                      Exibe o botão de acesso à ferramenta de montagem de táticas e jogadas.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.tacticsVisible}
                      onChange={(e) => setSettings({ ...settings, tacticsVisible: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#212f25] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1b6b3b]"></div>
                  </label>
                </div>

                {/* 4. Recursos Avançados */}
                <div className="p-4 bg-[#0f1712] border border-[#28382c] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Recursos Avançados da Prancheta</h4>
                    <p className="text-[11px] text-[#86998c]">
                      Controles de alinhamento, animações em loop, exportação broadcast e biblioteca.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.advancedToolsVisible}
                      onChange={(e) => setSettings({ ...settings, advancedToolsVisible: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#212f25] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1b6b3b]"></div>
                  </label>
                </div>

                {/* 5. Transmissões YouTube ao Vivo */}
                <div className="p-4 bg-[#0f1712] border border-[#28382c] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Player de Transmissões do YouTube</h4>
                    <p className="text-[11px] text-[#86998c]">
                      Player em destaque com espelhamento automático das transmissões ao vivo.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.liveStreamsVisible}
                      onChange={(e) => setSettings({ ...settings, liveStreamsVisible: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#212f25] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1b6b3b]"></div>
                  </label>
                </div>

                {/* 6. Banner Kick.com */}
                <div className="p-4 bg-[#0f1712] border border-[#28382c] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Banner e Links da Kick.com</h4>
                    <p className="text-[11px] text-[#86998c]">
                      Exibe o card de transmissões alternativas na plataforma Kick.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.kickBannerVisible}
                      onChange={(e) => setSettings({ ...settings, kickBannerVisible: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#212f25] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1b6b3b]"></div>
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="px-6 py-2.5 bg-[#1b6b3b] hover:bg-[#23874b] text-white rounded-xl font-black text-xs tracking-wider transition shadow cursor-pointer disabled:opacity-50"
                >
                  {savingSettings ? 'Salvando...' : 'Salvar Alterações de Visibilidade'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: MURAL DA TORCIDA (MODERATION & PHOTOS) */}
          {activeTab === 'mural' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Moderação de Fotos do Mural
                </h3>
                <p className="text-xs text-[#8ca092]">
                  Todas as escalações compartilhadas no mural são fotos estáticas protegidas contra edições. O Administrador pode visualizar em alta resolução ou excluir publicações inadequadas.
                </p>
              </div>

              {loadingMural ? (
                <div className="py-12 text-center text-[#7e9185]">Carregando publicações do mural...</div>
              ) : muralList.length === 0 ? (
                <div className="py-12 text-center text-[#7e9185] bg-[#09100b] rounded-xl border border-[#1f2e23]">
                  Nenhuma escalação compartilhada no mural no momento.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {muralList.map((lineup) => (
                    <div
                      key={lineup.id}
                      className="bg-[#101712] border border-[#2b3b2f] rounded-xl p-3.5 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        {/* Snapshot photo preview */}
                        {lineup.imageUrl ? (
                          <div
                            onClick={() => setPreviewPhoto(lineup.imageUrl || null)}
                            className="relative aspect-video w-full rounded-lg overflow-hidden border border-[#2c3d31] bg-black cursor-pointer group"
                          >
                            <img
                              src={lineup.imageUrl}
                              alt={lineup.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold text-white transition">
                              🔍 Ampliar Foto do Campo
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-video w-full rounded-lg bg-[#142017] border border-[#26372a] flex items-center justify-center text-[11px] text-[#788e80]">
                            Foto gerada na prancheta
                          </div>
                        )}

                        <div>
                          <div className="flex items-center justify-between text-[10px] text-[#7a9182]">
                            <span className="font-bold text-[#55db88]">{lineup.formation || '4-3-3'}</span>
                            <span>{new Date(lineup.publishedAt).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <h4 className="text-xs font-bold text-white mt-0.5 leading-snug">
                            {lineup.title}
                          </h4>
                          <span className="text-[11px] text-[#93a79a] block mt-0.5">
                            Autor: <b className="text-white">{lineup.author}</b>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#1f2c22] text-xs">
                        <span className="text-[#ff7886] font-bold">❤️ {lineup.likes} curtidas</span>
                        <button
                          onClick={() => handleDeleteMuralItem(lineup.id, lineup.title)}
                          className="px-2.5 py-1 bg-[#291719] hover:bg-[#401a1e] border border-[#5c2429] text-[#ff808d] rounded font-bold transition cursor-pointer"
                        >
                          Excluir do Mural
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DATABASE DETAILS */}
          {activeTab === 'database' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Banco de Dados em Nuvem (Firebase Firestore & Google Auth)
                </h3>
                <p className="text-xs text-[#8ca092]">
                  Autenticação Google verificada e sincronização em tempo real com o Firestore.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-[#0f1712] border border-[#25362a] rounded-xl text-center">
                  <span className="text-2xl font-black text-white">{users.length}</span>
                  <span className="text-[11px] text-[#8ea295] block mt-1 uppercase font-bold">
                    Contas Google Sincronizadas
                  </span>
                </div>

                <div className="p-4 bg-[#0f1712] border border-[#25362a] rounded-xl text-center">
                  <span className="text-2xl font-black text-white">{muralList.length}</span>
                  <span className="text-[11px] text-[#8ea295] block mt-1 uppercase font-bold">
                    Escalações no Mural
                  </span>
                </div>

                <div className="p-4 bg-[#0f1712] border border-[#25362a] rounded-xl text-center">
                  <span className="text-xs px-2 py-1 rounded bg-[#13361a] text-[#55db88] font-black inline-block mt-1">
                    🟢 SINCRONIZADO
                  </span>
                  <span className="text-[11px] text-[#8ea295] block mt-2 uppercase font-bold">
                    Firebase Auth + Firestore
                  </span>
                </div>
              </div>

              <div className="p-4 bg-[#111a14] border border-[#2a3c2f] rounded-xl space-y-2.5 text-xs">
                <div className="font-bold text-white flex items-center gap-2">
                  <span>🔥</span>
                  <span>Projeto Firebase: {FIREBASE_PROJECT_ID}</span>
                </div>
                <div className="text-[11px] font-mono text-[#7fe4a1] break-all">
                  Database ID: {FIRESTORE_DATABASE_ID}
                </div>
                <p className="text-xs text-[#82998a] leading-relaxed">
                  O login usa exclusivamente OAuth oficial do Google via Firebase Authentication. Somente a conta autenticada e verificada como <b>{OWNER_EMAIL}</b> recebe privilégios de Administrador Master nas regras de segurança do Firestore.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#090e0a] px-6 py-3.5 border-t border-[#1f2d22] flex items-center justify-between shrink-0 text-xs text-[#7e9185]">
          <span>Fala Vascão • Painel Exclusivo de Administração</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#17251c] hover:bg-[#23382a] text-white rounded-lg font-bold transition cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>
      </div>

      {/* Lightbox / Zoom Photo Modal */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl max-h-[90vh] bg-[#0c140e] border border-[#394f3e] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-3 bg-[#111a13] border-b border-[#243527] flex items-center justify-between">
              <span className="text-xs font-bold text-white">Visualização de Foto do Campo (Snapshot)</span>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="text-gray-400 hover:text-white px-2 py-0.5 text-xs font-bold cursor-pointer"
              >
                ✕ Fechar
              </button>
            </div>
            <div className="p-2 bg-black flex items-center justify-center overflow-hidden">
              <img src={previewPhoto} alt="Foto da Escalação" className="max-w-full max-h-[78vh] object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

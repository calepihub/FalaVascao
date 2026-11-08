import React, { useState } from 'react';
import { SquadPlayer } from '../data/squad';
import { TacticalPlay, BoardMeta, generateInterbaseSQL } from '../tactics/tacticsLogic';
import { SavedBoard } from '../data/storage';

interface InterbaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  squad: SquadPlayer[];
  savedPlays: TacticalPlay[];
  savedBoards: SavedBoard[];
  onImportBackup?: (data: any) => void;
}

export const InterbaseModal: React.FC<InterbaseModalProps> = ({
  isOpen,
  onClose,
  squad,
  savedPlays,
  savedBoards
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'sql' | 'tables' | 'query'>('status');
  const [queryInput, setQueryInput] = useState('SELECT * FROM TB_JOGADA');
  const [queryResult, setQueryResult] = useState<any[] | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sqlContent = generateInterbaseSQL({
    squad,
    plays: savedPlays,
    boards: savedBoards
  });

  const handleCopySQL = () => {
    navigator.clipboard.writeText(sqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSQL = () => {
    const blob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interbase_prancheta_vascao_${new Date().toISOString().slice(0, 10)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    const payload = {
      system: 'Prancheta Vascaina PRO - InterBase Engine',
      version: '50.0.0',
      exportedAt: new Date().toISOString(),
      squad,
      savedPlays,
      savedBoards
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interbase_backup_vascao_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExecuteQuery = () => {
    const q = queryInput.trim().toUpperCase();
    if (q.includes('TB_JOGADA')) {
      setQueryResult(
        savedPlays.map((p, i) => ({
          ID: i + 1,
          NOME: p.name,
          ESCOPO: p.scope,
          VELOCIDADE: p.speed || 1200,
          ETAPAS: p.frames.length,
          ATUALIZADO_EM: p.updated || new Date().toISOString()
        }))
      );
    } else if (q.includes('TB_ELENCO')) {
      setQueryResult(
        squad.map((p, i) => ({
          ID: i + 1,
          NOME: p.name,
          POSICAO: p.role,
          FOTO_URL: p.photo ? p.photo.slice(0, 45) + '...' : '(sem foto)'
        }))
      );
    } else if (q.includes('TB_PRANCHETA')) {
      setQueryResult(
        savedBoards.map((b, i) => ({
          ID: i + 1,
          TITULO: b.meta.title || 'Sem título',
          COMPETICAO: b.meta.competition || 'Geral',
          DATA: b.meta.date || 'N/A',
          SALVO_EM: b.savedAt
        }))
      );
    } else {
      setQueryResult([
        {
          INFO: 'Instrução simulada com sucesso.',
          SQL: queryInput,
          STATUS: 'OK - 0 registros afetados'
        }
      ]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 select-none">
      <div className="w-[min(940px,96vw)] max-h-[92vh] flex flex-col bg-[#111713] border border-[#4d6254] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0a0f0c] border-b border-[#29362d]">
          <div className="flex items-center gap-2">
            <span className="text-xl">🗄</span>
            <div>
              <h2 className="text-sm font-black text-white leading-tight">
                Integração Banco de Dados InterBase / Firebird
              </h2>
              <p className="text-[10px] text-[#8aa092]">
                Gerenciador de persistência relacional e sincronização tática
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#153421] text-[#69e094] border border-[#2e6b43]">
              <span className="w-2 h-2 rounded-full bg-[#3ae478] animate-pulse" />
              InterBase Conectado
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white px-2 py-1 text-sm rounded bg-[#1c241e]"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 pt-2 bg-[#0e1410] border-b border-[#253228]">
          {[
            { id: 'status', label: 'Visão Geral & Conexão' },
            { id: 'tables', label: 'Tabelas & Registros' },
            { id: 'sql', label: 'Script DDL/DML InterBase' },
            { id: 'query', label: 'Console SQL' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-[11px] font-bold border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-[#c91f32] text-white bg-[#172019]'
                  : 'border-transparent text-[#7e8f84] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="flex-1 p-4 overflow-y-auto scrollbar-thin space-y-4">
          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Architecture cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-[#141d17] border border-[#2c3d31] rounded-lg p-3">
                  <div className="text-[10px] font-black text-[#899f92] uppercase">
                    1. Camada de Sessão
                  </div>
                  <div className="text-lg font-bold text-white mt-1">IndexedDB / Memória</div>
                  <p className="text-[10px] text-[#91a397] mt-1 leading-relaxed">
                    Preserva escalações, etapas animadas e fotos em tempo real com zero latência.
                  </p>
                </div>

                <div className="bg-[#141d17] border border-[#2c3d31] rounded-lg p-3">
                  <div className="text-[10px] font-black text-[#899f92] uppercase">
                    2. Servidor Integrado
                  </div>
                  <div className="text-lg font-bold text-[#68d790] mt-1">API REST / InterBase</div>
                  <p className="text-[10px] text-[#91a397] mt-1 leading-relaxed">
                    Sincronização persistente nos endpoints <code>/api/interbase/*</code> da
                    aplicação.
                  </p>
                </div>

                <div className="bg-[#141d17] border border-[#2c3d31] rounded-lg p-3">
                  <div className="text-[10px] font-black text-[#899f92] uppercase">
                    3. InterBase / Firebird
                  </div>
                  <div className="text-lg font-bold text-[#71c3ff] mt-1">Geração SQL Nativa</div>
                  <p className="text-[10px] text-[#91a397] mt-1 leading-relaxed">
                    Compatível com IBConsole, ISQL e banco Embarcadero InterBase com transações
                    COMMIT WORK.
                  </p>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="bg-[#0b100d] border border-[#243127] rounded-lg p-3 flex flex-wrap items-center justify-around gap-2 text-center">
                <div>
                  <div className="text-xl font-black text-white">{squad.length}</div>
                  <div className="text-[9px] text-[#819287]">Jogadores no Elenco</div>
                </div>
                <div className="h-8 w-px bg-[#243127]" />
                <div>
                  <div className="text-xl font-black text-[#ff6675]">{savedPlays.length}</div>
                  <div className="text-[9px] text-[#819287]">Jogadas Gravadas</div>
                </div>
                <div className="h-8 w-px bg-[#243127]" />
                <div>
                  <div className="text-xl font-black text-[#71c3ff]">{savedBoards.length}</div>
                  <div className="text-[9px] text-[#819287]">Pranchetas Arquivadas</div>
                </div>
                <div className="h-8 w-px bg-[#243127]" />
                <div>
                  <div className="text-xl font-black text-[#58df8a]">ATIVO</div>
                  <div className="text-[9px] text-[#819287]">Auto-Save InterBase</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  onClick={handleDownloadSQL}
                  className="px-4 py-2 text-xs font-black bg-[#1b6b3b] hover:bg-[#23874b] border border-[#43c776] text-white rounded shadow-md flex items-center gap-2"
                >
                  <span>⬇</span>
                  <span>Baixar Script InterBase (.SQL)</span>
                </button>
                <button
                  onClick={handleDownloadJSON}
                  className="px-4 py-2 text-xs font-black bg-[#1c3a50] hover:bg-[#284e6a] border border-[#3f7ba6] text-[#b3deff] rounded shadow-md flex items-center gap-2"
                >
                  <span>💾</span>
                  <span>Exportar Backup Completo (.JSON)</span>
                </button>
                <button
                  onClick={handleCopySQL}
                  className="px-3 py-2 text-xs font-bold bg-[#1b241e] hover:bg-[#27352c] border border-[#3c4e41] text-[#d4ded8] rounded"
                >
                  {copied ? '✓ Copiado!' : 'Copiar DDL/DML'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'tables' && (
            <div className="space-y-4">
              <div className="border border-[#2d3b31] rounded-lg overflow-hidden bg-[#0d130f]">
                <div className="bg-[#141e17] px-3 py-2 font-black text-xs text-white border-b border-[#2d3b31]">
                  Tabela: TB_JOGADA ({savedPlays.length} registros)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px] text-[#cbd6cf]">
                    <thead className="bg-[#0b100d] text-[#86998c] uppercase text-[8px]">
                      <tr>
                        <th className="p-2">ID</th>
                        <th className="p-2">Nome</th>
                        <th className="p-2">Escopo</th>
                        <th className="p-2">Velocidade</th>
                        <th className="p-2">Etapas</th>
                        <th className="p-2">Atualizado Em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedPlays.map((p, idx) => (
                        <tr key={idx} className="border-t border-[#1b261e] hover:bg-[#152119]">
                          <td className="p-2 font-mono text-[#ff808d]">{idx + 1}</td>
                          <td className="p-2 font-bold text-white">{p.name}</td>
                          <td className="p-2">{p.scope}</td>
                          <td className="p-2">{p.speed || 1200}ms</td>
                          <td className="p-2">{p.frames.length}</td>
                          <td className="p-2 text-[#8aa092]">{p.updated || 'Recentemente'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border border-[#2d3b31] rounded-lg overflow-hidden bg-[#0d130f]">
                <div className="bg-[#141e17] px-3 py-2 font-black text-xs text-white border-b border-[#2d3b31]">
                  Tabela: TB_ELENCO ({squad.length} registros cadastrados)
                </div>
                <div className="overflow-x-auto max-h-48 scrollbar-thin">
                  <table className="w-full text-left text-[10px] text-[#cbd6cf]">
                    <thead className="bg-[#0b100d] text-[#86998c] uppercase text-[8px]">
                      <tr>
                        <th className="p-2">ID</th>
                        <th className="p-2">Nome</th>
                        <th className="p-2">Posição</th>
                        <th className="p-2">Foto URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {squad.map((p, idx) => (
                        <tr key={idx} className="border-t border-[#1b261e] hover:bg-[#152119]">
                          <td className="p-2 font-mono text-[#62d28b]">{idx + 1}</td>
                          <td className="p-2 font-bold text-white">{p.name}</td>
                          <td className="p-2 font-mono">{p.role}</td>
                          <td className="p-2 text-[#7f9085] truncate max-w-[200px]">
                            {p.photo || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#86988d]">
                  Script InterBase / Firebird DDL & DML Gerado:
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopySQL}
                    className="text-[10px] font-bold px-2.5 py-1 bg-[#1a231d] hover:bg-[#253229] border border-[#3b4c40] text-white rounded"
                  >
                    {copied ? '✓ Copiado' : 'Copiar SQL'}
                  </button>
                  <button
                    onClick={handleDownloadSQL}
                    className="text-[10px] font-bold px-2.5 py-1 bg-[#1b6b3b] hover:bg-[#228349] border border-[#42c174] text-white rounded"
                  >
                    Download .SQL
                  </button>
                </div>
              </div>
              <pre className="p-3 bg-[#0a0f0c] border border-[#253228] rounded-lg text-[10px] font-mono text-[#9ed3af] overflow-x-auto max-h-[350px] scrollbar-thin leading-relaxed">
                {sqlContent}
              </pre>
            </div>
          )}

          {activeTab === 'query' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-[#8ba093] mb-1">
                  Digite uma consulta SQL (Ex: SELECT * FROM TB_JOGADA ou SELECT * FROM TB_ELENCO):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    className="flex-1 h-8 px-2 text-[11px] font-mono bg-[#0c120e] text-white border border-[#38483d] rounded outline-none focus:border-[#43c776]"
                  />
                  <button
                    onClick={handleExecuteQuery}
                    className="px-4 h-8 text-[10px] font-black bg-[#1b6b3b] hover:bg-[#23874b] border border-[#43c776] text-white rounded"
                  >
                    Executar SQL
                  </button>
                </div>
              </div>

              {queryResult && (
                <div className="border border-[#28362c] rounded-lg overflow-hidden bg-[#0d130f]">
                  <div className="bg-[#141e17] px-3 py-1.5 text-[9px] font-bold text-[#7fe0a0] border-b border-[#28362c]">
                    Resultado ({queryResult.length} linha(s) retornada(s))
                  </div>
                  <pre className="p-3 text-[10px] font-mono text-[#cbd9d0] max-h-56 overflow-auto scrollbar-thin">
                    {JSON.stringify(queryResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

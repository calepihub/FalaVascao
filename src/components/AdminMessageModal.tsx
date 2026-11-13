import React, { useState } from 'react';
import { AdminMessage } from '../data/auth';

interface AdminMessageModalProps {
  message: AdminMessage | null;
  pendingCount: number;
  onAcknowledge: (messageId: string) => Promise<void>;
}

export const AdminMessageModal: React.FC<AdminMessageModalProps> = ({
  message,
  pendingCount,
  onAcknowledge
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!message) return null;

  const formattedDate = (() => {
    const parsed = Date.parse(message.createdAt);
    if (!Number.isFinite(parsed)) return '';
    return new Date(parsed).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  })();

  const handleOk = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onAcknowledge(message.id);
    } catch {
      setErrorMsg('Não foi possível confirmar a leitura. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-message-modal-title"
      className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="w-[min(480px,95vw)] bg-[#0f1712] border border-[#3a5c44] rounded-2xl shadow-2xl overflow-hidden text-[#e6ece8]">
        {/* Header (no close X button — only single Ok button closes the modal) */}
        <div className="bg-gradient-to-r from-[#18291d] via-[#121e16] to-[#0f1712] px-5 py-4 border-b border-[#25382a] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d62839] to-[#80131e] border border-[#ff6675] flex items-center justify-center text-lg shrink-0 shadow">
              ✉️
            </div>
            <div className="min-w-0">
              <h3
                id="admin-message-modal-title"
                className="text-sm font-black text-white uppercase tracking-wider truncate"
              >
                Mensagem da Administração
              </h3>
              <p className="text-[11px] text-[#92ab9a] truncate">
                Enviada por <b className="text-white">{message.senderName}</b>
                {formattedDate ? ` • ${formattedDate}` : ''}
              </p>
            </div>
          </div>

          {pendingCount > 1 && (
            <span className="px-2 py-0.5 rounded bg-[#1d3524] border border-[#356343] text-[#70f093] text-[10px] font-black shrink-0">
              1 de {pendingCount}
            </span>
          )}
        </div>

        {/* Message Body */}
        <div className="p-5 space-y-3">
          <div className="p-4 rounded-xl bg-[#0a100c] border border-[#243629] text-sm text-white leading-relaxed whitespace-pre-wrap break-words max-h-[52vh] overflow-y-auto">
            {message.message}
          </div>

          {errorMsg && (
            <p className="text-xs font-bold text-[#ff808d]">{errorMsg}</p>
          )}
        </div>

        {/* Single "Ok" Button Footer */}
        <div className="px-5 py-3.5 bg-[#0a100c] border-t border-[#1f2e23] flex justify-end">
          <button
            type="button"
            autoFocus
            disabled={submitting}
            onClick={handleOk}
            className="min-w-[110px] px-6 py-2 bg-[#1b6b3b] hover:bg-[#23874b] text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Confirmando...' : 'Ok'}
          </button>
        </div>
      </div>
    </div>
  );
};

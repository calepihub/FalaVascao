import React, { useEffect, useState } from 'react';
import { AdminMessage } from '../data/auth';

interface AdminMessageModalProps {
  message: AdminMessage | null;
  pendingCount: number;
  onAcknowledge: (messageId: string) => Promise<void>;
  onReply: (
    message: AdminMessage,
    replyText: string,
    alsoAcknowledge: boolean
  ) => Promise<void>;
}

export const AdminMessageModal: React.FC<AdminMessageModalProps> = ({
  message,
  pendingCount,
  onAcknowledge,
  onReply
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [sendingReplyOnly, setSendingReplyOnly] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sentReplyText, setSentReplyText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setReplyText('');
    setSentReplyText(message?.replyText || null);
    setErrorMsg(null);
    setSubmitting(false);
    setSendingReplyOnly(false);
  }, [message?.id, message?.replyText]);

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

  const existingReply = sentReplyText || message.replyText || null;
  const trimmedReply = replyText.trim();

  const handleSendReplyOnly = async () => {
    if (sendingReplyOnly || submitting || existingReply || !trimmedReply) return;
    setSendingReplyOnly(true);
    setErrorMsg(null);
    try {
      await onReply(message, trimmedReply, false);
      setSentReplyText(trimmedReply);
      setReplyText('');
    } catch {
      setErrorMsg('Não foi possível enviar sua resposta. Tente novamente.');
    } finally {
      setSendingReplyOnly(false);
    }
  };

  const handleOk = async () => {
    if (submitting || sendingReplyOnly) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      if (!existingReply && trimmedReply.length > 0) {
        await onReply(message, trimmedReply, true);
      } else {
        await onAcknowledge(message.id);
      }
    } catch {
      setErrorMsg('Não foi possível concluir a confirmação. Tente novamente.');
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
      <div className="w-[min(520px,95vw)] bg-[#0f1712] border border-[#3a5c44] rounded-2xl shadow-2xl overflow-hidden text-[#e6ece8]">
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

        {/* Message Body + Reply Box */}
        <div className="p-5 space-y-4">
          <div className="p-4 rounded-xl bg-[#0a100c] border border-[#243629] text-sm text-white leading-relaxed whitespace-pre-wrap break-words max-h-[34vh] overflow-y-auto">
            {message.message}
          </div>

          {existingReply ? (
            <div className="p-3.5 rounded-xl bg-[#112819] border border-[#2c6b42] space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-black text-[#74f59f]">
                <span>✓ Sua resposta enviada ao Administrador</span>
              </div>
              <p className="text-xs text-white leading-relaxed whitespace-pre-wrap break-words">
                {existingReply}
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-[#0b120d] border border-[#223327] space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="admin-message-reply-input"
                  className="text-[10px] font-black text-[#8cb398] uppercase tracking-wider flex items-center gap-1.5"
                >
                  <span>💬</span>
                  <span>Responder ao Administrador (opcional)</span>
                </label>
                <span className="text-[10px] text-[#7c9284] font-mono">
                  {replyText.length}/1000
                </span>
              </div>

              <textarea
                id="admin-message-reply-input"
                rows={3}
                maxLength={1000}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={submitting || sendingReplyOnly}
                placeholder="Digite sua resposta para o administrador (ou clique apenas em Ok para fechar)..."
                className="w-full p-2.5 text-xs bg-[#070b08] text-white border border-[#2b4031] rounded-lg outline-none focus:border-[#43c776] resize-none leading-relaxed disabled:opacity-60"
              />

              {trimmedReply.length > 0 && (
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <button
                    type="button"
                    disabled={sendingReplyOnly || submitting}
                    onClick={() => setReplyText('')}
                    className="text-[11px] font-bold text-[#8ca394] hover:text-white cursor-pointer"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    disabled={sendingReplyOnly || submitting}
                    onClick={handleSendReplyOnly}
                    className="px-3.5 py-1.5 bg-[#154528] hover:bg-[#1e6138] border border-[#348a54] text-[#8bf7b3] text-[11px] font-black rounded-lg transition cursor-pointer disabled:opacity-50"
                  >
                    {sendingReplyOnly ? 'Enviando resposta...' : 'Enviar Resposta'}
                  </button>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <p className="text-xs font-bold text-[#ff808d]">{errorMsg}</p>
          )}
        </div>

        {/* Single "Ok" Button Footer */}
        <div className="px-5 py-3.5 bg-[#0a100c] border-t border-[#1f2e23] flex items-center justify-between gap-3">
          <span className="text-[10px] text-[#7f9687]">
            {trimmedReply.length > 0 && !existingReply
              ? 'Clicar em Ok também enviará sua resposta.'
              : 'Clique em Ok para confirmar a leitura.'}
          </span>
          <button
            type="button"
            disabled={submitting || sendingReplyOnly}
            onClick={handleOk}
            className="min-w-[110px] px-6 py-2 bg-[#1b6b3b] hover:bg-[#23874b] text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow cursor-pointer disabled:opacity-50 shrink-0"
          >
            {submitting
              ? trimmedReply.length > 0 && !existingReply
                ? 'Enviando...'
                : 'Confirmando...'
              : 'Ok'}
          </button>
        </div>
      </div>
    </div>
  );
};

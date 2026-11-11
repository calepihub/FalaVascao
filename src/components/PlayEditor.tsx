import React, { useState } from 'react';
import { TacticalPlay, PlayFrame } from '../tactics/tacticsLogic';
import { FieldTokenData } from '../data/storage';

interface PlayEditorProps {
  isOpen: boolean;
  onClose: () => void;
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
  hideHeader?: boolean;
}

export const PlayEditor: React.FC<PlayEditorProps> = ({
  isOpen,
  onClose,
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
  onLoadDemoPlay,
  hideHeader = false
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);

  if (!isOpen) return null;

  const frameCount = currentPlay.frames.length;
  const currentStep = frameCount === 0 ? 0 : frameCount === 1 ? 2 : 4;

  const wizardSteps = [
    {
      title: 'Primeiro: o que é uma jogada?',
      text: 'Uma animação é feita com fotografias sucessivas do campo. Aqui chamamos cada fotografia de ETAPA. A ferramenta move as peças automaticamente entre uma etapa e a seguinte.',
      example:
        'Exemplo simples: Etapa 1 = jogador com a bola. Etapa 2 = jogador avançou e a bola foi para outro ponto. Ao reproduzir, a ferramenta cria o movimento entre essas duas posições.',
      action: 'Ver exemplo pronto'
    },
    {
      title: 'Escolha quem vai participar',
      text: 'Escolha o escopo da jogada: Vasco + Adversário, Somente Vasco ou Somente Adversário. A bola é sempre incluída se estiver no campo.',
      action: 'Próximo'
    },
    {
      title: 'Monte a posição INICIAL no campo',
      text: 'Coloque no campo todos os jogadores que participarão. Adicione a bola se houver passe ou condução. Posicione onde a jogada COMEÇA.',
      example: 'Não grave nada enquanto estiver montando a posição inicial.',
      action: 'Entendi'
    },
    {
      title: 'Grave a ETAPA 1',
      text: 'Clique no botão "● Gravar etapa". A prancheta tira uma fotografia invisível das posições atuais.',
      example: 'Depois de gravar, o contador de etapas deve mostrar 1.',
      action: 'Gravar Etapa 1'
    },
    {
      title: 'Mova as peças para o próximo momento',
      text: 'Volte ao campo e arraste apenas as peças que devem se movimentar. O meia avança, o atacante desmarca, a bola vai ao destino.',
      action: 'Entendi'
    },
    {
      title: 'Grave a ETAPA 2',
      text: 'Quando terminar de mover as peças, clique novamente em "● Gravar etapa". Agora temos início e destino!',
      example: 'Etapa 1 → movimento automático → Etapa 2.',
      action: 'Gravar Etapa 2'
    },
    {
      title: 'Quer uma jogada mais longa?',
      text: 'Repita sempre a mesma sequência: MOVA as peças → ADICIONE uma etapa. Não há limite de etapas.',
      action: 'Entendi'
    },
    {
      title: 'Assista antes de salvar',
      text: 'Clique em "▶ Reproduzir". As peças deslizam suavemente entre as etapas gravadas.',
      action: 'Reproduzir'
    },
    {
      title: 'Salve sua jogada',
      text: 'Dê um nome para a jogada e clique em "💾 Salvar". A jogada é gravada automaticamente na prancheta!',
      action: 'Salvar'
    },
    {
      title: 'Pronto!',
      text: 'A jogada salva aparece na lista. Você pode carregar, reproduzir ou excluir a qualquer momento.',
      action: 'Fechar'
    }
  ];

  const handleWizardAction = () => {
    if (wizardStep === 0) {
      setIsTutorialOpen(false);
      onLoadDemoPlay();
      return;
    }
    if (wizardStep === 3) {
      onCaptureFrame();
      setWizardStep((s) => s + 1);
      return;
    }
    if (wizardStep === 5) {
      onCaptureFrame();
      setWizardStep((s) => s + 1);
      return;
    }
    if (wizardStep === 7) {
      setIsTutorialOpen(false);
      onPlayAnimation();
      return;
    }
    if (wizardStep === 8) {
      onSavePlay();
      setWizardStep((s) => s + 1);
      return;
    }
    if (wizardStep === 9) {
      setIsTutorialOpen(false);
      return;
    }
    setWizardStep((s) => Math.min(wizardSteps.length - 1, s + 1));
  };

  return (
    <div className="w-full bg-[#101712] border border-[#354339] rounded-lg p-2 select-none space-y-2 mt-1 shadow-inner">
      {/* Header - only if not hidden by DraggablePopup */}
      {!hideHeader && (
        <div className="flex items-center justify-between pb-1 border-b border-[#243128]">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px]">🎬</span>
            <div>
              <h3 className="text-[10px] font-black text-white leading-tight uppercase tracking-wider">
                Editor de Jogadas
              </h3>
              <p className="text-[7.5px] text-[#86968c] leading-tight">
                Grave etapas e reproduza com animação suave
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? 'Expandir' : 'Recolher'}
              className="w-5 h-5 text-[9px] font-bold bg-[#18211b] hover:bg-[#253229] border border-[#37463b] text-white rounded flex items-center justify-center cursor-pointer"
            >
              {isCollapsed ? '⌃' : '⌄'}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Fechar editor"
              className="w-5 h-5 text-[9px] font-bold bg-[#29171a] hover:bg-[#421d23] border border-[#6b2c34] text-[#ff99a4] rounded flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Collapsed Compact Floating Bar */}
      {isCollapsed && (
        <div className="flex items-center justify-between pt-1 text-[9px]">
          <span className="text-[#86968c] font-bold">
            {frameCount} etapa(s) gravada(s)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onCaptureFrame}
              className="h-6 px-2.5 text-[8.5px] font-black bg-[#9e1b29] hover:bg-[#bf2132] border border-[#ff6b7b] text-white rounded shadow transition flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <span>●</span>
              <span>Gravar Etapa</span>
            </button>
            <button
              type="button"
              onClick={onPlayAnimation}
              disabled={frameCount < 2 || isAnimating}
              className={`h-6 px-2.5 text-[8.5px] font-black rounded border transition flex items-center gap-1 cursor-pointer ${
                frameCount >= 2 && !isAnimating
                  ? 'bg-[#176b3b] hover:bg-[#1f874b] border-[#43c776] text-white'
                  : 'bg-[#15231a] border-[#25392b] text-gray-500 cursor-not-allowed'
              }`}
            >
              <span>▶</span>
              <span>Reproduzir</span>
            </button>
          </div>
        </div>
      )}

      {!isCollapsed && (
        <div className="space-y-1.5 text-[#cbd6cf]">
          {/* Quick Help & Demo buttons */}
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => {
                setWizardStep(0);
                setIsTutorialOpen(true);
              }}
              className="h-6 text-[8px] font-bold bg-[#14291c] hover:bg-[#1d3d29] text-[#71e39a] border border-[#2d5f3e] rounded transition"
            >
              ? Passo a Passo
            </button>
            <button
              type="button"
              onClick={onLoadDemoPlay}
              className="h-6 text-[8px] font-bold bg-[#152532] hover:bg-[#1e3648] text-[#82c6fc] border border-[#2f5573] rounded transition"
            >
              ▶ Exemplo Pronto
            </button>
          </div>

          {/* Form Inputs: Name, Scope, Speed */}
          <div className="space-y-1">
            <div>
              <label className="block text-[7.5px] font-bold text-[#8ba093] mb-0.5">
                NOME DA JOGADA
              </label>
              <input
                type="text"
                value={currentPlay.name}
                onChange={(e) => onUpdatePlay({ ...currentPlay, name: e.target.value })}
                placeholder="Ex.: Saída rápida pela direita"
                className="w-full h-6 px-1.5 text-[9px] font-bold bg-[#172019] text-white border border-[#37453b] rounded outline-none focus:border-[#d62839]"
              />
            </div>

            <div className="grid grid-cols-2 gap-1">
              <div>
                <label className="block text-[7.5px] font-bold text-[#8ba093] mb-0.5">
                  PARTICIPANTES
                </label>
                <select
                  value={currentPlay.scope}
                  onChange={(e) =>
                    onUpdatePlay({
                      ...currentPlay,
                      scope: e.target.value as 'both' | 'vasco' | 'opponent'
                    })
                  }
                  className="w-full h-6 px-1 text-[8.5px] font-bold bg-[#172019] text-white border border-[#37453b] rounded outline-none"
                >
                  <option value="both">Vasco + Adversário</option>
                  <option value="vasco">Somente Vasco</option>
                  <option value="opponent">Somente Adversário</option>
                </select>
              </div>

              <div>
                <label className="block text-[7.5px] font-bold text-[#8ba093] mb-0.5">
                  VELOCIDADE
                </label>
                <select
                  value={currentPlay.speed || 1200}
                  onChange={(e) => onUpdatePlay({ ...currentPlay, speed: Number(e.target.value) })}
                  className="w-full h-6 px-1 text-[8.5px] font-bold bg-[#172019] text-white border border-[#37453b] rounded outline-none"
                >
                  <option value={2000}>Lenta (2.0s)</option>
                  <option value={1200}>Normal (1.2s)</option>
                  <option value={700}>Rápida (0.7s)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 5-Step Flow Indicator */}
          <div className="bg-[#0b100d] border border-[#212b23] rounded p-1">
            <div className="grid grid-cols-5 gap-0.5 text-center text-[7px] font-black">
              {[
                { n: '1', l: 'Posicione' },
                { n: '2', l: 'Grave' },
                { n: '3', l: 'Mova' },
                { n: '4', l: 'Grave' },
                { n: '5', l: 'Play/Salvar' }
              ].map((step, idx) => (
                <div
                  key={idx}
                  className={`py-0.5 rounded border transition truncate ${
                    idx === currentStep
                      ? 'bg-[#8e1724] border-[#ff6675] text-white'
                      : idx < currentStep
                      ? 'bg-[#142e1f] border-[#2d8e53] text-[#7ee3a4]'
                      : 'bg-[#151c17] border-[#222b24] text-[#6b7b71]'
                  }`}
                >
                  {step.n}. {step.l}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons: 2x3 Grid */}
          <div className="grid grid-cols-2 gap-1 pt-0.5">
            <button
              type="button"
              onClick={onNewPlay}
              className="h-7 text-[8.5px] font-bold bg-[#18211b] hover:bg-[#233027] border border-[#37453b] text-[#d4ded8] rounded transition"
            >
              ＋ Nova jogada
            </button>

            <button
              type="button"
              onClick={onCaptureFrame}
              className="h-7 text-[8.5px] font-black bg-[#9e1b29] hover:bg-[#bf2132] border border-[#ff6b7b] text-white rounded shadow transition flex items-center justify-center gap-1 active:scale-95"
            >
              <span>●</span>
              <span>Gravar etapa</span>
            </button>

            <button
              type="button"
              onClick={onPlayAnimation}
              disabled={frameCount < 2 || isAnimating}
              className={`h-7 text-[8.5px] font-black rounded border transition flex items-center justify-center gap-1 ${
                frameCount >= 2 && !isAnimating
                  ? 'bg-[#176b3b] hover:bg-[#1f874b] border-[#43c776] text-white shadow'
                  : 'bg-[#15231a] border-[#25392b] text-gray-500 cursor-not-allowed'
              }`}
            >
              <span>▶</span>
              <span>Reproduzir</span>
            </button>

            <button
              type="button"
              onClick={onStopAnimation}
              disabled={!isAnimating}
              className={`h-7 text-[8.5px] font-black rounded border transition flex items-center justify-center gap-1 ${
                isAnimating
                  ? 'bg-[#7a1b24] hover:bg-[#96222d] border-[#ea5260] text-white animate-pulse'
                  : 'bg-[#1b201c] border-[#2d3730] text-gray-500 cursor-not-allowed'
              }`}
            >
              <span>■</span>
              <span>Parar</span>
            </button>

            <button
              type="button"
              onClick={onResetToStart}
              disabled={frameCount === 0}
              className="h-7 text-[8.5px] font-bold bg-[#18211b] hover:bg-[#233027] border border-[#37453b] text-[#d4ded8] rounded transition"
            >
              ↺ Início (Etapa 1)
            </button>

            <button
              type="button"
              onClick={onSavePlay}
              disabled={frameCount < 2}
              className={`h-7 text-[8.5px] font-black rounded border transition flex items-center justify-center gap-1 ${
                frameCount >= 2
                  ? 'bg-[#1b4363] hover:bg-[#235882] border-[#4da1e6] text-[#bce0ff] shadow'
                  : 'bg-[#14232e] border-[#223746] text-gray-500 cursor-not-allowed'
              }`}
            >
              <span>💾</span>
              <span>Salvar jogada</span>
            </button>
          </div>

          {/* Timeline of Captured Frames */}
          <div className="bg-[#0b100d] border border-[#212b23] rounded p-1.5 max-h-20 overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between text-[7.5px] font-black tracking-wider text-[#93a299] mb-1">
              <span>ETAPAS GRAVADAS ({frameCount})</span>
              {frameCount < 2 && (
                <span className="text-[#e3a032] text-[7px]">Mínimo 2 etapas para rodar</span>
              )}
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {currentPlay.frames.map((frame, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 bg-[#1a231d] border border-[#37463b] rounded px-1.5 py-0.5 text-[8px]"
                >
                  <b className="text-white font-bold">{idx + 1}</b>
                  <span className="text-[#8e9d94] text-[7px]">({frame.positions.length}p)</span>
                  <button
                    type="button"
                    onClick={() => onApplyFrame(frame)}
                    title="Ir para esta etapa no campo"
                    className="text-[#7bd39a] hover:text-white px-0.5 text-[8px]"
                  >
                    ↗
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = currentPlay.frames.filter((_, fIdx) => fIdx !== idx);
                      onUpdatePlay({ ...currentPlay, frames: updated });
                    }}
                    title="Excluir etapa"
                    className="text-[#ff7886] hover:text-white px-0.5 text-[8px]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Saved Plays List */}
          <div className="bg-[#0b100d] border border-[#212b23] rounded p-1.5 max-h-24 overflow-y-auto scrollbar-thin">
            <div className="text-[7.5px] font-black tracking-wider text-[#93a299] mb-1">
              JOGADAS SALVAS
            </div>

            {savedPlays.length === 0 ? (
              <span className="text-[8px] text-[#6b7b71]">Nenhuma jogada salva ainda.</span>
            ) : (
              <div className="space-y-1">
                {savedPlays.map((p) => (
                  <div
                    key={p.id || p.name}
                    className="flex items-center justify-between bg-[#151c17] hover:bg-[#1d2720] border border-[#28352b] rounded px-1.5 py-0.5 text-[8px]"
                  >
                    <div className="flex items-center gap-1 truncate pr-1">
                      <span className="font-bold text-white truncate max-w-[130px]">{p.name}</span>
                      {p.isDemo && (
                        <span className="text-[6.5px] font-black bg-[#1b6b3b] text-white px-0.5 rounded">
                          EXEMPLO
                        </span>
                      )}
                      <span className="text-[7px] text-[#86958c]">({p.frames.length}e)</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onLoadSavedPlay(p)}
                        className="px-1.5 py-0.5 text-[7.5px] font-bold bg-[#1d2920] hover:bg-[#283b2d] border border-[#3e5343] text-[#a4d8b2] rounded"
                      >
                        Carregar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onLoadSavedPlay(p);
                          setTimeout(onPlayAnimation, 120);
                        }}
                        className="px-1.5 py-0.5 text-[7.5px] font-black bg-[#185e33] hover:bg-[#227e46] border border-[#37b063] text-white rounded"
                      >
                        ▶
                      </button>
                      {p.id && (
                        <button
                          type="button"
                          onClick={() => onDeleteSavedPlay(p.id!)}
                          className="px-1 py-0.5 text-[7.5px] text-[#ff7886] hover:bg-[#411b21] rounded"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step by Step Wizard Tutorial Modal (rendered as modal only when user clicks '? Passo a Passo') */}
      {isTutorialOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-[min(680px,94vw)] bg-[#121814] border border-[#48594e] rounded-xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#29362d] pb-2">
              <div>
                <h3 className="text-base font-black text-white">
                  Assistente para Criar uma Jogada Tática
                </h3>
                <p className="text-[10px] text-[#8fa095]">Aprenda em passos simples e práticos</p>
              </div>
              <button
                type="button"
                onClick={() => setIsTutorialOpen(false)}
                className="text-gray-400 hover:text-white text-base"
              >
                ✕
              </button>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 bg-[#232c25] rounded-full overflow-hidden my-3">
              <div
                className="h-full bg-[#d62839] transition-all duration-300"
                style={{
                  width: `${((wizardStep + 1) / wizardSteps.length) * 100}%`
                }}
              />
            </div>

            {/* Step Content */}
            <div className="space-y-3">
              <span className="text-[10px] font-black text-[#ff7684]">
                PASSO {wizardStep + 1} DE {wizardSteps.length}
              </span>
              <h4 className="text-lg font-bold text-white">{wizardSteps[wizardStep].title}</h4>
              <p className="text-[13px] text-[#cbd6cf] leading-relaxed">
                {wizardSteps[wizardStep].text}
              </p>

              {wizardSteps[wizardStep].example && (
                <div className="bg-[#0b100d] border border-[#303c34] rounded-lg p-3 text-[12px] text-[#9db0a4]">
                  💡 <b>Dica:</b> {wizardSteps[wizardStep].example}
                </div>
              )}
            </div>

            {/* Wizard Nav Actions */}
            <div className="flex items-center justify-between border-t border-[#29362d] pt-4 mt-5">
              <button
                type="button"
                onClick={() => setWizardStep((s) => Math.max(0, s - 1))}
                disabled={wizardStep === 0}
                className="px-3 py-1.5 text-xs font-bold bg-[#1b231d] border border-[#3c4a40] text-gray-300 rounded disabled:opacity-30"
              >
                ← Voltar
              </button>

              <button
                type="button"
                onClick={handleWizardAction}
                className="px-4 py-1.5 text-xs font-black bg-[#1b6b3b] hover:bg-[#248a4d] border border-[#43c776] text-white rounded shadow-md"
              >
                {wizardSteps[wizardStep].action}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (wizardStep >= wizardSteps.length - 1) setIsTutorialOpen(false);
                  else setWizardStep((s) => s + 1);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-[#1b231d] border border-[#3c4a40] text-gray-300 rounded"
              >
                {wizardStep === wizardSteps.length - 1 ? 'Concluir' : 'Próximo →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

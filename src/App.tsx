import React, { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { Pitch } from './components/Pitch';
import { RosterPanel } from './components/RosterPanel';
import { OpponentPanel } from './components/OpponentPanel';
import { ExtrasPanel } from './components/ExtrasPanel';
import { DrawingCanvasRef, DrawingTool } from './components/DrawingCanvas';
import { INITIAL_SQUAD, SquadPlayer, OPPONENT_CLUBS, TACTICAL_FORMATIONS } from './data/squad';
import { storage, FieldTokenData, LineupSnapshot, SavedBoard } from './data/storage';
import {
  TacticalPlay,
  PlayFrame,
  BoardMeta,
  getClubGradient,
  interpolateMultiFrames
} from './tactics/tacticsLogic';

export default function App() {
  // State
  const [squad, setSquad] = useState<SquadPlayer[]>(INITIAL_SQUAD);
  const [tokens, setTokens] = useState<FieldTokenData[]>([]);
  const [selectedClub, setSelectedClub] = useState<string>('');
  const [currentTool, setCurrentTool] = useState<DrawingTool>('move');
  const [drawingColor, setDrawingColor] = useState<string>('#e32636');
  const [lineWidth, setLineWidth] = useState<number>(5);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Prancheta pronta. Adicione jogadores ou selecione o adversário.'
  );

  // Panels
  const [isPlayEditorOpen, setIsPlayEditorOpen] = useState(false);
  const [isExtrasOpen, setIsExtrasOpen] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  // Polygon drawing state
  const [isPolygonActive, setIsPolygonActive] = useState(false);
  const [polygonPointsCount, setPolygonPointsCount] = useState(0);

  // Animation & Plays
  const [currentPlay, setCurrentPlay] = useState<TacticalPlay>({
    name: '',
    scope: 'both',
    speed: 1200,
    frames: []
  });
  const [savedPlays, setSavedPlays] = useState<TacticalPlay[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoopActive, setIsLoopActive] = useState(false);
  const [showTrails, setShowTrails] = useState(false);

  // Tactical Board & Library
  const [boardMeta, setBoardMeta] = useState<BoardMeta>({
    title: '',
    competition: '',
    date: new Date().toISOString().slice(0, 10),
    notes: ''
  });
  const [savedBoards, setSavedBoards] = useState<SavedBoard[]>([]);

  // Selection & History
  const [selectedTokenIds, setSelectedTokenIds] = useState<Set<string>>(new Set());
  const historyStackRef = useRef<FieldTokenData[][]>([]);
  const redoStackRef = useRef<FieldTokenData[][]>([]);

  // Custom ball SVG/image upload support (as user requested: "depois passo o vetor da bola")
  const [customBallSvg, setCustomBallSvg] = useState<string | undefined>(undefined);
  const ballFileInputRef = useRef<HTMLInputElement | null>(null);

  // Canvas ref
  const drawingCanvasRef = useRef<DrawingCanvasRef | null>(null);
  const animationCancelRef = useRef<boolean>(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clubGradientStyle = getClubGradient(
    selectedClub && OPPONENT_CLUBS[selectedClub] ? OPPONENT_CLUBS[selectedClub] : ['#39433d']
  );

  // 1. Initial Load & Setup: automatic boot with silent database restore
  useEffect(() => {
    async function init() {
      // Load stored photos from IndexedDB
      await storage.loadPhotoCache();
      setSquad([...INITIAL_SQUAD]);

      // Automatically restore last lineup if available, or ready with ball
      const prev = await storage.loadLastLineup();
      if (prev && (prev.players?.length || prev.opponents?.length || prev.ball)) {
        setSelectedClub(prev.opponentClub || '');
        const restoredTokens: FieldTokenData[] = [];

        (prev.players || []).forEach((p) => {
          const full = INITIAL_SQUAD.find((s) => s.name === p.name);
          restoredTokens.push({
            id: p.id || `v_${p.name}_${Date.now()}`,
            kind: 'vasco',
            name: p.name,
            role: p.role,
            photo: storage.getPhoto(p.name, full?.photo || p.photo),
            x: p.x,
            y: p.y,
            locked: p.locked
          });
        });

        (prev.opponents || []).forEach((o) => {
          restoredTokens.push({
            id: o.id || `opp_${o.number}_${Date.now()}`,
            kind: 'opp',
            num: o.number,
            x: o.x,
            y: o.y,
            locked: o.locked
          });
        });

        if (prev.ball) {
          restoredTokens.push({
            id: prev.ball.id || 'bola',
            kind: 'ball',
            x: prev.ball.x,
            y: prev.ball.y
          });
        }

        setTokens(restoredTokens);

        if (prev.drawing) {
          setTimeout(() => {
            drawingCanvasRef.current?.loadFromDataURL(prev.drawing);
          }, 100);
        }
        setStatusMessage('Escalação carregada automaticamente.');
      } else {
        // Ready immediately with ball centered on the pitch
        setTokens([{ id: 'bola', kind: 'ball', x: 0.5, y: 0.5 }]);
        setStatusMessage('Prancheta pronta. Adicione jogadores ou selecione o adversário.');
      }

      // Load saved plays
      const plays = await storage.getAllPlays();
      setSavedPlays(plays);

      // Load saved boards
      const boards = await storage.getAllBoards();
      setSavedBoards(boards);
    }
    init();
  }, []);

  // Save history state
  const pushHistory = useCallback(
    (newTokens: FieldTokenData[]) => {
      historyStackRef.current.push(tokens);
      if (historyStackRef.current.length > 30) historyStackRef.current.shift();
      redoStackRef.current = [];
    },
    [tokens]
  );

  // Auto-save lineup silently to IndexedDB & Server
  const queueAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      const vascoPlayers = tokens
        .filter((t) => t.kind === 'vasco')
        .map((t) => ({
          id: t.id,
          name: t.name || '',
          role: t.role || '',
          photo: t.photo,
          x: t.x,
          y: t.y,
          locked: t.locked
        }));

      const opponents = tokens
        .filter((t) => t.kind === 'opp')
        .map((t) => ({
          id: t.id,
          number: t.num || '',
          x: t.x,
          y: t.y,
          locked: t.locked
        }));

      const ballToken = tokens.find((t) => t.kind === 'ball');

      const snapshot: LineupSnapshot = {
        version: 50,
        savedAt: new Date().toISOString(),
        opponentClub: selectedClub,
        players: vascoPlayers,
        opponents,
        ball: ballToken ? { id: ballToken.id, x: ballToken.x, y: ballToken.y } : null,
        drawing: drawingCanvasRef.current?.toDataURL() || ''
      };

      await storage.saveLineup(snapshot);
    }, 500);
  }, [selectedClub, tokens]);

  // Update tokens with auto-save trigger
  const handleTokensChange = useCallback(
    (newTokens: FieldTokenData[], recordHistory = true) => {
      if (recordHistory) pushHistory(tokens);
      setTokens(newTokens);
      queueAutoSave();
    },
    [pushHistory, queueAutoSave, tokens]
  );

  // Add Vasco player to field
  const handleAddPlayer = (player: SquadPlayer) => {
    // Check if player is already on the field -> highlight instead of duplicating
    const existing = tokens.find((t) => t.kind === 'vasco' && t.name === player.name);
    if (existing) {
      window.dispatchEvent(new CustomEvent('highlight-token', { detail: { id: existing.id } }));
      setStatusMessage(`${player.name} já está posicionado no campo.`);
      return;
    }

    const newToken: FieldTokenData = {
      id: `v_${player.name.replace(/\s+/g, '_')}_${Date.now()}`,
      kind: 'vasco',
      name: player.name,
      role: player.role,
      photo: storage.getPhoto(player.name, player.photo),
      x: 0.25,
      y: 0.5
    };

    handleTokensChange([...tokens, newToken]);
    setStatusMessage(`${player.name} adicionado ao campo.`);
  };

  // Add Opponent player to field
  const handleAddOpponent = (num: number) => {
    const existing = tokens.find((t) => t.kind === 'opp' && Number(t.num) === num);
    if (existing) {
      window.dispatchEvent(new CustomEvent('highlight-token', { detail: { id: existing.id } }));
      setStatusMessage(`Adversário #${num} já está posicionado no campo.`);
      return;
    }

    const newToken: FieldTokenData = {
      id: `opp_${num}_${Date.now()}`,
      kind: 'opp',
      num,
      x: 0.72,
      y: 0.5
    };

    handleTokensChange([...tokens, newToken]);
    setStatusMessage(`Adversário #${num} adicionado ao campo.`);
  };

  // Add or center ball
  const handleAddBall = () => {
    const filtered = tokens.filter((t) => t.kind !== 'ball');
    const ballToken: FieldTokenData = {
      id: 'bola',
      kind: 'ball',
      x: 0.5,
      y: 0.5
    };
    handleTokensChange([...filtered, ballToken]);
    setStatusMessage('Bola posicionada no centro do campo.');
  };

  // Apply quick tactical formation
  const handleApplyFormation = (formationKey: string) => {
    const formation = TACTICAL_FORMATIONS[formationKey];
    if (!formation) return;

    // Pick 11 Vasco players matching roles
    const usedNames = new Set<string>();
    const newVascoTokens: FieldTokenData[] = [];

    formation.positions.forEach((pos) => {
      const match = squad.find(
        (p) => !usedNames.has(p.name) && (p.role === pos.role || pos.role.includes(p.role))
      );
      const chosen = match || squad.find((p) => !usedNames.has(p.name)) || squad[0];
      usedNames.add(chosen.name);

      newVascoTokens.push({
        id: `v_${chosen.name.replace(/\s+/g, '_')}_${Date.now()}_${pos.label}`,
        kind: 'vasco',
        name: chosen.name,
        role: chosen.role,
        photo: storage.getPhoto(chosen.name, chosen.photo),
        x: pos.x / 100,
        y: pos.y / 100
      });
    });

    // Retain opponent tokens and ball
    const nonVasco = tokens.filter((t) => t.kind !== 'vasco');
    handleTokensChange([...nonVasco, ...newVascoTokens]);
    setStatusMessage(`Formação ${formation.name} aplicada com 11 jogadores do Vasco.`);
  };

  // Tool change
  const handleSelectTool = (tool: DrawingTool) => {
    if (currentTool === 'polygon' && tool !== 'polygon') {
      drawingCanvasRef.current?.cancelPolygon();
    }
    setCurrentTool(tool);

    const hints: Record<DrawingTool, string> = {
      move: 'Arraste jogadores, adversários ou bola livremente.',
      free: 'Desenho livre: clique e arraste no campo para desenhar.',
      arrow: 'Seta tática: arraste do ponto de origem até o destino.',
      line: 'Linha reta: arraste para criar uma demarcação de passe ou linha de defesa.',
      zone: 'Área: arraste entre dois pontos para demarcar uma zona retangular.',
      circle: 'Círculo: clique e arraste do centro para abrir uma zona circular de pressão.',
      polygon: 'Polígono: clique em cada vértice no campo e depois em "✓ Fechar área".'
    };
    setStatusMessage(hints[tool] || 'Selecione uma ação.');
  };

  // Handle Fullscreen
  const handleToggleFullscreen = async () => {
    const pitchwrap = document.getElementById('pitchwrap');
    if (!pitchwrap) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsPresentationMode(false);
      } else {
        await pitchwrap.requestFullscreen();
      }
    } catch {
      setStatusMessage('Tela cheia não suportada neste navegador.');
    }
  };

  // Frame Capture for Plays
  const handleCaptureFrame = () => {
    const relevantTokens = tokens.filter((t) => {
      if (t.kind === 'ball') return true;
      if (currentPlay.scope === 'vasco') return t.kind === 'vasco';
      if (currentPlay.scope === 'opponent') return t.kind === 'opp';
      return true;
    });

    if (relevantTokens.length === 0) {
      alert('Coloque no campo os jogadores que participarão desta etapa.');
      return;
    }

    const positions = relevantTokens.map((t) => ({
      id: t.id,
      x: t.x,
      y: t.y
    }));

    const newFrame: PlayFrame = { positions };
    const updatedFrames = [...currentPlay.frames, newFrame];
    setCurrentPlay({ ...currentPlay, frames: updatedFrames });
    setStatusMessage(
      `Etapa ${updatedFrames.length} gravada! Agora mova as peças no campo e grave a próxima etapa.`
    );
  };

  // Apply frame position to field
  const handleApplyFrame = (frame: PlayFrame) => {
    const posMap = new Map(frame.positions.map((p) => [p.id, p]));
    const updated = tokens.map((t) => {
      const target = posMap.get(t.id);
      if (target) {
        return { ...t, x: target.x, y: target.y };
      }
      return t;
    });
    handleTokensChange(updated, false);
  };

  // Replay Animation
  const handlePlayAnimation = async () => {
    if (currentPlay.frames.length < 2) {
      alert('A jogada precisa ter pelo menos 2 etapas gravadas.');
      return;
    }

    setIsAnimating(true);
    animationCancelRef.current = false;
    handleApplyFrame(currentPlay.frames[0]);

    const speed = currentPlay.speed || 1200;
    const frames = currentPlay.frames;
    const totalDuration = (frames.length - 1) * speed;

    await new Promise<void>((resolve) => {
      const startTime = performance.now();

      const step = (now: number) => {
        if (animationCancelRef.current) {
          resolve();
          return;
        }

        const elapsed = now - startTime;
        const globalProgress = Math.min(1, elapsed / Math.max(1, totalDuration));
        const interpolatedPoints = interpolateMultiFrames(frames, globalProgress);
        const posMap = new Map(interpolatedPoints.map((p) => [p.id, p]));

        setTokens((prev) =>
          prev.map((t) => {
            const pt = posMap.get(t.id);
            return pt ? { ...t, x: pt.x, y: pt.y } : t;
          })
        );

        if (globalProgress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(step);
    });

    setIsAnimating(false);
    setStatusMessage(
      animationCancelRef.current ? 'Animação interrompida.' : 'Reprodução concluída com sucesso.'
    );

    if (isLoopActive && !animationCancelRef.current) {
      setTimeout(handlePlayAnimation, 300);
    }
  };

  const handleStopAnimation = () => {
    animationCancelRef.current = true;
    setIsAnimating(false);
  };

  const handleResetToStart = () => {
    handleStopAnimation();
    if (currentPlay.frames.length > 0) {
      handleApplyFrame(currentPlay.frames[0]);
    }
  };

  // Save Play to DB
  const handleSavePlay = async () => {
    if (!currentPlay.name.trim()) {
      const autoName = `Jogada ${new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      })}`;
      currentPlay.name = autoName;
    }
    if (currentPlay.frames.length < 2) {
      alert('Grave pelo menos 2 etapas antes de salvar.');
      return;
    }

    const id = await storage.savePlay(currentPlay);
    setCurrentPlay({ ...currentPlay, id });
    const all = await storage.getAllPlays();
    setSavedPlays(all);
    setStatusMessage(`Jogada "${currentPlay.name}" salva com sucesso no banco de dados.`);
  };

  // Load Saved Play
  const handleLoadSavedPlay = (play: TacticalPlay) => {
    handleStopAnimation();
    setCurrentPlay({ ...play });
    if (play.frames.length > 0) {
      handleApplyFrame(play.frames[0]);
    }
    setStatusMessage(`Jogada "${play.name}" carregada no campo.`);
  };

  // Load Demo Play
  const handleLoadDemoPlay = () => {
    handleStopAnimation();
    // Prepare demo pieces on field
    const demo1 = squad.find((p) => p.name === 'Tchê Tchê') || squad[15];
    const demo2 = squad.find((p) => p.name === 'Rojas') || squad[22];
    const demo3 = squad.find((p) => p.name === 'Nuno Moreira') || squad[26];

    const demoTokens: FieldTokenData[] = [
      {
        id: 'demo_v_0',
        kind: 'vasco',
        name: demo1.name,
        role: demo1.role,
        photo: storage.getPhoto(demo1.name, demo1.photo),
        x: 0.26,
        y: 0.57
      },
      {
        id: 'demo_v_1',
        kind: 'vasco',
        name: demo2.name,
        role: demo2.role,
        photo: storage.getPhoto(demo2.name, demo2.photo),
        x: 0.39,
        y: 0.48
      },
      {
        id: 'demo_v_2',
        kind: 'vasco',
        name: demo3.name,
        role: demo3.role,
        photo: storage.getPhoto(demo3.name, demo3.photo),
        x: 0.5,
        y: 0.38
      },
      { id: 'demo_a_1', kind: 'opp', num: 1, x: 0.58, y: 0.39 },
      { id: 'demo_a_2', kind: 'opp', num: 2, x: 0.61, y: 0.55 },
      { id: 'bola', kind: 'ball', x: 0.35, y: 0.52 }
    ];

    handleTokensChange(demoTokens);
    const demoPlay = storage.createDefaultDemoPlay();
    setCurrentPlay(demoPlay);
    setIsPlayEditorOpen(true);
    setStatusMessage('Exemplo carregado: clique no botão ▶ Reproduzir para assistir.');
  };

  // Save Named Board
  const handleSaveBoard = async () => {
    if (!boardMeta.title.trim()) {
      alert('Informe um título para a prancheta.');
      return;
    }

    const newBoard: SavedBoard = {
      meta: { ...boardMeta },
      state: {
        opponentClub: selectedClub,
        pieces: tokens,
        drawing: drawingCanvasRef.current?.toDataURL()
      },
      savedAt: new Date().toISOString()
    };

    await storage.saveNamedBoard(newBoard);
    const all = await storage.getAllBoards();
    setSavedBoards(all);
    setStatusMessage(`Prancheta "${boardMeta.title}" arquivada com sucesso.`);
  };

  // Load Named Board
  const handleLoadBoard = (board: SavedBoard) => {
    setBoardMeta({ ...board.meta });
    setSelectedClub(board.state.opponentClub || '');
    handleTokensChange(board.state.pieces || []);

    if (board.state.drawing) {
      setTimeout(() => {
        drawingCanvasRef.current?.loadFromDataURL(board.state.drawing || '');
      }, 100);
    }
    setStatusMessage(`Prancheta "${board.meta.title}" aberta.`);
  };

  // Delete Board
  const handleDeleteBoard = async (id: number | string) => {
    if (!confirm('Excluir esta prancheta?')) return;
    await storage.deleteBoard(id);
    const all = await storage.getAllBoards();
    setSavedBoards(all);
  };

  // Alignments & Distribute
  const handleAlignSelected = (type: 'h' | 'v') => {
    if (selectedTokenIds.size < 2) {
      alert('Selecione pelo menos 2 jogadores (Ctrl+clique em cada um) para alinhar.');
      return;
    }

    const selectedList = tokens.filter((t) => selectedTokenIds.has(t.id));
    const avg =
      selectedList.reduce((acc, t) => acc + (type === 'h' ? t.y : t.x), 0) / selectedList.length;

    const updated = tokens.map((t) => {
      if (selectedTokenIds.has(t.id)) {
        return type === 'h' ? { ...t, y: avg } : { ...t, x: avg };
      }
      return t;
    });

    handleTokensChange(updated);
    setStatusMessage(`Peças alinhadas na ${type === 'h' ? 'horizontal' : 'vertical'}.`);
  };

  const handleDistributeSelected = () => {
    if (selectedTokenIds.size < 3) {
      alert('Selecione pelo menos 3 jogadores para distribuir.');
      return;
    }

    const selectedList = tokens
      .filter((t) => selectedTokenIds.has(t.id))
      .sort((a, b) => a.x - b.x);

    const minX = selectedList[0].x;
    const maxX = selectedList[selectedList.length - 1].x;
    const step = (maxX - minX) / (selectedList.length - 1);

    const updatedMap = new Map<string, number>();
    selectedList.forEach((t, i) => updatedMap.set(t.id, minX + i * step));

    const updated = tokens.map((t) => {
      if (updatedMap.has(t.id)) {
        return { ...t, x: updatedMap.get(t.id)! };
      }
      return t;
    });

    handleTokensChange(updated);
    setStatusMessage('Peças distribuídas uniformemente.');
  };

  const handleToggleLockSelected = () => {
    if (selectedTokenIds.size === 0) {
      alert('Selecione um jogador (Ctrl+clique) para bloquear ou desbloquear a posição.');
      return;
    }

    const updated = tokens.map((t) => {
      if (selectedTokenIds.has(t.id)) {
        return { ...t, locked: !t.locked };
      }
      return t;
    });
    handleTokensChange(updated);
  };

  // Export High-Res Pitch PNG
  const handleExportPNG = async () => {
    const pitchwrap = document.getElementById('pitchwrap');
    if (!pitchwrap) return;

    try {
      setStatusMessage('Gerando imagem em alta resolução...');
      const canvas = await html2canvas(pitchwrap, {
        backgroundColor: '#080c09',
        scale: 2,
        useCORS: true
      });
      const link = document.createElement('a');
      link.download = `prancheta_vascao_${(boardMeta.title || 'tatica').replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setStatusMessage('Imagem da prancheta exportada com sucesso!');
    } catch {
      alert('Não foi possível exportar a imagem.');
    }
  };

  // Custom ball upload handler (honoring: "depois passo o vetor da bola")
  const handleBallFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCustomBallSvg(reader.result as string);
      setStatusMessage('Novo vetor da bola aplicado com sucesso!');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const usedOpponentNumbers = new Set(
    tokens.filter((t) => t.kind === 'opp').map((t) => Number(t.num))
  );

  return (
    <div
      className={`w-screen h-screen overflow-hidden bg-[#080c09] text-[#f4f4f4] flex flex-col font-sans ${
        isPresentationMode ? 'p-0' : 'p-2'
      }`}
    >
      {/* Hidden file input for custom vector ball */}
      <input
        ref={ballFileInputRef}
        type="file"
        accept=".svg,image/svg+xml,image/png,image/webp"
        className="hidden"
        onChange={handleBallFileChange}
      />

      {/* Main Workspace Layout */}
      <main
        className={`flex-1 flex gap-2 min-h-0 w-full overflow-hidden ${
          isPresentationMode ? 'p-0' : ''
        }`}
      >
        {/* Left: Vasco Squad Panel */}
        {!isPresentationMode && (
          <RosterPanel
            squad={squad}
            onAddPlayer={handleAddPlayer}
            onTogglePlayEditor={() => setIsPlayEditorOpen(!isPlayEditorOpen)}
            onToggleExtras={() => setIsExtrasOpen(!isExtrasOpen)}
            isPlayEditorOpen={isPlayEditorOpen}
            isExtrasOpen={isExtrasOpen}
            onStatusMessage={setStatusMessage}
            currentPlay={currentPlay}
            onUpdatePlay={setCurrentPlay}
            onCaptureFrame={handleCaptureFrame}
            onApplyFrame={handleApplyFrame}
            onPlayAnimation={handlePlayAnimation}
            onStopAnimation={handleStopAnimation}
            onResetToStart={handleResetToStart}
            onSavePlay={handleSavePlay}
            onNewPlay={() => {
              handleStopAnimation();
              setCurrentPlay({ name: '', scope: 'both', speed: 1200, frames: [] });
              setStatusMessage('Nova jogada iniciada. Posicione as peças e adicione a etapa 1.');
            }}
            savedPlays={savedPlays}
            onLoadSavedPlay={handleLoadSavedPlay}
            onDeleteSavedPlay={async (id) => {
              if (!confirm('Excluir esta jogada salva?')) return;
              await storage.deletePlay(id);
              const all = await storage.getAllPlays();
              setSavedPlays(all);
            }}
            isAnimating={isAnimating}
            fieldTokens={tokens}
            onLoadDemoPlay={handleLoadDemoPlay}
          />
        )}

        {/* Center: Tactical Pitch & Extras Overlay */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#101612] border border-[#29362d] rounded-lg p-2 overflow-hidden relative">
          {/* Pitch & Canvas */}
          <Pitch
            tokens={tokens}
            onTokensChange={(newTokens) => handleTokensChange(newTokens)}
            tool={currentTool}
            drawingColor={drawingColor}
            lineWidth={lineWidth}
            drawingCanvasRef={drawingCanvasRef}
            onPolygonStateChange={(active, count) => {
              setIsPolygonActive(active);
              setPolygonPointsCount(count);
            }}
            onDrawingChange={queueAutoSave}
            showTrails={showTrails}
            selectedTokenIds={selectedTokenIds}
            onSelectToken={(id, multi) => {
              if (!id) {
                setSelectedTokenIds(new Set());
                return;
              }
              const updated = new Set(multi ? selectedTokenIds : []);
              if (updated.has(id)) updated.delete(id);
              else updated.add(id);
              setSelectedTokenIds(updated);
            }}
            onStatusMessage={setStatusMessage}
            opponentClubStyle={clubGradientStyle}
            customBallSvg={customBallSvg}
            isAnimating={isAnimating}
          />

          {/* Status Bar: clean and simple, no technical database tags */}
          {!isPresentationMode && (
            <div className="h-6 mt-1.5 px-2.5 bg-[#0c120e] rounded border border-[#222c25] flex items-center justify-between text-[9px] text-[#8ea095] shrink-0">
              <span className="truncate">{statusMessage}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[8px] text-[#6d8274] font-semibold">Salvamento automático ativo</span>
              </div>
            </div>
          )}

          {/* Collapsible Extras Panel inside Center/Left */}
          {isExtrasOpen && (
            <div className="absolute top-3 left-3 z-30 w-80 max-h-[85vh] overflow-y-auto bg-[#0d130ff2] border border-[#3c4e42] rounded-xl p-3 shadow-2xl backdrop-blur scrollbar-thin">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#29362d]">
                <span className="text-[10px] font-black text-white">⚙ RECURSOS AVANÇADOS</span>
                <button
                  onClick={() => setIsExtrasOpen(false)}
                  className="text-gray-400 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              </div>
              <ExtrasPanel
                isOpen={isExtrasOpen}
                onClose={() => setIsExtrasOpen(false)}
                meta={boardMeta}
                onMetaChange={setBoardMeta}
                onSaveBoard={handleSaveBoard}
                savedBoards={savedBoards}
                onLoadBoard={handleLoadBoard}
                onDeleteBoard={handleDeleteBoard}
                onUndoAction={() => {
                  if (!historyStackRef.current.length) return;
                  const prev = historyStackRef.current.pop()!;
                  redoStackRef.current.push(tokens);
                  setTokens(prev);
                }}
                onRedoAction={() => {
                  if (!redoStackRef.current.length) return;
                  const next = redoStackRef.current.pop()!;
                  historyStackRef.current.push(tokens);
                  setTokens(next);
                }}
                onToggleLockSelected={handleToggleLockSelected}
                onAlignSelected={handleAlignSelected}
                onDistributeSelected={handleDistributeSelected}
                isLoopActive={isLoopActive}
                onToggleLoop={() => setIsLoopActive(!isLoopActive)}
                showTrails={showTrails}
                onToggleTrails={() => setShowTrails(!showTrails)}
                onDuplicateFrame={() => {
                  if (!currentPlay.frames.length) return;
                  const last = currentPlay.frames[currentPlay.frames.length - 1];
                  setCurrentPlay({
                    ...currentPlay,
                    frames: [...currentPlay.frames, JSON.parse(JSON.stringify(last))]
                  });
                }}
                onPresentationMode={() => setIsPresentationMode(true)}
                onExportPNG={handleExportPNG}
                tokens={tokens}
                selectedClub={selectedClub}
                frameCount={currentPlay.frames.length}
              />
            </div>
          )}
        </section>

        {/* Right: Opponent, Controls & Tools Panel */}
        {!isPresentationMode && (
          <OpponentPanel
            selectedClub={selectedClub}
            onSelectClub={(club) => {
              setSelectedClub(club);
              setStatusMessage(
                club ? `Adversário definido: ${club}. Peças atualizadas.` : 'Selecione o clube.'
              );
              queueAutoSave();
            }}
            clubGradientStyle={clubGradientStyle}
            usedOpponentNumbers={usedOpponentNumbers}
            onAddOpponent={handleAddOpponent}
            currentTool={currentTool}
            onSelectTool={handleSelectTool}
            currentColor={drawingColor}
            onSelectColor={setDrawingColor}
            lineWidth={lineWidth}
            onLineWidthChange={setLineWidth}
            onClearPlayers={() => {
              handleTokensChange([]);
              setStatusMessage('Todas as peças foram removidas do campo.');
            }}
            onToggleFullscreen={handleToggleFullscreen}
            onUndoDraw={() => drawingCanvasRef.current?.undo()}
            onClearDraw={() => drawingCanvasRef.current?.clear()}
            onAddBall={handleAddBall}
            isPolygonActive={isPolygonActive}
            polygonPointsCount={polygonPointsCount}
            onClosePolygon={() => drawingCanvasRef.current?.closePolygon()}
            onApplyFormation={handleApplyFormation}
          />
        )}
      </main>
    </div>
  );
}

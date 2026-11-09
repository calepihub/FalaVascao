import React, { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { Pitch } from './components/Pitch';
import { RosterPanel } from './components/RosterPanel';
import { OpponentPanel } from './components/OpponentPanel';
import { ExtrasPanel } from './components/ExtrasPanel';
import { PortalView } from './components/Portal/PortalView';
import { DrawingCanvasRef, DrawingTool } from './components/DrawingCanvas';
import { INITIAL_SQUAD, SquadPlayer, OPPONENT_CLUBS, TACTICAL_FORMATIONS } from './data/squad';
import { storage, FieldTokenData, LineupSnapshot, SavedBoard, CommunityLineup } from './data/storage';
import { AppUser, SiteSettings, authService, OWNER_EMAIL } from './data/auth';
import { AdminPanelModal } from './components/AdminPanelModal';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import {
  TacticalPlay,
  PlayFrame,
  BoardMeta,
  getClubGradient,
  interpolateMultiFrames
} from './tactics/tacticsLogic';

export default function App() {
  // Navigation & View
  const [currentView, setCurrentView] = useState<'portal' | 'tactics'>('portal');

  // Auth & Admin state
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => authService.getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    muralVisible: true,
    muralPublicPosting: true,
    tacticsVisible: true,
    advancedToolsVisible: true,
    liveStreamsVisible: true,
    kickBannerVisible: true
  });
  const [isCapturingMuralPhoto, setIsCapturingMuralPhoto] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warn' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'warn' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

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

  // Community Mural publishing modal
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishAuthor, setPublishAuthor] = useState('');
  const [publishTitle, setPublishTitle] = useState('');

  // Panels
  const [isPlayEditorOpen, setIsPlayEditorOpen] = useState(false);
  const [isExtrasOpen, setIsExtrasOpen] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);

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

      // Load site settings & verify owner
      const settings = await authService.getSiteSettings();
      setSiteSettings(settings);

      const logged = authService.getCurrentUser();
      if (logged) {
        setCurrentUser(logged);
        setPublishAuthor(logged.name);
      }
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

  // Handle Fullscreen / Campo Máximo: collapses both sidebars for maximum field view maintaining ratio without scroll
  const handleToggleFullscreen = () => {
    if (!isLeftPanelCollapsed || !isRightPanelCollapsed) {
      setIsLeftPanelCollapsed(true);
      setIsRightPanelCollapsed(true);
      setStatusMessage('Campo ampliado ao máximo! Painéis laterais recolhidos sem rolagem.');
      showToast('Campo ampliado ao máximo! Use os botões laterais para reabrir.', 'info');
    } else {
      setIsLeftPanelCollapsed(false);
      setIsRightPanelCollapsed(false);
      setStatusMessage('Painéis laterais restaurados.');
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
      showToast('Coloque no campo os jogadores que participarão desta etapa.', 'warn');
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
      showToast('A jogada precisa ter pelo menos 2 etapas gravadas.', 'warn');
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
      showToast('Grave pelo menos 2 etapas antes de salvar.', 'warn');
      return;
    }

    const id = await storage.savePlay(currentPlay);
    setCurrentPlay({ ...currentPlay, id });
    const all = await storage.getAllPlays();
    setSavedPlays(all);
    setStatusMessage(`Jogada "${currentPlay.name}" salva com sucesso no banco de dados.`);
    showToast(`Jogada "${currentPlay.name}" salva com sucesso!`, 'success');
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
      showToast('Informe um título para a prancheta.', 'warn');
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

  // Load Community Lineup from Mural
  const handleLoadCommunityLineup = (lineup: CommunityLineup) => {
    setSelectedClub(lineup.opponentClub || '');
    const newTokens: FieldTokenData[] = [];
    lineup.players.forEach((p, idx) => {
      const full = INITIAL_SQUAD.find((s) => s.name === p.name);
      newTokens.push({
        id: `com_v_${idx}_${Date.now()}`,
        kind: 'vasco',
        name: p.name,
        role: p.role,
        photo: storage.getPhoto(p.name, full?.photo || p.photo),
        x: p.x,
        y: p.y
      });
    });
    // Add centered ball
    newTokens.push({ id: 'bola', kind: 'ball', x: 0.5, y: 0.5 });
    handleTokensChange(newTokens);
    setStatusMessage(`Escalação "${lineup.title}" de ${lineup.author} carregada no campo.`);
  };

  // Submit current field as a static PHOTO snapshot to Community Mural
  const handlePublishCommunitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      showToast('Faça login com sua conta Google para publicar sua escalação no mural.', 'info');
      setIsAuthModalOpen(true);
      return;
    }

    if (!currentUser.permissions?.canPostMural && !authService.isOwner(currentUser)) {
      showToast('Seu perfil de membro está com publicações restritas. Solicite liberação ao Administrador.', 'warn');
      return;
    }

    if (!publishTitle.trim()) {
      showToast('Informe o título da sua formação tática.', 'warn');
      return;
    }

    const vascoPlayers = tokens
      .filter((t) => t.kind === 'vasco')
      .map((t) => ({
        name: t.name || '',
        role: t.role || '',
        photo: t.photo,
        x: t.x,
        y: t.y
      }));

    if (vascoPlayers.length === 0) {
      showToast('Adicione pelo menos alguns jogadores do Vasco no campo antes de publicar.', 'warn');
      return;
    }

    setIsCapturingMuralPhoto(true);
    setStatusMessage('Capturando foto da prancheta em alta resolução...');

    let imageUrl = '';
    const pitchwrap = document.getElementById('pitchwrap');
    if (pitchwrap) {
      try {
        const canvas = await html2canvas(pitchwrap, {
          backgroundColor: '#080c09',
          scale: 1.8,
          useCORS: true,
          logging: false
        });
        imageUrl = canvas.toDataURL('image/jpeg', 0.85);
      } catch (err) {
        console.warn('Erro ao gerar foto do campo com html2canvas', err);
      }
    }

    const authorName = publishAuthor.trim() || currentUser.name;

    const published = await storage.publishCommunityLineup({
      author: authorName,
      authorEmail: currentUser.email,
      authorAvatar: currentUser.avatar,
      authorRole: currentUser.role,
      title: publishTitle.trim(),
      opponentClub: selectedClub || 'Geral',
      formation: '4-3-3',
      players: vascoPlayers,
      imageUrl: imageUrl || undefined
    });

    setIsCapturingMuralPhoto(false);

    if (published) {
      setIsPublishModalOpen(false);
      setPublishTitle('');
      setStatusMessage('Foto da sua escalação foi publicada no Mural da Torcida com sucesso!');
      showToast('Sua escalação foi publicada no Mural da Torcida com foto estática protegida!', 'success');
    } else {
      showToast('Não foi possível publicar no momento. Tente novamente.', 'error');
    }
  };

  // Alignments & Distribute
  const handleAlignSelected = (type: 'h' | 'v') => {
    if (selectedTokenIds.size < 2) {
      showToast('Selecione pelo menos 2 jogadores (Ctrl+clique em cada um) para alinhar.', 'info');
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
      showToast('Selecione pelo menos 3 jogadores para distribuir.', 'info');
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
      showToast('Selecione um jogador (Ctrl+clique) para bloquear ou desbloquear a posição.', 'info');
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
      showToast('Não foi possível exportar a imagem.', 'error');
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

      {/* Top Application Header Bar */}
      {!isPresentationMode && (
        <header className="h-10 px-3 bg-[#0d1410] border border-[#233026] flex items-center justify-between shrink-0 mb-1.5 rounded-lg text-xs shadow-md">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden border border-[#d62839] flex-none bg-black">
              <img src="/assets/campo.png" alt="Fala Vascão" className="w-full h-full object-cover scale-150" />
            </div>
            <div className="flex items-center gap-1.5 font-black text-white uppercase tracking-wider text-[11px]">
              <span>Fala Vascão</span>
              <span className="text-[#6d8274] font-semibold text-[9.5px]">| Portal Oficial & Prancheta</span>
            </div>
          </div>

          {/* Navigation Switcher Tabs */}
          <div className="flex items-center gap-1 bg-[#131c15] p-0.5 rounded-lg border border-[#253528]">
            <button
              type="button"
              onClick={() => setCurrentView('portal')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                currentView === 'portal'
                  ? 'bg-[#d62839] text-white shadow-md'
                  : 'text-[#8ea295] hover:text-white'
              }`}
            >
              <span>🏠</span>
              <span>Portal & Vídeos</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentView('tactics')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                currentView === 'tactics'
                  ? 'bg-[#1b6b3b] text-white shadow-md'
                  : 'text-[#8ea295] hover:text-white'
              }`}
            >
              <span>⚽</span>
              <span>Prancheta Tática PRO</span>
            </button>
          </div>

          {/* Quick Panel Expand/Collapse Controls for Live Streams */}
          {currentView === 'tactics' && !isPresentationMode && (
            <div className="flex items-center gap-1 bg-[#131c15] p-0.5 rounded-lg border border-[#253528]">
              <button
                type="button"
                onClick={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
                className={`px-2 py-1 rounded text-[9.5px] font-bold transition flex items-center gap-1 cursor-pointer ${
                  !isLeftPanelCollapsed
                    ? 'bg-[#1a2b1f] text-[#69e095] border border-[#2e5239]'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a231d]'
                }`}
                title={isLeftPanelCollapsed ? 'Mostrar Elenco (Vasco)' : 'Ocultar Elenco (Vasco)'}
              >
                <span>{isLeftPanelCollapsed ? '▶' : '◀'}</span>
                <span>{isLeftPanelCollapsed ? 'Mostrar Elenco' : 'Ocultar Elenco'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="px-2 py-1 rounded text-[9.5px] font-bold transition flex items-center gap-1 cursor-pointer text-amber-300 hover:text-amber-200 bg-[#282210] hover:bg-[#382f16] border border-[#4d401e]"
                title="Campo Máximo: oculta/mostra ambos os painéis mantendo proporção sem rolagem"
              >
                <span>⛶</span>
                <span>Campo Máximo</span>
              </button>

              <button
                type="button"
                onClick={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
                className={`px-2 py-1 rounded text-[9.5px] font-bold transition flex items-center gap-1 cursor-pointer ${
                  !isRightPanelCollapsed
                    ? 'bg-[#1a2b1f] text-[#69e095] border border-[#2e5239]'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a231d]'
                }`}
                title={isRightPanelCollapsed ? 'Mostrar Controles' : 'Ocultar Controles'}
              >
                <span>{isRightPanelCollapsed ? 'Mostrar Controles' : 'Ocultar Controles'}</span>
                <span>{isRightPanelCollapsed ? '◀' : '▶'}</span>
              </button>
            </div>
          )}

          {/* Header Actions: Socials & Auth & Owner Admin Button */}
          <div className="flex items-center gap-2 text-[9.5px] font-bold">
            {/* Owner Admin Panel Launch Button */}
            {authService.isOwner(currentUser) && (
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(true)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-[#d62839] to-[#991b28] hover:from-[#e83345] hover:to-[#b02130] text-white px-2.5 py-1 rounded-md transition shadow cursor-pointer font-black border border-[#ff6675]"
                title="Abrir Painel Administrativo do Owner"
              >
                <span>🛡️</span>
                <span>Painel Admin (Owner)</span>
              </button>
            )}

            {/* User Login status */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 bg-[#142017] border border-[#26372b] px-2 py-0.5 rounded-md">
                <span className="text-white text-[10px] font-bold">{currentUser.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    authService.logout();
                    setCurrentUser(null);
                  }}
                  className="text-gray-400 hover:text-white text-[9px] cursor-pointer"
                  title="Sair"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1 bg-white hover:bg-gray-100 text-gray-900 px-2 py-1 rounded-md transition font-black cursor-pointer shadow"
              >
                <span>G</span>
                <span>Entrar</span>
              </button>
            )}

            <a
              href="https://www.youtube.com/@FalaVascao1"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[#ff808e] hover:text-white bg-[#261517] hover:bg-[#3d191d] border border-[#52252a] px-2 py-1 rounded transition"
            >
              <span>▶</span>
              <span>YouTube</span>
            </a>
            {siteSettings.kickBannerVisible && (
              <a
                href="https://kick.com/falavascao"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[#53fc18] hover:text-white bg-[#142614] hover:bg-[#1d3d1d] border border-[#2e5726] px-2 py-1 rounded font-black transition"
              >
                <span>K</span>
                <span>Kick</span>
              </a>
            )}
          </div>
        </header>
      )}

      {/* Main Workspace Layout */}
      {currentView === 'portal' && !isPresentationMode ? (
        <main className="flex-1 min-h-0 w-full overflow-hidden rounded-lg border border-[#243328] bg-[#0c120e]">
          <PortalView
            onOpenTactics={() => setCurrentView('tactics')}
            currentUser={currentUser}
            onOpenLogin={() => setIsAuthModalOpen(true)}
            onLogout={() => {
              authService.logout();
              setCurrentUser(null);
            }}
            onOpenAdminPanel={() => setIsAdminModalOpen(true)}
            siteSettings={siteSettings}
          />
        </main>
      ) : (
        <main
          className={`flex-1 flex gap-2 min-h-0 w-full overflow-hidden ${
            isPresentationMode ? 'p-0' : ''
          }`}
        >
        {/* Left: Vasco Squad Panel OR Collapsed Vertical Strip */}
        {!isPresentationMode && (
          !isLeftPanelCollapsed ? (
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
              onToggleCollapse={() => setIsLeftPanelCollapsed(true)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsLeftPanelCollapsed(false)}
              title="Expandir Elenco do Vasco"
              className="w-7 h-full bg-[#0d130f] hover:bg-[#16221a] border border-[#26372b] hover:border-[#43c776] rounded-lg flex flex-col items-center justify-center gap-3 py-3 text-[#95aa9c] hover:text-white transition shadow-lg cursor-pointer shrink-0 select-none group"
            >
              <span className="text-xs font-black group-hover:scale-125 transition-transform text-[#43c776]">▶</span>
              <span className="text-[9px] font-black uppercase [writing-mode:vertical-lr] tracking-widest text-[#8ea896] group-hover:text-[#b4dfbe]">
                ELENCO VASCO
              </span>
              <span className="text-xs">⚽</span>
            </button>
          )
        )}

        {/* Center: Tactical Pitch & Extras Overlay */}
        <section className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#101612] border border-[#29362d] rounded-lg p-2 overflow-hidden relative">
          {/* Pitch Container Centered: scales up to maximum space, maintains aspect ratio, strictly ZERO scroll */}
          <div className="flex-1 min-h-0 min-w-0 w-full h-full flex items-center justify-center overflow-hidden">
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
          </div>

          {/* Status Bar: clean and simple, no technical database tags */}
          {!isPresentationMode && (
            <div className="h-6 mt-1.5 px-2.5 bg-[#0c120e] rounded border border-[#222c25] flex items-center justify-between text-[9px] text-[#8ea095] shrink-0">
              <span className="truncate">{statusMessage}</span>
              <div className="flex items-center gap-2 shrink-0">
                {(isLeftPanelCollapsed || isRightPanelCollapsed) && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsLeftPanelCollapsed(false);
                      setIsRightPanelCollapsed(false);
                      setStatusMessage('Painéis laterais restaurados.');
                    }}
                    className="text-[8px] text-[#71e39a] hover:underline font-bold cursor-pointer"
                  >
                    Restaurar Painéis
                  </button>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[8px] text-[#6d8274] font-semibold">Salvamento automático ativo</span>
                </div>
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
                onPublishCommunity={() => setIsPublishModalOpen(true)}
                tokens={tokens}
                selectedClub={selectedClub}
                frameCount={currentPlay.frames.length}
              />
            </div>
          )}
        </section>

        {/* Right: Opponent, Controls & Tools Panel OR Collapsed Vertical Strip */}
        {!isPresentationMode && (
          !isRightPanelCollapsed ? (
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
              onToggleCollapse={() => setIsRightPanelCollapsed(true)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsRightPanelCollapsed(false)}
              title="Expandir Ferramentas & Adversário"
              className="w-7 h-full bg-[#0d130f] hover:bg-[#16221a] border border-[#26372b] hover:border-[#43c776] rounded-lg flex flex-col items-center justify-center gap-3 py-3 text-[#95aa9c] hover:text-white transition shadow-lg cursor-pointer shrink-0 select-none group"
            >
              <span className="text-xs font-black group-hover:scale-125 transition-transform text-[#43c776]">◀</span>
              <span className="text-[9px] font-black uppercase [writing-mode:vertical-lr] tracking-widest text-[#8ea896] group-hover:text-[#b4dfbe]">
                CONTROLES
              </span>
              <span className="text-xs">⚙️</span>
            </button>
          )
        )}
      </main>
      )}

      {/* Community Publish Modal */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handlePublishCommunitySubmit}
            className="w-[min(480px,95vw)] bg-[#101712] border border-[#3e5345] rounded-xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#25362a]">
              <div className="flex items-center gap-2">
                <span className="text-xl">📷</span>
                <h3 className="text-base font-black text-white">Publicar Foto no Mural da Torcida</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPublishModalOpen(false)}
                className="text-gray-400 hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#9bb0a2]">
              Sua escalação atual será capturada automaticamente em alta resolução e publicada como uma <b>foto estática protegida</b> no Mural da Torcida, informando seu nome como autor!
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-[#8aa092] uppercase mb-1">
                  Seu Nome ou Apelido de Torcedor
                </label>
                <input
                  type="text"
                  required
                  value={publishAuthor}
                  onChange={(e) => setPublishAuthor(e.target.value)}
                  placeholder="Ex: Carlos (Membro Fala Vascão)"
                  className="w-full h-8 px-2.5 text-xs font-bold bg-[#17221a] text-white border border-[#3a4e40] rounded-lg outline-none focus:border-[#43c776]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#8aa092] uppercase mb-1">
                  Título da Escalação
                </label>
                <input
                  type="text"
                  required
                  value={publishTitle}
                  onChange={(e) => setPublishTitle(e.target.value)}
                  placeholder="Ex: 4-3-3 Ofensivo para Vencer Domingo"
                  className="w-full h-8 px-2.5 text-xs font-bold bg-[#17221a] text-white border border-[#3a4e40] rounded-lg outline-none focus:border-[#43c776]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#25362a]">
              <button
                type="button"
                disabled={isCapturingMuralPhoto}
                onClick={() => setIsPublishModalOpen(false)}
                className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCapturingMuralPhoto}
                className="px-4 py-1.5 bg-[#1b6b3b] hover:bg-[#23874b] text-white text-xs font-black rounded-lg transition shadow cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isCapturingMuralPhoto ? (
                  <>
                    <span className="inline-block animate-spin">⏳</span>
                    <span>Capturando Foto...</span>
                  </>
                ) : (
                  <>
                    <span>📷</span>
                    <span>Tirar Foto e Publicar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin Panel Modal for Owner tazmaniacrvg@gmail.com */}
      <AdminPanelModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        currentUser={currentUser}
        onSettingsChanged={(updated) => setSiteSettings(updated)}
      />

      {/* Google Sign-In Authentication Modal */}
      <GoogleAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setPublishAuthor(user.name);
          setStatusMessage(`Conectado com sucesso como ${user.name}!`);
        }}
      />

      {/* Non-intrusive Toast Notification Banner */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 z-[9999] max-w-sm px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-2.5 backdrop-blur transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'success'
              ? 'bg-[#0f2817]/95 border-[#2ea354] text-white'
              : toast.type === 'error'
              ? 'bg-[#2a1315]/95 border-[#d62839] text-white'
              : toast.type === 'warn'
              ? 'bg-[#2a220f]/95 border-[#d49924] text-amber-200'
              : 'bg-[#151d18]/95 border-[#395240] text-white'
          }`}
        >
          <span className="text-sm shrink-0">
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : toast.type === 'warn' ? '⚠️' : 'ℹ️'}
          </span>
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-gray-400 hover:text-white text-xs px-1 py-0.5 cursor-pointer ml-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

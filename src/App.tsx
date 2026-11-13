import React, { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { Pitch } from './components/Pitch';
import { RosterPanel } from './components/RosterPanel';
import { OpponentPanel } from './components/OpponentPanel';
import { ExtrasPanel } from './components/ExtrasPanel';
import { PlayEditor } from './components/PlayEditor';
import { PortalView } from './components/Portal/PortalView';
import { DrawingCanvasRef, DrawingTool } from './components/DrawingCanvas';
import { INITIAL_SQUAD, SquadPlayer, OPPONENT_CLUBS, TACTICAL_FORMATIONS } from './data/squad';
import { storage, FieldTokenData, LineupSnapshot, SavedBoard, CommunityLineup } from './data/storage';
import { AppUser, SiteSettings, AdminMessage, authService, DEFAULT_SITE_SETTINGS } from './data/auth';
import { FIREBASE_PROJECT_ID } from './data/firebase';
import { databaseService, DbClub, DbPlayer, getClubColors } from './data/databaseService';
import { AdminPanelModal } from './components/AdminPanelModal';
import { AdminProfileModal } from './components/AdminProfileModal';
import { AdminMessageModal } from './components/AdminMessageModal';
import { PlayerDetailModal } from './components/PlayerDetailModal';
import { RosterPlayerItem } from './components/RosterPanel';
import { DraggablePopup } from './components/DraggablePopup';
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

  // Auth & Admin state (strictly verified via Firebase Google OAuth)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isAdminProfileOpen, setIsAdminProfileOpen] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [isCapturingMuralPhoto, setIsCapturingMuralPhoto] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warn' | 'error' | 'info' } | null>(null);
  const [unauthorizedDomainHost, setUnauthorizedDomainHost] = useState<string | null>(null);
  const [pendingAdminMessages, setPendingAdminMessages] = useState<AdminMessage[]>([]);
  const pendingOpenTacticsRef = useRef(false);

  const showToast = useCallback((message: string, type: 'success' | 'warn' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  const tacticsAccess = authService.canAccessTactics(currentUser, siteSettings.tacticsVisible);
  const canRenderTactics = tacticsAccess.allowed;

  const handleGoogleSignIn = useCallback(async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      const user = await authService.signInWithGoogle();
      setCurrentUser(user);
      setPublishAuthor(user.name);
      const isOwnerUser = authService.isOwner(user);
      showToast(
        isOwnerUser
          ? `Conectado como Administrador Master (${user.email}).`
          : `Bem-vindo, ${user.name}! Conectado com sua Conta Google.`,
        'success'
      );

      if (pendingOpenTacticsRef.current) {
        pendingOpenTacticsRef.current = false;
        const access = authService.canAccessTactics(user, siteSettings.tacticsVisible);
        if (access.allowed) {
          setCurrentView('tactics');
        } else if (access.reason === 'blocked') {
          showToast('Sua conta está suspensa e não pode acessar a Prancheta.', 'error');
        } else if (access.reason === 'permission_denied') {
          showToast('Seu acesso à Prancheta foi restringido pelo administrador.', 'warn');
        } else if (access.reason === 'disabled_by_admin') {
          showToast('A Prancheta Tática está temporariamente desativada pela administração.', 'info');
        }
      }
    } catch (err: any) {
      pendingOpenTacticsRef.current = false;
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        showToast('Login com o Google cancelado.', 'info');
      } else if (code === 'auth/popup-blocked') {
        showToast(
          'O navegador bloqueou o pop-up do Google. Permita pop-ups para este site e tente novamente.',
          'warn'
        );
      } else if (code === 'auth/unauthorized-domain') {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
        setUnauthorizedDomainHost(currentHost || 'seu-site.netlify.app');
        showToast(
          `Domínio "${currentHost}" não autorizado no Firebase Authentication. Adicione-o em Authorized domains.`,
          'warn'
        );
      } else {
        showToast(err?.message || 'Não foi possível concluir o login com o Google.', 'error');
      }
    } finally {
      setIsSigningIn(false);
    }
  }, [isSigningIn, showToast, siteSettings.tacticsVisible]);

  const handleOpenTactics = useCallback(() => {
    const access = authService.canAccessTactics(currentUser, siteSettings.tacticsVisible);
    if (access.allowed) {
      pendingOpenTacticsRef.current = false;
      setCurrentView('tactics');
      return;
    }

    if (access.reason === 'unauthenticated') {
      pendingOpenTacticsRef.current = true;
      showToast('Faça login com sua Conta Google para liberar a Prancheta Tática PRO.', 'warn');
      void handleGoogleSignIn();
      return;
    }

    if (access.reason === 'blocked') {
      showToast('Esta conta está suspensa pela administração do Fala Vascão.', 'error');
    } else if (access.reason === 'permission_denied') {
      showToast('Seu perfil não possui permissão para acessar a Prancheta no momento.', 'warn');
    } else {
      showToast('A Prancheta Tática está temporariamente desativada pela administração.', 'info');
    }
  }, [currentUser, handleGoogleSignIn, showToast, siteSettings.tacticsVisible]);

  const handleLogout = useCallback(async () => {
    pendingOpenTacticsRef.current = false;
    await authService.logout();
    setCurrentUser(null);
    setCurrentView('portal');
    setIsAdminModalOpen(false);
    setIsAdminProfileOpen(false);
    showToast('Você desconectou da sua conta Google.', 'info');
  }, [showToast]);

  // State (always backed by bd.xlsx without temporary overrides)
  const [squad, setSquad] = useState<RosterPlayerItem[]>(INITIAL_SQUAD);
  const [opponentClubs, setOpponentClubs] = useState<DbClub[]>([]);
  const [selectedClubSquad, setSelectedClubSquad] = useState<DbPlayer[]>([]);
  const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<FieldTokenData | null>(null);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [tokens, setTokens] = useState<FieldTokenData[]>([]);
  const [selectedClub, setSelectedClub] = useState<string>('');
  const [currentTool, setCurrentTool] = useState<DrawingTool>('move');
  const [drawingColor, setDrawingColor] = useState<string>('#e32636');
  const [lineWidth, setLineWidth] = useState<number>(5);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Prancheta pronta. Carregando dados do banco de dados oficial...'
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
  const [isTopBarCollapsed, setIsTopBarCollapsed] = useState(false);
  const [isBottomBarCollapsed, setIsBottomBarCollapsed] = useState(false);

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
    selectedClub ? getClubColors(selectedClub) : ['#39433d']
  );

  // 1. Initial Load & Setup: automatic boot with silent database restore
  useEffect(() => {
    async function init() {
      // Load stored photos from IndexedDB
      await storage.loadPhotoCache();

      // Load official database directly from bd.xlsx (always consulting the database without temporary overrides)
      try {
        await databaseService.init();
        const vascoSquad = databaseService.getVascoSquad();
        if (vascoSquad && vascoSquad.length > 0) {
          setSquad(vascoSquad.map((p) => ({
            ...p,
            photo: p.photoUrl
          })));
        } else {
          setSquad([...INITIAL_SQUAD]);
        }
        const oppClubs = databaseService.getOpponentClubs();
        setOpponentClubs(oppClubs);
      } catch (err) {
        console.warn('Erro ao carregar banco de dados bd.xlsx:', err);
        setSquad([...INITIAL_SQUAD]);
      }

      // Start with NO opponent pre-selected so only Vasco players appear until user chooses an opponent
      setSelectedClub('');
      setSelectedClubSquad([]);

      // Restore Vasco lineup + ball if available (never pre-populate opponents on startup)
      const prev = await storage.loadLastLineup();
      if (prev && (prev.players?.length || prev.ball)) {
        const restoredTokens: FieldTokenData[] = [];

        (prev.players || []).forEach((p) => {
          const dbP = databaseService.getPlayerByNameAndClub(p.name, 'CR Vasco da Gama');
          restoredTokens.push({
            id: p.id || `v_${p.name}_${Date.now()}`,
            kind: 'vasco',
            name: p.name,
            role: p.role || dbP?.role,
            photo: storage.getPhoto(p.name, dbP?.photoUrl || p.photo),
            club: 'CR Vasco da Gama',
            playerId: dbP?.id,
            rawPosition: dbP?.rawPosition,
            birthDate: dbP?.birthDate,
            age: dbP?.age,
            nationality: dbP?.nationality,
            contract: dbP?.contract,
            marketValue: dbP?.marketValue,
            profileUrl: dbP?.profileUrl,
            comment: dbP?.comment,
            x: p.x,
            y: p.y,
            locked: p.locked
          });
        });

        if (prev.ball) {
          restoredTokens.push({
            id: prev.ball.id || 'bola',
            kind: 'ball',
            x: prev.ball.x,
            y: prev.ball.y
          });
        } else {
          restoredTokens.push({ id: 'bola', kind: 'ball', x: 0.5, y: 0.5 });
        }

        setTokens(restoredTokens);

        if (prev.drawing) {
          setTimeout(() => {
            drawingCanvasRef.current?.loadFromDataURL(prev.drawing);
          }, 100);
        }
        setStatusMessage('Elenco do Vasco carregado. Escolha um adversário quando desejar.');
      } else {
        // Ready immediately with ball centered on the pitch
        setTokens([{ id: 'bola', kind: 'ball', x: 0.5, y: 0.5 }]);
        setStatusMessage('Prancheta pronta. Adicione jogadores do Vasco ou escolha um adversário.');
      }

      // Load saved plays
      const plays = await storage.getAllPlays();
      setSavedPlays(plays);

      // Load saved boards
      const boards = await storage.getAllBoards();
      setSavedBoards(boards);

      // Load site settings from Firestore
      const settings = await authService.getSiteSettings();
      setSiteSettings(settings);
    }
    init();

    // Real-time Firebase Auth state listener (email-verified role routing)
    const unsubscribeAuth = authService.onAuthChange((user, errorMsg) => {
      setCurrentUser(user);
      if (user) {
        setPublishAuthor(user.name);
      } else {
        setCurrentView('portal');
      }
      if (errorMsg) {
        showToast(errorMsg, 'error');
      }
    });

    // Real-time Firestore site settings listener
    const unsubscribeSettings = authService.subscribeSiteSettings((settings) => {
      setSiteSettings(settings);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSettings();
    };
  }, [showToast]);

  // 1b. Live Presence Heartbeat + Pending Direct Admin Messages for signed-in member
  useEffect(() => {
    const uid = currentUser?.id;
    if (!uid) {
      setPendingAdminMessages([]);
      return;
    }

    const unsubscribeMessages = authService.subscribePendingAdminMessages(
      uid,
      (msgs) => {
        setPendingAdminMessages(msgs);
      },
      () => {
        showToast('Não foi possível sincronizar notificações da administração.', 'warn');
      }
    );

    void authService.updateUserPresence(true);

    const heartbeatInterval = setInterval(() => {
      void authService.updateUserPresence(true);
    }, 20_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void authService.updateUserPresence(true);
      }
    };

    const handleWindowFocus = () => {
      void authService.updateUserPresence(true);
    };

    const handlePageExit = () => {
      void authService.updateUserPresence(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pagehide', handlePageExit);
    window.addEventListener('beforeunload', handlePageExit);

    return () => {
      unsubscribeMessages();
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pagehide', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
    };
  }, [currentUser?.id, showToast]);

  const handleAcknowledgeAdminMessage = useCallback(
    async (messageId: string) => {
      if (!currentUser?.id) return;
      await authService.acknowledgeAdminMessage(currentUser.id, messageId);
      setPendingAdminMessages((prev) => prev.filter((m) => m.id !== messageId));
    },
    [currentUser?.id]
  );

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

  // Select opponent club and load squad directly from database bd.xlsx
  const handleSelectClub = (clubName: string) => {
    setSelectedClub(clubName);
    if (clubName) {
      const oppSquad = databaseService.getSquadByClub(clubName);
      setSelectedClubSquad(oppSquad);
      setStatusMessage(
        oppSquad.length > 0
          ? `Elenco do ${clubName} carregado com sucesso (${oppSquad.length} atletas da base).`
          : `Adversário definido: ${clubName}.`
      );
    } else {
      setSelectedClubSquad([]);
    }
    queueAutoSave();
  };

  // Add Vasco player to field (enriched with all bd.xlsx attributes)
  const handleAddPlayer = (player: RosterPlayerItem) => {
    // Check if player is already on the field -> highlight instead of duplicating
    const existing = tokens.find((t) => t.kind === 'vasco' && t.name === player.name);
    if (existing) {
      window.dispatchEvent(new CustomEvent('highlight-token', { detail: { id: existing.id } }));
      setStatusMessage(`${player.name} já está posicionado no campo.`);
      return;
    }

    const extra = player as any;
    const newToken: FieldTokenData = {
      id: `v_${player.name.replace(/\s+/g, '_')}_${Date.now()}`,
      kind: 'vasco',
      name: player.name,
      role: player.role,
      photo: storage.getPhoto(player.name, extra.photoUrl || player.photo),
      club: 'CR Vasco da Gama',
      playerId: extra.id,
      rawPosition: extra.rawPosition,
      birthDate: extra.birthDate,
      age: extra.age,
      nationality: extra.nationality,
      contract: extra.contract,
      marketValue: extra.marketValue,
      profileUrl: extra.profileUrl,
      comment: extra.comment,
      x: 0.25,
      y: 0.5
    };

    handleTokensChange([...tokens, newToken]);
    setStatusMessage(`${player.name} (${player.role}) adicionado ao campo.`);
  };

  // Add Opponent player from bd.xlsx to field
  const handleAddOpponentPlayer = (player: DbPlayer) => {
    const existing = tokens.find(
      (t) => t.kind === 'opp' && (t.name === player.name || (player.id && t.playerId === player.id))
    );
    if (existing) {
      window.dispatchEvent(new CustomEvent('highlight-token', { detail: { id: existing.id } }));
      setStatusMessage(`${player.name} (${player.club}) já está posicionado no campo.`);
      return;
    }

    const newToken: FieldTokenData = {
      id: `opp_${player.name.replace(/\s+/g, '_')}_${Date.now()}`,
      kind: 'opp',
      name: player.name,
      role: player.role,
      num: player.number || undefined,
      photo: player.photoUrl,
      club: player.club,
      playerId: player.id,
      rawPosition: player.rawPosition,
      birthDate: player.birthDate,
      age: player.age,
      nationality: player.nationality,
      contract: player.contract,
      marketValue: player.marketValue,
      profileUrl: player.profileUrl,
      comment: player.comment,
      x: 0.72,
      y: 0.5
    };

    handleTokensChange([...tokens, newToken]);
    setStatusMessage(`${player.name} (${player.club}) adicionado ao campo.`);
  };

  // Add Opponent player by quick number (1-20)
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
      club: selectedClub || 'Adversário',
      x: 0.72,
      y: 0.5
    };

    handleTokensChange([...tokens, newToken]);
    setStatusMessage(`Adversário #${num} adicionado ao campo.`);
  };

  // Player Detail Modal handlers
  const handleOpenPlayerDetail = (token: FieldTokenData) => {
    setSelectedPlayerForModal(token);
    setIsPlayerModalOpen(true);
  };

  const handleToggleLockFromModal = (tokenId: string) => {
    handleTokensChange(
      tokens.map((t) => (t.id === tokenId ? { ...t, locked: !t.locked } : t))
    );
    setSelectedPlayerForModal((prev) => (prev?.id === tokenId ? { ...prev, locked: !prev.locked } : prev));
  };

  const handleRemoveTokenFromModal = (tokenId: string) => {
    handleTokensChange(tokens.filter((t) => t.id !== tokenId));
    setIsPlayerModalOpen(false);
  };

  const handleUpdateCommentFromModal = (tokenId: string, newComment: string) => {
    handleTokensChange(
      tokens.map((t) => (t.id === tokenId ? { ...t, comment: newComment } : t))
    );
    setSelectedPlayerForModal((prev) => (prev?.id === tokenId ? { ...prev, comment: newComment } : prev));
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

      const extra = chosen as any;
      newVascoTokens.push({
        id: `v_${chosen.name.replace(/\s+/g, '_')}_${Date.now()}_${pos.label}`,
        kind: 'vasco',
        name: chosen.name,
        role: chosen.role,
        photo: storage.getPhoto(chosen.name, extra.photoUrl || chosen.photo),
        club: 'CR Vasco da Gama',
        playerId: extra.id,
        rawPosition: extra.rawPosition,
        birthDate: extra.birthDate,
        age: extra.age,
        nationality: extra.nationality,
        contract: extra.contract,
        marketValue: extra.marketValue,
        profileUrl: extra.profileUrl,
        comment: extra.comment,
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

  // Handle Fullscreen / Campo Máximo: collapses all 4 areas (top bar, bottom bar, left panel, right panel) for maximum field view maintaining ratio without scroll
  const handleToggleFullscreen = () => {
    if (!isLeftPanelCollapsed || !isRightPanelCollapsed || !isTopBarCollapsed || !isBottomBarCollapsed) {
      setIsLeftPanelCollapsed(true);
      setIsRightPanelCollapsed(true);
      setIsTopBarCollapsed(true);
      setIsBottomBarCollapsed(true);
      setStatusMessage('Campo ampliado ao máximo! Barras e painéis recolhidos sem rolagem.');
      showToast('Campo ampliado ao máximo! Use os botões flutuantes para restaurar.', 'info');
    } else {
      setIsLeftPanelCollapsed(false);
      setIsRightPanelCollapsed(false);
      setIsTopBarCollapsed(false);
      setIsBottomBarCollapsed(false);
      setStatusMessage('Visão padrão restaurada.');
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
    await storage.deleteBoard(id);
    const all = await storage.getAllBoards();
    setSavedBoards(all);
    setStatusMessage('Prancheta removida.');
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
      showToast('Conecte sua Conta Google para publicar sua escalação no mural.', 'info');
      await handleGoogleSignIn();
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
        photo: t.photo || '',
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
          scale: 1.4,
          useCORS: true,
          logging: false
        });
        imageUrl = canvas.toDataURL('image/jpeg', 0.78);
      } catch (err) {
        console.warn('Erro ao gerar foto do campo com html2canvas', err);
      }
    }

    const authorName = publishAuthor.trim() || currentUser.name;

    try {
      const published = await storage.publishCommunityLineup({
        authorUid: currentUser.id,
        author: authorName,
        authorAvatar: currentUser.avatar,
        authorRole: currentUser.role,
        title: publishTitle.trim(),
        opponentClub: selectedClub || 'Geral',
        formation: '4-3-3',
        players: vascoPlayers,
        imageUrl: imageUrl || undefined
      });

      if (published) {
        setIsPublishModalOpen(false);
        setPublishTitle('');
        setStatusMessage('Foto da sua escalação foi publicada no Mural da Torcida com sucesso!');
        showToast('Sua escalação foi publicada no Mural da Torcida no Firestore!', 'success');
      } else {
        showToast('Não foi possível publicar no momento. Tente novamente.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao publicar escalação no Firestore.', 'error');
    } finally {
      setIsCapturingMuralPhoto(false);
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
    tokens.filter((t) => t.kind === 'opp' && t.num).map((t) => Number(t.num))
  );

  const usedOpponentPlayerIds = new Set(
    tokens.filter((t) => t.kind === 'opp' && t.playerId).map((t) => t.playerId!)
  );

  const effectivePresentationMode = isPresentationMode && canRenderTactics;

  useEffect(() => {
    if (!canRenderTactics) {
      if (currentView === 'tactics') setCurrentView('portal');
      if (isPresentationMode) setIsPresentationMode(false);
      if (isPlayEditorOpen) setIsPlayEditorOpen(false);
      if (isExtrasOpen) setIsExtrasOpen(false);
    }
  }, [canRenderTactics, currentView, isPresentationMode, isPlayEditorOpen, isExtrasOpen]);

  return (
    <div
      className={`w-screen h-screen overflow-hidden bg-[#080c09] text-[#f4f4f4] flex flex-col font-sans ${
        effectivePresentationMode ? 'p-0' : 'p-2'
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
      {!effectivePresentationMode && !isTopBarCollapsed && (
        <header className="h-9 px-2.5 bg-[#0d1410] border border-[#233026] flex items-center justify-between gap-2 shrink-0 mb-1.5 rounded-lg text-xs shadow-md overflow-hidden">
          {/* Brand */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-5.5 h-5.5 rounded-full overflow-hidden border border-[#d62839] flex-none bg-black">
              <img src="/assets/campo.png" alt="Fala Vascão" className="w-full h-full object-cover scale-150" />
            </div>
            <div className="flex items-center gap-1 font-black text-white uppercase tracking-wider text-[10.5px] whitespace-nowrap">
              <span>Fala Vascão</span>
              <span className="hidden 2xl:inline text-[#6d8274] font-semibold text-[9px]">| Portal Oficial & Prancheta</span>
            </div>
          </div>

          {/* Navigation Switcher Tabs */}
          <div className="flex items-center gap-0.5 bg-[#131c15] p-0.5 rounded-md border border-[#253528] shrink-0">
            <button
              type="button"
              onClick={() => setCurrentView('portal')}
              className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                currentView === 'portal'
                  ? 'bg-[#d62839] text-white shadow-md'
                  : 'text-[#8ea295] hover:text-white'
              }`}
            >
              <span>🏠</span>
              <span>Portal</span>
            </button>

            <button
              type="button"
              onClick={handleOpenTactics}
              title={
                canRenderTactics
                  ? 'Abrir Prancheta Tática PRO'
                  : 'Faça login com sua Conta Google para liberar a Prancheta PRO'
              }
              className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                currentView === 'tactics' && canRenderTactics
                  ? 'bg-[#1b6b3b] text-white shadow-md'
                  : canRenderTactics
                  ? 'text-[#8ea295] hover:text-white'
                  : 'text-amber-300/90 hover:text-white'
              }`}
            >
              <span>{canRenderTactics ? '⚽' : '🔒'}</span>
              <span>Prancheta PRO</span>
            </button>
          </div>

          {/* Tactics Quick Pop-ups & Viewport Controls (moved from RosterPanel to Top Bar) */}
          {currentView === 'tactics' && canRenderTactics && (
            <div className="flex items-center gap-1 bg-[#131c15] p-0.5 rounded-md border border-[#253528] shrink-0">
              <button
                type="button"
                onClick={() => setIsPlayEditorOpen((prev) => !prev)}
                className={`px-2 py-0.5 rounded text-[9px] font-black transition flex items-center gap-1 cursor-pointer whitespace-nowrap border ${
                  isPlayEditorOpen
                    ? 'bg-[#8e1724] border-[#e35260] text-white shadow'
                    : 'bg-[#19261d] hover:bg-[#233629] border-[#314b39] text-[#dff0e4]'
                }`}
                title="Abrir ou fechar Criador de Jogadas em pop-up móvel"
              >
                <span>🎬</span>
                <span>Jogadas</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExtrasOpen((prev) => !prev)}
                className={`px-2 py-0.5 rounded text-[9px] font-black transition flex items-center gap-1 cursor-pointer whitespace-nowrap border ${
                  isExtrasOpen
                    ? 'bg-[#7d1520] border-[#ec6571] text-white shadow'
                    : 'bg-[#19231d] hover:bg-[#233128] border-[#314539] text-[#cdd8d1]'
                }`}
                title="Abrir ou fechar Recursos da Prancheta"
              >
                <span>⚙</span>
                <span>Recursos</span>
              </button>

              <div className="w-px h-4 bg-[#26362b] mx-0.5" />

              <button
                type="button"
                onClick={() => {
                  setIsTopBarCollapsed(true);
                  setStatusMessage('Barra superior oculta. Campo ampliado na altura!');
                }}
                className="px-2 py-0.5 rounded text-[9px] font-bold transition flex items-center gap-1 cursor-pointer text-emerald-400 hover:text-white bg-[#142318] hover:bg-[#1f3726] border border-[#2d4d35] whitespace-nowrap"
                title="Ocultar barra superior para aumentar o campo na altura mantendo a proporção"
              >
                <span>▲</span>
                <span className="hidden lg:inline">Ocultar Barra</span>
              </button>

              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="px-2 py-0.5 rounded text-[9px] font-bold transition flex items-center gap-1 cursor-pointer text-amber-300 hover:text-amber-200 bg-[#282210] hover:bg-[#382f16] border border-[#4d401e] whitespace-nowrap"
                title="Campo Máximo: oculta barras e painéis mantendo proporção sem rolagem"
              >
                <span>⛶</span>
                <span className="hidden lg:inline">Máximo</span>
              </button>
            </div>
          )}

          {/* Header Actions: Socials & Auth & Owner Admin Button */}
          <div className="flex items-center gap-1.5 text-[9px] font-bold shrink-0">
            {/* Owner Quick Admin Panel Button */}
            {authService.isOwner(currentUser) && (
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(true)}
                className="flex items-center gap-1 bg-gradient-to-r from-[#d62839] to-[#991b28] hover:from-[#e83345] hover:to-[#b02130] text-white px-2 py-0.5 rounded transition shadow cursor-pointer font-black border border-[#ff6675] whitespace-nowrap"
                title="Abrir Painel Administrativo Geral"
              >
                <span>🛡️</span>
                <span className="hidden xl:inline">Painel Admin</span>
                <span className="xl:hidden">Admin</span>
              </button>
            )}

            {/* User Profile / Login status */}
            {currentUser ? (
              <div className="flex items-center gap-1 bg-[#142017] border border-[#26372b] px-1.5 py-0.5 rounded">
                <button
                  type="button"
                  onClick={() => setIsAdminProfileOpen(true)}
                  className="flex items-center gap-1 hover:text-emerald-300 transition cursor-pointer whitespace-nowrap"
                  title={authService.isOwner(currentUser) ? "Ver Perfil de Administrador (tazmaniacrvg@gmail.com)" : "Ver perfil"}
                >
                  <span className="text-[11px]">{authService.isOwner(currentUser) ? '👑' : '👤'}</span>
                  <span className="text-white text-[9.5px] font-black max-w-[95px] truncate">{currentUser.name}</span>
                  {authService.isOwner(currentUser) && (
                    <span className="text-[7.5px] px-1 rounded font-black bg-[#d62839] text-white uppercase tracking-wider">
                      ADMIN
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-[#ff8e99] text-[9.5px] px-0.5 cursor-pointer"
                  title="Sair da Conta Google"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isSigningIn}
                onClick={handleGoogleSignIn}
                className="flex items-center gap-1 bg-white hover:bg-gray-100 text-gray-900 px-2 py-0.5 rounded transition font-black cursor-pointer shadow whitespace-nowrap disabled:opacity-60"
                title="Fazer login real com a Conta Google"
              >
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{isSigningIn ? 'Entrando...' : 'Entrar'}</span>
              </button>
            )}

            <a
              href="https://www.youtube.com/@FalaVascao1"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[#ff808e] hover:text-white bg-[#261517] hover:bg-[#3d191d] border border-[#52252a] px-1.5 py-0.5 rounded transition whitespace-nowrap"
              title="Canal Fala Vascão no YouTube"
            >
              <span>▶</span>
              <span className="hidden xl:inline">YouTube</span>
            </a>
            {siteSettings.kickBannerVisible && (
              <a
                href="https://kick.com/falavascao"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[#53fc18] hover:text-white bg-[#142614] hover:bg-[#1d3d1d] border border-[#2e5726] px-1.5 py-0.5 rounded font-black transition whitespace-nowrap"
                title="Canal Fala Vascão na Kick"
              >
                <span>K</span>
                <span className="hidden xl:inline">Kick</span>
              </a>
            )}
          </div>
        </header>
      )}

      {/* Floating Restore Button for Top Header Bar */}
      {isTopBarCollapsed && !effectivePresentationMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40">
          <button
            type="button"
            onClick={() => {
              setIsTopBarCollapsed(false);
              setStatusMessage('Barra superior restaurada.');
            }}
            className="px-3.5 py-1 bg-[#0d1410f0] hover:bg-[#16271a] border border-[#2e5038] hover:border-[#4ee586] text-[#78e69f] hover:text-white text-[9.5px] font-black rounded-full shadow-2xl backdrop-blur transition flex items-center gap-1.5 cursor-pointer group"
            title="Mostrar Barra Superior"
          >
            <span className="group-hover:translate-y-0.5 transition-transform text-[#4ee586]">▼</span>
            <span>Mostrar Barra Superior</span>
          </button>
        </div>
      )}

      {/* Floating Restore Button for Bottom Status Bar */}
      {isBottomBarCollapsed && !effectivePresentationMode && currentView === 'tactics' && canRenderTactics && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40">
          <button
            type="button"
            onClick={() => {
              setIsBottomBarCollapsed(false);
              setStatusMessage('Barra inferior restaurada.');
            }}
            className="px-3.5 py-1 bg-[#0d1410f0] hover:bg-[#16271a] border border-[#2e5038] hover:border-[#4ee586] text-[#78e69f] hover:text-white text-[9.5px] font-black rounded-full shadow-2xl backdrop-blur transition flex items-center gap-1.5 cursor-pointer group"
            title="Mostrar Barra Inferior"
          >
            <span className="group-hover:-translate-y-0.5 transition-transform text-[#4ee586]">▲</span>
            <span>Mostrar Barra Inferior</span>
          </button>
        </div>
      )}

      {/* Main Workspace Layout — Prancheta Tática strictly gated by verified Google login */}
      {!(currentView === 'tactics' && canRenderTactics) ? (
        <main className="flex-1 min-h-0 w-full overflow-hidden rounded-lg border border-[#243328] bg-[#0c120e]">
          <PortalView
            onOpenTactics={handleOpenTactics}
            currentUser={currentUser}
            onOpenLogin={handleGoogleSignIn}
            onLogout={handleLogout}
            onOpenAdminPanel={() => {
              if (authService.isAdminOrOwner(currentUser)) {
                setIsAdminModalOpen(true);
              }
            }}
            onOpenAdminProfile={() => setIsAdminProfileOpen(true)}
            siteSettings={siteSettings}
          />
        </main>
      ) : (
        <main
          className={`flex-1 flex gap-2 min-h-0 w-full overflow-hidden ${
            effectivePresentationMode ? 'p-0' : ''
          }`}
        >
        {/* Left: Vasco Squad Panel OR Collapsed Vertical Strip */}
        {!effectivePresentationMode && (
          !isLeftPanelCollapsed ? (
            <RosterPanel
              squad={squad}
              onAddPlayer={handleAddPlayer}
              onStatusMessage={setStatusMessage}
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
              onOpenPlayerDetail={handleOpenPlayerDetail}
            />
          </div>

          {/* Status Bar: clean and simple, no technical database tags */}
          {!isPresentationMode && !isBottomBarCollapsed && (
            <div className="h-6 mt-1.5 px-2.5 bg-[#0c120e] rounded border border-[#222c25] flex items-center justify-between text-[9px] text-[#8ea095] shrink-0 select-none">
              <span className="truncate">{statusMessage}</span>
              <div className="flex items-center gap-2 shrink-0">
                {(isLeftPanelCollapsed || isRightPanelCollapsed || isTopBarCollapsed || isBottomBarCollapsed) && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsLeftPanelCollapsed(false);
                      setIsRightPanelCollapsed(false);
                      setIsTopBarCollapsed(false);
                      setIsBottomBarCollapsed(false);
                      setStatusMessage('Visão padrão restaurada.');
                    }}
                    className="text-[8px] text-[#71e39a] hover:underline font-bold cursor-pointer"
                  >
                    Restaurar Visão Padrão
                  </button>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[8px] text-[#6d8274] font-semibold">Salvamento automático ativo</span>
                </div>
                {/* Discreet Hide Bottom Bar Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsBottomBarCollapsed(true);
                    setStatusMessage('Barra inferior oculta. Altura do campo maximizada!');
                  }}
                  title="Ocultar barra inferior para aumentar o campo na altura"
                  className="px-1.5 py-0.5 rounded text-[8px] font-bold transition flex items-center gap-1 cursor-pointer text-[#78e69f] hover:text-white bg-[#142318] hover:bg-[#1f3726] border border-[#2d4d35] ml-1"
                >
                  <span>▼</span>
                  <span>Ocultar Barra</span>
                </button>
              </div>
            </div>
          )}

          {/* Movable / Draggable Tactical Play Editor Pop-up */}
          {isPlayEditorOpen && (
            <DraggablePopup
              id="tactical-play-editor"
              isOpen={isPlayEditorOpen}
              onClose={() => setIsPlayEditorOpen(false)}
              title="Criador & Editor de Jogadas"
              subtitle="Grave etapas e reproduza a movimentação tática"
              icon="🎬"
              badge={`${currentPlay.frames.length} etapa${currentPlay.frames.length === 1 ? '' : 's'}`}
              badgeColor={currentPlay.frames.length > 0 ? 'bg-emerald-600' : 'bg-zinc-700'}
              width="w-[min(680px,94vw)]"
            >
              <PlayEditor
                isOpen={true}
                onClose={() => setIsPlayEditorOpen(false)}
                hideHeader={true}
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
                  await storage.deletePlay(id);
                  const all = await storage.getAllPlays();
                  setSavedPlays(all);
                  setStatusMessage('Jogada removida.');
                }}
                isAnimating={isAnimating}
                fieldTokens={tokens}
                onLoadDemoPlay={handleLoadDemoPlay}
              />
            </DraggablePopup>
          )}

          {/* Movable / Draggable Extras Panel */}
          {isExtrasOpen && (
            <DraggablePopup
              id="tactical-extras-panel"
              isOpen={isExtrasOpen}
              onClose={() => setIsExtrasOpen(false)}
              title="Recursos da Prancheta"
              subtitle="Metadados, biblioteca, travas e alinhamentos"
              icon="⚙️"
              width="w-[min(380px,92vw)]"
              defaultPosition={{ x: 25, y: 75 }}
            >
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
            </DraggablePopup>
          )}
        </section>

        {/* Right: Opponent, Controls & Tools Panel OR Collapsed Vertical Strip */}
        {!isPresentationMode && (
          !isRightPanelCollapsed ? (
            <OpponentPanel
              selectedClub={selectedClub}
              onSelectClub={handleSelectClub}
              opponentClubs={opponentClubs}
              opponentSquad={selectedClubSquad}
              onAddOpponentPlayer={handleAddOpponentPlayer}
              clubGradientStyle={clubGradientStyle}
              usedOpponentNumbers={usedOpponentNumbers}
              usedOpponentPlayerIds={usedOpponentPlayerIds}
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

      {/* Admin Panel Modal (strictly gated for verified Owner/Admin) */}
      {authService.isAdminOrOwner(currentUser) && (
        <AdminPanelModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          currentUser={currentUser}
          onSettingsChanged={(updated) => setSiteSettings(updated)}
        />
      )}

      {/* Administrator & Member Profile Modal */}
      <AdminProfileModal
        isOpen={isAdminProfileOpen}
        onClose={() => setIsAdminProfileOpen(false)}
        currentUser={currentUser}
        onOpenAdminPanel={() => {
          if (authService.isAdminOrOwner(currentUser)) {
            setIsAdminModalOpen(true);
          }
        }}
        onLogout={handleLogout}
        onGoToTactics={
          currentView === 'portal' && canRenderTactics ? handleOpenTactics : undefined
        }
      />

      {/* Player Detail & Tactical Report Modal (bd.xlsx) */}
      <PlayerDetailModal
        player={selectedPlayerForModal}
        isOpen={isPlayerModalOpen}
        onClose={() => setIsPlayerModalOpen(false)}
        onToggleLock={handleToggleLockFromModal}
        onRemoveToken={handleRemoveTokenFromModal}
        onUpdateComment={handleUpdateCommentFromModal}
      />

      {/* Firebase Unauthorized Domain Helper Modal (e.g. new Netlify / custom domain) */}
      {unauthorizedDomainHost && (
        <div className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-[min(520px,95vw)] bg-[#101712] border border-[#d49924] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 pb-2 border-b border-[#25362a]">
              <div>
                <h3 className="text-base font-black text-white">
                  Autorizar domínio no Firebase Authentication
                </h3>
                <p className="text-[11px] text-amber-300 mt-0.5">
                  O Login com Google bloqueou este domínio por segurança (<code>auth/unauthorized-domain</code>).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUnauthorizedDomainHost(null)}
                className="text-gray-400 hover:text-white text-sm cursor-pointer px-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#c7d6cc]">
              <p>
                Sempre que publicar em uma nova URL (como Netlify ou domínio próprio), adicione o domínio abaixo na lista de <b>Domínios autorizados</b> do projeto Firebase <code className="text-white">{FIREBASE_PROJECT_ID}</code>:
              </p>

              <div className="flex items-center justify-between gap-2 bg-[#0a100c] border border-[#2c4031] rounded-lg px-3 py-2">
                <code className="text-emerald-400 font-bold text-xs break-all">
                  {unauthorizedDomainHost}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(unauthorizedDomainHost);
                    showToast('Domínio copiado para a área de transferência!', 'success');
                  }}
                  className="px-2.5 py-1 bg-[#1b2e21] hover:bg-[#274430] border border-[#3a5c44] text-white rounded text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  Copiar
                </button>
              </div>

              <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#9eb2a4]">
                <li>Acesse o Console do Firebase no link abaixo;</li>
                <li>Vá em <b>Authentication → Settings → Authorized domains</b>;</li>
                <li>Clique em <b>Add domain</b>, cole <b>{unauthorizedDomainHost}</b> e salve.</li>
              </ol>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#25362a]">
              <button
                type="button"
                onClick={() => setUnauthorizedDomainHost(null)}
                className="px-3 py-1.5 text-xs font-bold text-gray-300 hover:text-white cursor-pointer"
              >
                Fechar
              </button>
              <a
                href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-1.5 bg-[#1b6b3b] hover:bg-[#23874b] text-white text-xs font-black rounded-lg transition shadow"
              >
                Abrir Firebase Authentication ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Direct Admin Message Modal (only single "Ok" button closes it) */}
      <AdminMessageModal
        message={pendingAdminMessages[0] || null}
        pendingCount={pendingAdminMessages.length}
        onAcknowledge={handleAcknowledgeAdminMessage}
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

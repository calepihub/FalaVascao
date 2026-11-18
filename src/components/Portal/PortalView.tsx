import React, { useState, useEffect } from 'react';
import { CommunityLineup, storage } from '../../data/storage';
import { AppUser, SiteSettings, authService } from '../../data/auth';
import { FALLBACK_CHANNEL_DATA } from '../../data/fallbackVideos';
import stadiumHeroImg from '../../assets/images/vasco_stadium_hero_1795023346331.jpg';

interface YouTubeVideo {
  id: string;
  title: string;
  published: string;
  thumb: string;
  views: number;
  url: string;
  isLive: boolean;
  isShort: boolean;
  category?: 'lives' | 'shorts' | 'videos';
}

interface YouTubeChannelData {
  channel: {
    title: string;
    handle: string;
    id: string;
    youtubeUrl: string;
    youtubeVideosUrl: string;
    youtubeShortsUrl: string;
    youtubeStreamsUrl: string;
    kickUrl: string;
    kickVideosUrl: string;
  };
  videos: YouTubeVideo[];
  counts?: {
    total: number;
    lives: number;
    shorts: number;
    videos: number;
  };
  lastUpdated: string;
}

interface PortalViewProps {
  onOpenTactics: () => void;
  currentUser: AppUser | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onOpenAdminPanel: () => void;
  onOpenAdminProfile?: () => void;
  siteSettings: SiteSettings;
  unreadRepliesCount?: number;
}

export const PortalView: React.FC<PortalViewProps> = ({
  onOpenTactics,
  currentUser,
  onOpenLogin,
  onLogout,
  onOpenAdminPanel,
  onOpenAdminProfile,
  siteSettings,
  unreadRepliesCount = 0
}) => {
  const [channelData, setChannelData] = useState<YouTubeChannelData | null>(null);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'lives' | 'shorts' | 'videos'>('all');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  // Community Mural State (Strictly real data only, zero mock/demo)
  const [communityLineups, setCommunityLineups] = useState<CommunityLineup[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(true);

  // Static Photo Lightbox preview
  const [previewPhotoLineup, setPreviewPhotoLineup] = useState<CommunityLineup | null>(null);
  const [muralNotice, setMuralNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const isOwner = authService.isOwner(currentUser);
  const isAdmin = authService.isAdminOrOwner(currentUser);

  useEffect(() => {
    async function loadVideos() {
      try {
        const res = await fetch('/api/youtube/videos');
        if (res.ok) {
          const data = await res.json();
          if (data && data.videos && data.videos.length > 0) {
            setChannelData(data);
            const live = data.videos.find((v: YouTubeVideo) => v.isLive);
            setSelectedVideoId(live ? live.id : data.videos[0].id);
            return;
          }
        }
        throw new Error('API do servidor indisponível (hospedagem estática Netlify/GitHub)');
      } catch {
        // Fallback for Netlify, GitHub Pages, or offline mode
        setChannelData(FALLBACK_CHANNEL_DATA as any);
        if (FALLBACK_CHANNEL_DATA.videos?.length > 0) {
          const live = FALLBACK_CHANNEL_DATA.videos.find((v) => v.isLive);
          setSelectedVideoId(live ? live.id : FALLBACK_CHANNEL_DATA.videos[0].id);
        }
      } finally {
        setLoadingVideos(false);
      }
    }

    async function loadCommunity() {
      try {
        const murals = await storage.getCommunityLineups();
        setCommunityLineups(murals);
      } catch (e) {
        console.warn('Error loading community lineups', e);
      } finally {
        setLoadingCommunity(false);
      }
    }

    function loadData() {
      void loadVideos();
      void loadCommunity();
    }

    loadData();
    const interval = setInterval(loadData, 60000); // 1-minute auto refresh
    return () => clearInterval(interval);
  }, []);

  const handleLike = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    try {
      const newLikes = await storage.likeCommunityLineup(id);
      if (newLikes !== null) {
        setCommunityLineups((prev) =>
          prev.map((l) => (l.id === id ? { ...l, likes: newLikes } : l))
        );
      }
    } catch {
      setMuralNotice('Não foi possível registrar sua curtida no momento.');
      setTimeout(() => setMuralNotice(null), 4000);
    }
  };

  const handleDeleteLineup = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => {
        setConfirmDeleteId((prev) => (prev === id ? null : prev));
      }, 4000);
      return;
    }
    setConfirmDeleteId(null);
    const ok = await storage.deleteCommunityLineup(id);
    if (ok) {
      setCommunityLineups((prev) => prev.filter((l) => l.id !== id));
      if (previewPhotoLineup?.id === id) setPreviewPhotoLineup(null);
    }
  };

  const handleStartLineup = () => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    if (!currentUser.permissions?.canPostMural && !isOwner) {
      setMuralNotice('Seu perfil está aguardando liberação do Administrador para publicar novas escalações.');
      setTimeout(() => setMuralNotice(null), 5000);
      return;
    }
    onOpenTactics();
  };

  const videos = channelData?.videos || [];
  const livesCount =
    channelData?.counts?.lives ?? videos.filter((v) => v.isLive || v.category === 'lives').length;
  const shortsCount =
    channelData?.counts?.shorts ?? videos.filter((v) => v.isShort || v.category === 'shorts').length;
  const regularVideosCount =
    channelData?.counts?.videos ??
    videos.filter((v) => v.category === 'videos' || (!v.isLive && !v.isShort)).length;

  const latestLive = videos.find((v) => v.isLive || v.category === 'lives') || videos[0];
  const filteredVideos = videos.filter((v) => {
    if (activeTab === 'lives') return v.isLive || v.category === 'lives';
    if (activeTab === 'shorts') return v.isShort || v.category === 'shorts';
    if (activeTab === 'videos') return v.category === 'videos' || (!v.isLive && !v.isShort);
    return true;
  });

  const userRoleLabel = currentUser
    ? authService.isOwner(currentUser) || currentUser.role === 'admin'
      ? 'Admin'
      : currentUser.role === 'moderator'
      ? 'Moderador'
      : currentUser.role === 'vip'
      ? 'VIP'
      : 'Membro'
    : null;

  return (
    <div className="w-full h-full overflow-y-auto bg-[#070b08] text-[#f0f3f1] font-sans scrollbar-thin">
      {/* 1. Compact Realistic Stadium Portal Hero Banner */}
      <header className="relative overflow-hidden border-b border-[#1d2a20] bg-gradient-to-br from-[#111c14] via-[#0a120c] to-[#070b08]">
        {/* Photographic Stadium Backdrop & Contrast Scrims */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          {!heroImgFailed && (
            <img
              src={stadiumHeroImg}
              alt="Estádio de São Januário iluminado à noite com torcida vascaína"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover object-[center_55%]"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#060a07]/92 via-[#070b08]/72 to-[#070b08]/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070b08]/95 via-[#070b08]/20 to-[#060a07]/65" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col md:flex-row md:items-stretch justify-between gap-4 md:gap-6">
            {/* Left Zone: Crest + Brand Identity + Channel Links */}
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3.5 sm:gap-4 text-center sm:text-left min-w-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-white/25 shadow-2xl shrink-0 bg-black ring-4 ring-black/40">
                <img
                  src="/assets/campo.png"
                  alt="Logo Fala Vascão"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover scale-150"
                />
              </div>

              <div className="space-y-1 min-w-0">
                <p className="text-[11px] sm:text-xs font-medium text-[#bfd3c6] tracking-wide drop-shadow-sm">
                  Portal Oficial da Torcida Vascaína · Ao Vivo & Análises
                </p>

                <h1 className="text-2xl sm:text-3xl lg:text-[2.25rem] font-black tracking-tight text-white leading-[1.08] drop-shadow-md text-balance">
                  Fala Vascão
                </h1>

                <p className="text-xs sm:text-sm text-[#dce8e0] max-w-xl leading-snug drop-shadow-sm">
                  Análises táticas ao vivo, transmissões oficiais e escalações da torcida.
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1.5">
                  <a
                    href="https://www.youtube.com/@FalaVascao1"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/15 text-white rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
                  >
                    <svg className="w-3.5 h-3.5 text-[#ff2b2b] fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                    <span>YouTube @FalaVascao1</span>
                  </a>

                  {siteSettings.kickBannerVisible && (
                    <a
                      href="https://kick.com/falavascao"
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/15 text-white rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
                    >
                      <span className="font-black text-[#53fc18] text-xs leading-none">K</span>
                      <span>Kick /falavascao</span>
                    </a>
                  )}

                  <a
                    href="https://falavascao.lojavirtualnuvem.com.br/produtos/caneca-personalizada-fala-vascao/"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/15 text-[#e6f0ea] rounded-lg text-[11px] sm:text-xs font-semibold transition whitespace-nowrap"
                  >
                    ☕ Loja Oficial
                  </a>
                </div>
              </div>
            </div>

            {/* Right Zone: Account / Admin Actions + Primary CTA */}
            <div className="flex flex-col items-center md:items-end justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-1.5">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={onOpenAdminPanel}
                    className="flex items-center gap-1.5 bg-[#9e1b29]/95 hover:bg-[#b82232] border border-white/15 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-md backdrop-blur-sm cursor-pointer whitespace-nowrap shrink-0"
                    title="Abrir Painel Administrativo"
                  >
                    <span>Painel Admin</span>
                    {unreadRepliesCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-white text-[#9e1b29] text-[10px] font-bold tabular-nums">
                        {unreadRepliesCount}
                      </span>
                    )}
                  </button>
                )}

                {currentUser ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={onOpenAdminProfile}
                      className="flex items-center gap-2 bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/15 px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
                      title="Ver meu perfil e permissões"
                    >
                      <div className="w-5 h-5 rounded-full bg-[#1a281e] border border-[#3a5441] overflow-hidden flex items-center justify-center text-[10px] font-bold text-[#e2efe7] shrink-0">
                        {currentUser.avatar ? (
                          <img
                            src={currentUser.avatar}
                            alt={currentUser.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          currentUser.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="text-xs font-semibold text-white max-w-[125px] truncate">
                        {currentUser.name}
                      </span>
                      <span className="text-[11px] text-[#a5beb0] font-medium hidden sm:inline">
                        · {userRoleLabel}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={onLogout}
                      className="px-2.5 py-1.5 text-xs font-medium text-[#d6e4dc] hover:text-white bg-black/45 hover:bg-[#9e1b29]/80 backdrop-blur-md border border-white/15 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
                      title="Sair da Conta Google"
                    >
                      Sair
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    className="flex items-center gap-2 bg-white hover:bg-neutral-100 text-neutral-900 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-md whitespace-nowrap shrink-0"
                    title="Entrar com sua Conta Google"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
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
                    <span>Entrar com Google</span>
                  </button>
                )}
              </div>

              {siteSettings.tacticsVisible && (
                <div className="flex flex-col items-center md:items-end gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={onOpenTactics}
                    className="px-5 py-2.5 bg-[#c81e2f] hover:bg-[#e02437] text-white rounded-xl font-bold text-xs sm:text-sm tracking-wide shadow-2xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0 border border-white/20"
                  >
                    <span>{currentUser ? '⚽' : '🔒'}</span>
                    <span>{currentUser ? 'Abrir Prancheta Tática' : 'Entrar para Abrir a Prancheta'}</span>
                  </button>
                  <span className="text-[11px] text-[#c7d9ce] drop-shadow-sm">
                    {currentUser
                      ? 'Ferramenta oficial de análises e jogadas'
                      : 'Acesso exclusivo via Conta Google'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Portal Content */}
      <main className="max-w-6xl mx-auto px-4 pt-5 pb-8 space-y-8">
        {/* Section A: Live Stream / Featured Video Player */}
        {siteSettings.liveStreamsVisible && latestLive && (
          <section className="bg-[#0f1712] border border-[#2b3a30] rounded-2xl p-4 md:p-6 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#212d25] mb-4 gap-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-600 animate-ping"></span>
                <h2 className="text-base md:text-lg font-black text-white uppercase tracking-wider">
                  {latestLive.isLive ? '🔴 Transmissão em Destaque / Ao Vivo' : 'Última Publicação do Canal'}
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <a
                  href={`https://www.youtube.com/watch?v=${selectedVideoId || latestLive.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-[#221719] hover:bg-[#3d1a20] border border-[#6b2c34] text-[#ff99a4] rounded font-bold transition"
                >
                  Assistir no YouTube ↗
                </a>
                {siteSettings.tacticsVisible && (
                  <button
                    onClick={onOpenTactics}
                    className="px-2.5 py-1 bg-[#192b1e] hover:bg-[#253f2c] border border-[#3c6b48] text-[#8ee3a4] rounded font-bold transition cursor-pointer"
                  >
                    {currentUser ? 'Abrir Prancheta ⚽' : '🔒 Entrar p/ Prancheta'}
                  </button>
                )}
              </div>
            </div>

            {/* Embedded Player */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 aspect-video w-full rounded-xl overflow-hidden bg-black border border-[#222e26] shadow-lg">
                <iframe
                  src={`https://www.youtube.com/embed/${selectedVideoId || latestLive.id}?autoplay=0&rel=0`}
                  title={latestLive.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>

              {/* Video Info & Quick Details */}
              <div className="space-y-4">
                <div>
                  <span className="text-[11px] font-bold text-[#d62839] uppercase tracking-wider block mb-1">
                    Fala Vascão • YouTube
                  </span>
                  <h3 className="text-base font-bold text-white leading-snug">
                    {videos.find((v) => v.id === (selectedVideoId || latestLive.id))?.title || latestLive.title}
                  </h3>
                  <p className="text-xs text-[#809186] mt-2">
                    Transmitido em tempo real pelo canal Fala Vascão. Participe do chat ao vivo no YouTube ou use nossa prancheta para acompanhar a análise.
                  </p>
                </div>

                {/* Direct Links Box */}
                <div className="bg-[#141e17] border border-[#29382e] rounded-xl p-3.5 space-y-2">
                  <div className="text-[11px] font-black tracking-wider text-[#9fb1a5] uppercase">
                    Acompanhe em Todas as Plataformas
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    <a
                      href="https://www.youtube.com/@FalaVascao1/streams"
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-[#211517] hover:bg-[#331a1e] border border-[#52242a] text-[#ff99a4] rounded-lg text-center transition"
                    >
                      📺 Lives YouTube
                    </a>
                    <a
                      href="https://kick.com/falavascao"
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-[#172614] hover:bg-[#1e3619] border border-[#395c2e] text-[#69f736] rounded-lg text-center transition font-black"
                    >
                      🟢 Lives na Kick
                    </a>
                  </div>
                </div>

                {/* Tactical Callout */}
                {siteSettings.tacticsVisible && (
                  <div className="p-3 bg-gradient-to-r from-[#172b1d] to-[#122116] border border-[#33593b] rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-white">Prancheta Vascaina PRO</div>
                      <div className="text-[10px] text-[#86a892]">
                        {currentUser
                          ? 'Simule as jogadas comentadas na live'
                          : 'Acesso exclusivo via login Google'}
                      </div>
                    </div>
                    <button
                      onClick={onOpenTactics}
                      className="px-3 py-1.5 bg-[#1b6b3b] hover:bg-[#23874b] text-white text-xs font-black rounded-lg transition shadow cursor-pointer"
                    >
                      {currentUser ? 'Desenhar' : '🔒 Entrar'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Section B: Automatic Real-Time Video Gallery from YouTube */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#243328]">
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">
                Vídeos e Transmissões Recentes
              </h2>
              <p className="text-xs text-[#8da094]">
                Espelhamento automático em tempo real direto do canal @FalaVascao1
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#121a14] p-1 rounded-lg border border-[#26352b] text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded transition cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-[#d62839] text-white shadow'
                    : 'text-[#90a397] hover:text-white'
                }`}
              >
                Todos ({videos.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('lives')}
                className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'lives'
                    ? 'bg-[#d62839] text-white shadow'
                    : 'text-[#90a397] hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                <span>Transmissões ({livesCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('shorts')}
                className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'shorts'
                    ? 'bg-[#7c3aed] text-white shadow'
                    : 'text-[#90a397] hover:text-white'
                }`}
              >
                <span>📱</span>
                <span>Shorts ({shortsCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('videos')}
                className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'videos'
                    ? 'bg-[#1b6b3b] text-white shadow'
                    : 'text-[#90a397] hover:text-white'
                }`}
              >
                <span>🎬</span>
                <span>Vídeos ({regularVideosCount})</span>
              </button>
            </div>
          </div>

          {loadingVideos ? (
            <div className="py-12 text-center text-[#7e9185]">
              <span className="inline-block animate-spin mr-2">⏳</span>
              <span>Carregando vídeos automáticos do YouTube...</span>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="py-8 text-center text-[#7e9185] bg-[#0f1712] rounded-xl border border-[#212d25]">
              Nenhum vídeo encontrado nesta categoria.
            </div>
          ) : activeTab === 'shorts' ? (
            /* Special vertical grid for Shorts */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredVideos.map((video) => {
                const isSelected = selectedVideoId === video.id;
                return (
                  <div
                    key={video.id}
                    onClick={() => {
                      setSelectedVideoId(video.id);
                      window.scrollTo({ top: 120, behavior: 'smooth' });
                    }}
                    className={`group bg-[#101712] hover:bg-[#16211a] border rounded-xl overflow-hidden transition shadow cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#7c3aed] ring-2 ring-[#7c3aed]/40'
                        : 'border-[#26352b] hover:border-[#5a4282]'
                    }`}
                  >
                    <div className="relative aspect-[9/13] w-full overflow-hidden bg-black">
                      <img
                        src={video.thumb}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-[#7c3aed] text-white font-black text-[9px] rounded uppercase shadow tracking-wider flex items-center gap-1">
                        <span>📱</span>
                        <span>SHORT</span>
                      </span>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="w-10 h-10 rounded-full bg-[#7c3aed] text-white flex items-center justify-center text-lg shadow-lg">
                          ▶
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-[#c4a1ff] transition">
                        {video.title}
                      </h4>
                      <div className="flex items-center justify-between text-[9px] text-[#7a8c81] mt-2 pt-1.5 border-t border-[#1d2720]">
                        <span className="font-bold text-[#b5a3cf]">Assistir Short</span>
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-white"
                          title="Abrir no YouTube Shorts"
                        >
                          ↗
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Standard 16:9 Grid for All, Lives, and Videos */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredVideos.map((video) => {
                const isSelected = selectedVideoId === video.id;
                const isShort = video.isShort || video.category === 'shorts';
                const isLive = video.isLive || video.category === 'lives';

                return (
                  <div
                    key={video.id}
                    onClick={() => {
                      setSelectedVideoId(video.id);
                      window.scrollTo({ top: 120, behavior: 'smooth' });
                    }}
                    className={`group bg-[#101712] hover:bg-[#16211a] border rounded-xl overflow-hidden transition shadow cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? isLive
                          ? 'border-[#d62839] ring-2 ring-[#d62839]/40'
                          : isShort
                          ? 'border-[#7c3aed] ring-2 ring-[#7c3aed]/40'
                          : 'border-[#1b6b3b] ring-2 ring-[#1b6b3b]/40'
                        : 'border-[#26352b] hover:border-[#3d5244]'
                    }`}
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-black">
                      <img
                        src={video.thumb}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      {isShort ? (
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-[#7c3aed] text-white font-black text-[9px] rounded uppercase shadow tracking-wider flex items-center gap-1">
                          <span>📱</span>
                          <span>SHORT</span>
                        </span>
                      ) : isLive ? (
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-red-600 text-white font-black text-[9px] rounded uppercase shadow tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                          <span>AO VIVO</span>
                        </span>
                      ) : (
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-[#1b6b3b] text-white font-black text-[9px] rounded uppercase shadow tracking-wider flex items-center gap-1">
                          <span>🎬</span>
                          <span>VÍDEO</span>
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span
                          className={`w-10 h-10 rounded-full text-white flex items-center justify-center text-lg shadow-lg ${
                            isShort ? 'bg-[#7c3aed]' : isLive ? 'bg-red-600' : 'bg-[#1b6b3b]'
                          }`}
                        >
                          ▶
                        </span>
                      </div>
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-[#ff7886] transition">
                        {video.title}
                      </h4>
                      <div className="flex items-center justify-between text-[10px] text-[#7a8c81] mt-2 pt-2 border-t border-[#1d2720]">
                        <span>{video.published?.slice(0, 10) || 'Recent'}</span>
                        <span className="font-bold text-[#a7baaef0]">Assistir no Portal</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section C: Mural da Torcida (FOTOS ESTÁTICAS DE ESCALAÇÕES DOS MEMBROS - SEM DADOS FALSOS) */}
        {siteSettings.muralVisible && (
          <section className="bg-[#0f1712] border border-[#2b3a30] rounded-2xl p-5 md:p-7 shadow-xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#212d25]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">👥</span>
                  <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-wider">
                    Mural da Torcida • Fotos das Escalações
                  </h2>
                </div>
                <p className="text-xs text-[#8ea195]">
                  Escalações enviadas pelos torcedores e membros. As publicações são fotos estáticas da prancheta protegidas contra alteração.
                </p>
              </div>

              {siteSettings.muralPublicPosting && (
                <button
                  onClick={handleStartLineup}
                  className="px-4 py-2 bg-[#1b6b3b] hover:bg-[#23874b] text-white rounded-lg font-black text-xs flex items-center gap-1.5 transition shadow cursor-pointer"
                >
                  <span>📷</span>
                  <span>Montar & Publicar Foto</span>
                </button>
              )}
            </div>

            {muralNotice && (
              <div className="bg-[#2a220f] border border-[#d49924] text-amber-200 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{muralNotice}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setMuralNotice(null)}
                  className="text-amber-300 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {loadingCommunity ? (
              <div className="py-8 text-center text-[#7e9185]">
                Carregando escalações da torcida...
              </div>
            ) : communityLineups.length === 0 ? (
              /* Clean empty state - ZERO fake demo data */
              <div className="py-12 px-4 text-center bg-[#09100b] rounded-xl border border-[#1f2d22] space-y-3">
                <span className="text-3xl block">📋</span>
                <h4 className="text-sm font-bold text-white">Nenhuma escalação compartilhada no mural ainda.</h4>
                <p className="text-xs text-[#7e9486] max-w-md mx-auto">
                  Seja o primeiro vascaíno a montar sua formação na prancheta e publicar a foto do time para toda a torcida curtir!
                </p>
                {siteSettings.tacticsVisible && (
                  <button
                    onClick={onOpenTactics}
                    className="mt-2 px-4 py-2 bg-[#1b6b3b] hover:bg-[#23874b] text-white rounded-lg text-xs font-black transition cursor-pointer"
                  >
                    {currentUser
                      ? 'Abrir Prancheta e Montar Minha Escalação'
                      : '🔒 Entrar com Google e Montar Minha Escalação'}
                  </button>
                )}
              </div>
            ) : (
              /* Genuine user photo cards */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {communityLineups.map((lineup) => {
                  const canDelete =
                    isAdmin ||
                    (Boolean(currentUser?.id) && currentUser?.id === lineup.authorUid);

                  return (
                    <div
                      key={lineup.id}
                      className="bg-[#141d16] border border-[#29382e] hover:border-[#3e5445] rounded-xl p-4 transition shadow-md flex flex-col justify-between space-y-3"
                    >
                      {/* Photo Header: Author & Timestamp */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#d62839] text-white flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden">
                            {lineup.authorAvatar ? (
                              <img src={lineup.authorAvatar} alt={lineup.author} className="w-full h-full object-cover" />
                            ) : (
                              lineup.author.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block leading-tight">
                              {lineup.author}
                            </span>
                            <span className="text-[10px] text-[#788e80]">
                              {new Date(lineup.publishedAt).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-black text-[#58df8a] uppercase tracking-wider bg-[#163622] px-2 py-0.5 rounded border border-[#255e39]">
                          {lineup.formation || '4-3-3'}
                        </span>
                      </div>

                      {/* Pitch Photo Snapshot (Immutable View) */}
                      <div
                        onClick={() => setPreviewPhotoLineup(lineup)}
                        className="relative aspect-video w-full rounded-lg overflow-hidden bg-black border border-[#28382c] cursor-pointer group shadow"
                      >
                        {lineup.imageUrl ? (
                          <img
                            src={lineup.imageUrl}
                            alt={lineup.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          /* Visual fallback representation of field if old item */
                          <div className="w-full h-full bg-[#356d48] flex flex-col items-center justify-center p-2 text-center">
                            <span className="text-2xl mb-1">⚽</span>
                            <span className="text-xs font-bold text-white drop-shadow">
                              Foto da Escalação
                            </span>
                            <span className="text-[10px] text-[#c5ded0]">Clique para visualizar</span>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-bold text-white gap-1.5">
                          <span>🔍</span>
                          <span>Ampliar Foto do Campo</span>
                        </div>
                      </div>

                      {/* Card Info */}
                      <div>
                        <h4 className="text-sm font-bold text-white leading-tight">
                          {lineup.title}
                        </h4>
                        <span className="text-[11px] text-[#8ea294] block mt-0.5">
                          vs {lineup.opponentClub || 'Adversário Geral'}
                        </span>
                      </div>

                      {/* Actions: Reaction & Delete (No editing allowed) */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#1f2b22] text-xs">
                        <button
                          onClick={(e) => handleLike(lineup.id, e)}
                          className="flex items-center gap-1 text-[#ff7886] hover:text-[#ff99a4] font-bold transition px-2.5 py-1 rounded bg-[#2b171a] border border-[#52252a] cursor-pointer"
                        >
                          <span>❤️</span>
                          <span>{lineup.likes} curtidas</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreviewPhotoLineup(lineup)}
                            className="px-2.5 py-1 bg-[#1a2d1f] hover:bg-[#25422d] text-[#86e2a2] border border-[#3b734d] rounded font-bold transition cursor-pointer text-[11px]"
                          >
                            Ver Foto ↗
                          </button>

                          {canDelete && (
                            <button
                              onClick={(e) => handleDeleteLineup(lineup.id, e)}
                              className={`px-2 py-1 rounded font-bold transition cursor-pointer text-[11px] border ${
                                confirmDeleteId === lineup.id
                                  ? 'bg-[#c91f32] text-white border-[#ff808e]'
                                  : 'bg-[#261517] hover:bg-[#3d191d] text-[#ff808e] border-[#542429]'
                              }`}
                              title={
                                confirmDeleteId === lineup.id
                                  ? 'Clique novamente para confirmar a exclusão'
                                  : 'Remover publicação'
                              }
                            >
                              {confirmDeleteId === lineup.id ? 'Confirmar?' : 'Remover'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Section D: Kick.com Highlights Banner */}
        {siteSettings.kickBannerVisible && (
          <section className="bg-gradient-to-r from-[#0d1c10] via-[#102414] to-[#0a170d] border border-[#305437] rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-5 shadow-xl">
            <div className="flex items-center gap-4 text-center md:text-left">
              <div className="w-14 h-14 rounded-2xl bg-black border-2 border-[#53fc18] flex items-center justify-center font-black text-2xl text-[#53fc18] shadow-[0_0_15px_rgba(83,252,24,0.3)] flex-none">
                K
              </div>
              <div>
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <h3 className="text-lg font-black text-white">Canal Fala Vascão na Kick</h3>
                  <span className="px-1.5 py-0.5 bg-[#53fc18] text-black text-[9px] font-black rounded uppercase">
                    Ao Vivo
                  </span>
                </div>
                <p className="text-xs text-[#9eb5a5] max-w-lg mt-0.5">
                  Transmissões alternativas sem travas e bate-papo exclusivo com os seguidores. Siga também na Kick!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://kick.com/falavascao"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-[#53fc18] hover:bg-[#68ff33] text-black font-black text-xs rounded-lg transition shadow flex items-center gap-1.5"
              >
                <span>Acessar Canal na Kick</span>
                <span>↗</span>
              </a>
              <a
                href="https://kick.com/falavascao/videos"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-[#172719] hover:bg-[#203623] border border-[#3d5e41] text-[#bfe0c7] font-bold text-xs rounded-lg transition"
              >
                Vídeos Gravados
              </a>
            </div>
          </section>
        )}
      </main>

      {/* 3. Footer */}
      <footer className="border-t border-[#1f2b22] bg-[#090e0b] px-4 py-8 text-center text-xs text-[#7d9184] space-y-3">
        <div className="flex items-center justify-center gap-4 font-bold text-[#b4c7bb]">
          <a href="https://www.youtube.com/@FalaVascao1" target="_blank" rel="noreferrer" className="hover:text-white">
            YouTube
          </a>
          <span>•</span>
          <a href="https://kick.com/falavascao" target="_blank" rel="noreferrer" className="hover:text-white">
            Kick
          </a>
          <span>•</span>
          <a href="https://falavascao.lojavirtualnuvem.com.br/produtos/caneca-personalizada-fala-vascao/" target="_blank" rel="noreferrer" className="hover:text-white">
            Loja Oficial
          </a>
          {siteSettings.tacticsVisible && (
            <>
              <span>•</span>
              <button onClick={onOpenTactics} className="hover:text-white cursor-pointer font-bold text-[#55db88]">
                {currentUser ? 'Prancheta Tática PRO' : '🔒 Prancheta Tática PRO (Login Google)'}
              </button>
            </>
          )}
        </div>
        <p className="text-[11px] text-[#63756a]">
          Fala Vascão © 2026 • Feito para a Torcida Vascaína mais apaixonada do Brasil. Todos os direitos reservados.
        </p>
      </footer>

      {/* Lightbox / Zoom Photo Modal (Immutable View - Cannot be altered) */}
      {previewPhotoLineup && (
        <div
          onClick={() => setPreviewPhotoLineup(null)}
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl bg-[#0c140e] border border-[#394f3e] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Modal Header */}
            <div className="p-4 bg-[#111a13] border-b border-[#243527] flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">{previewPhotoLineup.title}</h3>
                <span className="text-xs text-[#8ca092]">
                  Foto publicada por <b>{previewPhotoLineup.author}</b> • Formação {previewPhotoLineup.formation} vs {previewPhotoLineup.opponentClub}
                </span>
              </div>
              <button
                onClick={() => setPreviewPhotoLineup(null)}
                className="w-8 h-8 rounded-lg bg-[#1a291f] hover:bg-[#283e2f] text-gray-300 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Photo Container */}
            <div className="p-3 bg-black flex items-center justify-center overflow-hidden">
              {previewPhotoLineup.imageUrl ? (
                <img
                  src={previewPhotoLineup.imageUrl}
                  alt={previewPhotoLineup.title}
                  className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
                />
              ) : (
                <div className="py-24 text-center text-gray-400">
                  Foto da escalação protegida
                </div>
              )}
            </div>

            {/* Modal Footer Note */}
            <div className="p-3 bg-[#0d140f] border-t border-[#1f2d22] flex items-center justify-between text-xs text-[#8ca092]">
              <span className="italic">
                🛡️ Esta publicação é uma foto estática oficial do membro e não pode ser editada.
              </span>
              <button
                onClick={() => setPreviewPhotoLineup(null)}
                className="px-3 py-1 bg-[#18261c] hover:bg-[#243a2b] text-white rounded font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { CommunityLineup, storage } from '../../data/storage';

interface YouTubeVideo {
  id: string;
  title: string;
  published: string;
  thumb: string;
  views: number;
  url: string;
  isLive: boolean;
  isShort: boolean;
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
  lastUpdated: string;
}

interface PortalViewProps {
  onOpenTactics: () => void;
  onLoadCommunityLineup: (lineup: CommunityLineup) => void;
}

export const PortalView: React.FC<PortalViewProps> = ({
  onOpenTactics,
  onLoadCommunityLineup
}) => {
  const [channelData, setChannelData] = useState<YouTubeChannelData | null>(null);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'lives' | 'shorts'>('all');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  // Community Mural State
  const [communityLineups, setCommunityLineups] = useState<CommunityLineup[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/youtube/videos');
        if (res.ok) {
          const data = await res.json();
          setChannelData(data);
          if (data.videos?.length > 0) {
            // Pick latest or live video
            const live = data.videos.find((v: YouTubeVideo) => v.isLive);
            setSelectedVideoId(live ? live.id : data.videos[0].id);
          }
        }
      } catch (e) {
        console.warn('Error loading YouTube data', e);
      } finally {
        setLoadingVideos(false);
      }

      try {
        const murals = await storage.getCommunityLineups();
        setCommunityLineups(murals);
      } catch (e) {
        console.warn('Error loading community lineups', e);
      } finally {
        setLoadingCommunity(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 60000); // 1-minute auto refresh
    return () => clearInterval(interval);
  }, []);

  const handleLike = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newLikes = await storage.likeCommunityLineup(id);
    if (newLikes !== null) {
      setCommunityLineups((prev) =>
        prev.map((l) => (l.id === id ? { ...l, likes: newLikes } : l))
      );
    }
  };

  const videos = channelData?.videos || [];
  const latestLive = videos.find((v) => v.isLive) || videos[0];
  const filteredVideos = videos.filter((v) => {
    if (activeTab === 'lives') return v.isLive;
    if (activeTab === 'shorts') return v.isShort;
    return true;
  });

  return (
    <div className="w-full h-full overflow-y-auto bg-[#070b08] text-[#f0f3f1] font-sans scrollbar-thin">
      {/* 1. Portal Hero Header */}
      <header className="relative bg-gradient-to-b from-[#141d16] via-[#0d140f] to-[#070b08] border-b border-[#243127] px-4 py-6 md:px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo & Channel Info */}
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-3 border-[#d62839] shadow-[0_0_25px_rgba(214,40,57,0.4)] flex-none bg-black">
              <img
                src="/assets/campo.png"
                alt="Logo Fala Vascão"
                className="w-full h-full object-cover scale-150"
              />
            </div>
            <div>
              <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                <h1 className="text-2xl md:text-3xl font-black tracking-wider text-white uppercase drop-shadow">
                  Fala Vascão
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-black bg-[#d62839] text-white rounded-full tracking-wider animate-pulse">
                  AO VIVO & ANÁLISES
                </span>
              </div>
              <p className="text-xs md:text-sm text-[#9db0a3] max-w-xl">
                O canal oficial da torcida vascaína. Análises táticas ao vivo, transmissões, notícias e interação com os membros.
              </p>

              {/* Social Badges */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3">
                <a
                  href="https://www.youtube.com/@FalaVascao1"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 bg-[#cc0000] hover:bg-[#ff1a1a] text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition shadow"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  <span>YouTube @FalaVascao1</span>
                </a>

                <a
                  href="https://kick.com/falavascao"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 bg-[#53fc18] hover:bg-[#68ff33] text-black rounded-md text-xs font-black flex items-center gap-1.5 transition shadow"
                >
                  <span className="font-extrabold text-[13px]">K</span>
                  <span>Kick /falavascao</span>
                </a>

                <a
                  href="https://falavascao.lojavirtualnuvem.com.br/produtos/caneca-personalizada-fala-vascao/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 bg-[#1a281f] hover:bg-[#25392c] border border-[#3f5746] text-[#bce0ca] rounded-md text-xs font-bold transition"
                >
                  ☕ Loja Oficial
                </a>
              </div>
            </div>
          </div>

          {/* Quick Access to Tactical Board Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onOpenTactics}
              className="px-6 py-3.5 bg-gradient-to-r from-[#d62839] to-[#9e1b29] hover:from-[#ff384d] hover:to-[#b81d2e] text-white rounded-xl font-black text-sm md:text-base tracking-wider shadow-[0_0_20px_rgba(214,40,57,0.5)] flex items-center gap-2.5 transition active:scale-95 cursor-pointer border border-[#ff6675]"
            >
              <span className="text-xl">⚽</span>
              <span>ABRIR PRANCHETA TÁTICA</span>
            </button>
            <span className="text-[11px] text-[#86998d]">Ferramenta oficial de análises e jogadas</span>
          </div>
        </div>
      </header>

      {/* 2. Main Portal Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* Section A: Live Stream / Featured Video Player */}
        {latestLive && (
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
                <button
                  onClick={onOpenTactics}
                  className="px-2.5 py-1 bg-[#192b1e] hover:bg-[#253f2c] border border-[#3c6b48] text-[#8ee3a4] rounded font-bold transition cursor-pointer"
                >
                  Abrir Prancheta ⚽
                </button>
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
                <div className="p-3 bg-gradient-to-r from-[#172b1d] to-[#122116] border border-[#33593b] rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black text-white">Prancheta Vascaina PRO</div>
                    <div className="text-[10px] text-[#86a892]">Simule as jogadas comentadas na live</div>
                  </div>
                  <button
                    onClick={onOpenTactics}
                    className="px-3 py-1.5 bg-[#1b6b3b] hover:bg-[#23874b] text-white text-xs font-black rounded-lg transition shadow cursor-pointer"
                  >
                    Desenhar
                  </button>
                </div>
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
            <div className="flex items-center gap-1.5 bg-[#121a14] p-1 rounded-lg border border-[#26352b] text-xs font-bold">
              <button
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
                onClick={() => setActiveTab('lives')}
                className={`px-3 py-1 rounded transition cursor-pointer ${
                  activeTab === 'lives'
                    ? 'bg-[#d62839] text-white shadow'
                    : 'text-[#90a397] hover:text-white'
                }`}
              >
                🔴 Transmissões
              </button>
              <button
                onClick={() => setActiveTab('shorts')}
                className={`px-3 py-1 rounded transition cursor-pointer ${
                  activeTab === 'shorts'
                    ? 'bg-[#d62839] text-white shadow'
                    : 'text-[#90a397] hover:text-white'
                }`}
              >
                📱 Shorts
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                        ? 'border-[#d62839] ring-2 ring-[#d62839]/40'
                        : 'border-[#26352b] hover:border-[#3d5244]'
                    }`}
                  >
                    {/* Thumbnail Container */}
                    <div className="relative aspect-video w-full overflow-hidden bg-black">
                      <img
                        src={video.thumb}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      {video.isLive && (
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-red-600 text-white font-black text-[9px] rounded uppercase shadow tracking-wider">
                          AO VIVO
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center text-lg shadow-lg">
                          ▶
                        </span>
                      </div>
                    </div>

                    {/* Card Meta */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-[#ff7886] transition">
                        {video.title}
                      </h4>
                      <div className="flex items-center justify-between text-[10px] text-[#7a8c81] mt-2 pt-2 border-t border-[#1d2720]">
                        <span>{video.published.slice(0, 10)}</span>
                        <span className="font-bold text-[#a7baaef0]">Assistir no Portal</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section C: Mural da Torcida (Community Lineups) */}
        <section className="bg-[#0f1712] border border-[#2b3a30] rounded-2xl p-5 md:p-7 shadow-xl space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#212d25]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">👥</span>
                <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-wider">
                  Mural da Torcida • Escalações dos Membros
                </h2>
              </div>
              <p className="text-xs text-[#8ea195]">
                Veja como outros torcedores vascaínos escalariam o time. Curta as melhores formações e carregue direto na prancheta!
              </p>
            </div>

            <button
              onClick={onOpenTactics}
              className="px-4 py-2 bg-[#1b6b3b] hover:bg-[#23874b] text-white rounded-lg font-black text-xs flex items-center gap-1.5 transition shadow cursor-pointer"
            >
              <span>＋</span>
              <span>Montar Minha Escalação</span>
            </button>
          </div>

          {loadingCommunity ? (
            <div className="py-8 text-center text-[#7e9185]">
              Carregando escalações da torcida...
            </div>
          ) : communityLineups.length === 0 ? (
            <div className="py-8 text-center text-[#7e9185]">
              Nenhuma escalação compartilhada ainda. Seja o primeiro a publicar sua formação!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {communityLineups.map((lineup) => (
                <div
                  key={lineup.id}
                  className="bg-[#141d16] border border-[#29382e] hover:border-[#3e5445] rounded-xl p-4 transition shadow-md flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black text-[#58df8a] uppercase tracking-wider bg-[#163622] px-2 py-0.5 rounded border border-[#255e39]">
                        {lineup.formation || '4-3-3'}
                      </span>
                      <span className="text-[10px] text-[#7d9183]">
                        vs {lineup.opponentClub || 'Geral'}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white leading-tight">
                      {lineup.title}
                    </h4>
                    <span className="text-[11px] text-[#93a69a] block mt-0.5">
                      Por: <b>{lineup.author}</b>
                    </span>
                  </div>

                  {/* Players preview chips */}
                  <div className="flex flex-wrap gap-1 py-1">
                    {lineup.players.slice(0, 7).map((p, pIdx) => (
                      <span
                        key={pIdx}
                        className="text-[9px] bg-[#1a251d] text-[#c0d1c7] px-1.5 py-0.5 rounded border border-[#2b3c2f]"
                      >
                        {p.name}
                      </span>
                    ))}
                    {lineup.players.length > 7 && (
                      <span className="text-[9px] text-[#697d70] px-1 py-0.5">
                        +{lineup.players.length - 7}
                      </span>
                    )}
                  </div>

                  {/* Actions: Like and Load onto Board */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#1f2b22] text-xs">
                    <button
                      onClick={(e) => handleLike(lineup.id, e)}
                      className="flex items-center gap-1 text-[#ff7886] hover:text-[#ff99a4] font-bold transition px-2 py-1 rounded bg-[#2b171a] border border-[#52252a] cursor-pointer"
                    >
                      <span>❤️</span>
                      <span>{lineup.likes}</span>
                    </button>

                    <button
                      onClick={() => {
                        onLoadCommunityLineup(lineup);
                        onOpenTactics();
                      }}
                      className="px-3 py-1 bg-[#1a3824] hover:bg-[#244f32] text-[#86e2a2] border border-[#3b734d] rounded font-bold transition cursor-pointer"
                    >
                      Abrir na Prancheta ↗
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section D: Kick.com Highlights Banner */}
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
          <span>•</span>
          <button onClick={onOpenTactics} className="hover:text-white cursor-pointer font-bold text-[#55db88]">
            Prancheta Tática PRO
          </button>
        </div>
        <p className="text-[11px] text-[#63756a]">
          Fala Vascão © 2026 • Feito para a Torcida Vascaína mais apaixonada do Brasil. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
};

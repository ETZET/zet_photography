import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Instagram, Mail, LogOut, Settings } from 'lucide-react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import ScrollableGallery from './components/ScrollableGallery';
import PhotoViewer from './components/PhotoViewer';
import AboutPage from './components/AboutPage';
import LoginPage from './components/LoginPage';
import GalleryManagement from './components/GalleryManagement';
// Games are code-split so the photo site doesn't pay for them.
const GamesPage = lazy(() => import('./games/GamesPage'));
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { initializePhotoSeries } from './data/photoSeries';
import { useRoute, navigate } from './route';

// Create a client with optimized settings for S3 presigned URLs
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Presigned URLs are valid for 5 minutes (300s), so we set staleTime accordingly
      staleTime: 4 * 60 * 1000, // 4 minutes (1 min buffer before expiry)
      cacheTime: 5 * 60 * 1000, // 5 minutes (match presigned URL expiry)
      refetchOnWindowFocus: false, // Don't refetch on window focus (URLs are still valid)
      refetchOnReconnect: false, // Don't refetch on reconnect (URLs are still valid)
      retry: 1, // Retry once if failed
    },
  },
});

const AppContent = () => {
  const queryClient = useQueryClient();
  const { isAuthenticated, logout } = useAuth();
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [currentSeriesPhotos, setCurrentSeriesPhotos] = useState([]);
  const [photoSeries, setPhotoSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  // Pages live in the URL path (/about, /game/werewolf/ABCD …) — see route.js.
  const route = useRoute();
  const currentPage = route.page;
  const currentGame = route.game;
  const setCurrentPage = page => navigate({ page });
  const setCurrentGame = game => navigate({ page: 'game', game });
  const inGame = currentPage === 'game';
  const hoverCls = inGame ? 'hover:text-white' : 'hover:text-gray-600';

  const loadPhotoSeriesData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      console.log(`[APP] ========== Loading photo series data (forceRefresh: ${forceRefresh}) ==========`);
      const series = await initializePhotoSeries(forceRefresh);

      // Filter out hidden series for the main gallery
      const visibleSeries = series
        .filter(s => !s.isHidden)
        // Also strip per-image hidden photos from the public view.
        // Strip from both `images` (legacy callers) and `photos` (current callers).
        .map(s => {
          const hiddenSet = new Set(s.hiddenImages ?? []);
          if (hiddenSet.size === 0) return s;
          return {
            ...s,
            images: (s.images ?? []).filter(img => !hiddenSet.has(img)),
            photos: (s.photos ?? []).filter(p => !hiddenSet.has(p.filename) && !p.hidden),
          };
        });

      console.log(`[APP] After visibility filter - Total series: ${series.length}, Visible: ${visibleSeries.length}`);
      const hiddenPhotoCount = series.reduce((sum, s) => sum + (s.hiddenImages?.length ?? 0), 0);
      if (hiddenPhotoCount > 0) {
        console.log(`[APP] Filtered out ${hiddenPhotoCount} hidden photo(s) across all series`);
      }

      setPhotoSeries(visibleSeries);
    } catch (error) {
      console.error('[APP] Error loading photo series:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPhotoSeriesData();
  }, [loadPhotoSeriesData]);

  // Function to refresh data (can be called from management page)
  useEffect(() => {
    const handleRefresh = (event) => {
      console.log('Refreshing photo series data...');
      // Invalidate all presigned URL caches
      console.log('[React Query] Invalidating all presigned URL queries');
      queryClient.invalidateQueries({ queryKey: ['presigned-url'] });
      // DynamoDB has strong consistency - no delay or force refresh needed
      loadPhotoSeriesData();
    };

    // Listen for custom refresh events
    window.addEventListener('refreshPhotoSeries', handleRefresh);
    return () => window.removeEventListener('refreshPhotoSeries', handleRefresh);
  }, [loadPhotoSeriesData, queryClient]);
  
  const handlePhotoClick = (photo, seriesPhotos) => {
    setSelectedPhoto(photo);
    setCurrentSeriesPhotos(seriesPhotos);
  };
  
  const handleClose = () => {
    setSelectedPhoto(null);
    setCurrentSeriesPhotos([]);
  };
  
  const handleNext = () => {
    const currentIndex = currentSeriesPhotos.findIndex(p => p.id === selectedPhoto.id);
    const nextIndex = (currentIndex + 1) % currentSeriesPhotos.length;
    setSelectedPhoto(currentSeriesPhotos[nextIndex]);
  };
  
  const handlePrev = () => {
    const currentIndex = currentSeriesPhotos.findIndex(p => p.id === selectedPhoto.id);
    const prevIndex = (currentIndex - 1 + currentSeriesPhotos.length) % currentSeriesPhotos.length;
    setSelectedPhoto(currentSeriesPhotos[prevIndex]);
  };

  // Only the gallery needs to wait for series data.
  if (loading && currentPage === 'work') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-2xl">Loading galleries...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${inGame ? 'bg-[#0e0a1c] text-[#d9d2f2]' : 'bg-white'}`}>
      {/* Consistent header; in the game area it turns night-dark and slim so the table fits on a phone */}
      <header className={`${inGame ? 'px-4 py-2 sm:p-4 gap-x-4 justify-end sm:justify-between' : 'p-6 gap-y-3 justify-between'} flex flex-wrap items-center max-w-7xl mx-auto`}>
        <h1 
          className={`${inGame ? 'hidden sm:block text-xl' : 'text-xl sm:text-2xl'} font-light cursor-pointer`} 
          onClick={() => setCurrentPage('work')}
        >
          Enting Zhou Photography
        </h1>
        <nav className={`flex ${inGame ? 'gap-3 sm:gap-6 text-sm sm:text-base' : 'gap-4 sm:gap-8'} items-center`}>
          <button 
            onClick={() => setCurrentPage('work')}
            className={`${hoverCls} transition-colors ${currentPage === 'work' ? 'font-medium' : ''}`}
          >
            WORK
          </button>
          <button 
            onClick={() => setCurrentPage('about')}
            className={`${hoverCls} transition-colors ${currentPage === 'about' ? 'font-medium' : ''}`}
          >
            ABOUT
          </button>
          <button 
            onClick={() => setCurrentPage('game')}
            className={`${hoverCls} transition-colors ${currentPage === 'game' ? 'font-medium' : ''}`}
          >
            GAME
          </button>
          {isAuthenticated && (
            <button 
              onClick={() => setCurrentPage('manage')}
              className={`${hoverCls} transition-colors ${currentPage === 'manage' ? 'font-medium' : ''}`}
            >
              MANAGE
            </button>
          )}
          <div className="flex gap-4 items-center">
            <a href="https://www.instagram.com/e_t_photo/" className={`${hoverCls} transition-colors`}>
              <Instagram size={20} />
            </a>
            <a href="mailto:etetzet@outlook.com" className={`${hoverCls} transition-colors`}>
              <Mail size={20} />
            </a>
            {isAuthenticated && (
              <button
                onClick={logout}
                className={`${hoverCls} transition-colors p-1`}
                aria-label="Logout"
              >
                <LogOut size={20} />
              </button>
            )}
          </div>
        </nav>
      </header>

      {currentPage === 'about' ? (
        <AboutPage onNavigateToLogin={() => setCurrentPage('login')} />
      ) : currentPage === 'login' || (currentPage === 'manage' && !isAuthenticated) ? (
        <LoginPage 
          onBack={() => setCurrentPage('about')} 
          onLoginSuccess={() => currentPage === 'manage' || setCurrentPage('work')}
        />
      ) : currentPage === 'game' ? (
        <Suspense fallback={<div className="min-h-[60vh] bg-[#0e0a1c]" />}>
          <GamesPage gameId={currentGame} onSelectGame={setCurrentGame} />
        </Suspense>
      ) : currentPage === 'manage' ? (
        <GalleryManagement />
      ) : (
        <>
          <div className="max-w-4xl mx-auto px-6 py-12">
            <h2 className="text-4xl font-light leading-tight">
              What does the world look like when you take a step closer or a step back?
            </h2>
          </div>

          <div className="max-w-7xl mx-auto px-6 py-12">
            {photoSeries.map((series) => (
              <ScrollableGallery
                key={series.id}
                series={series}
                onPhotoClick={handlePhotoClick}
              />
            ))}
          </div>
        </>
      )}

      <PhotoViewer
        photo={selectedPhoto}
        photos={currentSeriesPhotos}
        onClose={handleClose}
        onNext={handleNext}
        onPrev={handlePrev}
      />
    </div>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
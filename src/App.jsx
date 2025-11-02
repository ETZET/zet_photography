import React, { useState, useEffect, useCallback } from 'react';
import { Instagram, Mail, LogOut, Settings } from 'lucide-react';
import ScrollableGallery from './components/ScrollableGallery';
import PhotoViewer from './components/PhotoViewer';
import AboutPage from './components/AboutPage';
import LoginPage from './components/LoginPage';
import GalleryManagement from './components/GalleryManagement';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { URLCacheProvider } from './contexts/URLCacheContext.jsx';
import { initializePhotoSeries } from './data/photoSeries';

const AppContent = () => {
  const { isAuthenticated, logout } = useAuth();
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [currentSeriesPhotos, setCurrentSeriesPhotos] = useState([]);
  const [photoSeries, setPhotoSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('work'); // 'work', 'about', 'login', or 'manage'

  const loadPhotoSeriesData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      console.log(`[APP] ========== Loading photo series data (forceRefresh: ${forceRefresh}) ==========`);
      const series = await initializePhotoSeries(forceRefresh);
      console.log(`[APP] Raw series data received:`, series.map(s => ({
        id: s.id,
        title: s.title,
        isHidden: s.isHidden,
        imageCount: s.images?.length || 0,
        photoCount: s.photos?.length || 0
      })));

      // Filter out hidden series for the main gallery
      const visibleSeries = series.filter(s => !s.isHidden);
      console.log(`[APP] After visibility filter - Total: ${series.length}, Visible: ${visibleSeries.length}, Hidden: ${series.length - visibleSeries.length}`);
      console.log(`[APP] Visible series:`, visibleSeries.map(s => ({ id: s.id, title: s.title, isHidden: s.isHidden })));
      console.log(`[APP] Hidden series:`, series.filter(s => s.isHidden).map(s => ({ id: s.id, title: s.title, isHidden: s.isHidden })));

      setPhotoSeries(visibleSeries);
      console.log(`[APP] Photo series state updated with ${visibleSeries.length} visible series`);
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
      // DynamoDB has strong consistency - no delay or force refresh needed
      loadPhotoSeriesData();
    };

    // Listen for custom refresh events
    window.addEventListener('refreshPhotoSeries', handleRefresh);
    return () => window.removeEventListener('refreshPhotoSeries', handleRefresh);
  }, [loadPhotoSeriesData]);
  
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-2xl">Loading galleries...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Consistent Header for both pages */}
      <header className="p-6 flex justify-between items-center max-w-7xl mx-auto">
        <h1 
          className="text-2xl font-light cursor-pointer" 
          onClick={() => setCurrentPage('work')}
        >
          Enting Zhou Photography
        </h1>
        <nav className="flex gap-8 items-center">
          <button 
            onClick={() => setCurrentPage('work')}
            className={`hover:text-gray-600 transition-colors ${currentPage === 'work' ? 'font-medium' : ''}`}
          >
            WORK
          </button>
          <button 
            onClick={() => setCurrentPage('about')}
            className={`hover:text-gray-600 transition-colors ${currentPage === 'about' ? 'font-medium' : ''}`}
          >
            ABOUT
          </button>
          {isAuthenticated && (
            <button 
              onClick={() => setCurrentPage('manage')}
              className={`hover:text-gray-600 transition-colors ${currentPage === 'manage' ? 'font-medium' : ''}`}
            >
              MANAGE
            </button>
          )}
          <div className="flex gap-4 items-center">
            <a href="https://www.instagram.com/e_t_photo/" className="hover:text-gray-600 transition-colors">
              <Instagram size={20} />
            </a>
            <a href="mailto:etetzet@outlook.com" className="hover:text-gray-600 transition-colors">
              <Mail size={20} />
            </a>
            {isAuthenticated && (
              <button
                onClick={logout}
                className="hover:text-gray-600 transition-colors p-1"
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
      ) : currentPage === 'login' ? (
        <LoginPage 
          onBack={() => setCurrentPage('about')} 
          onLoginSuccess={() => setCurrentPage('work')}
        />
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
    <AuthProvider>
      <URLCacheProvider>
        <AppContent />
      </URLCacheProvider>
    </AuthProvider>
  );
};

export default App;
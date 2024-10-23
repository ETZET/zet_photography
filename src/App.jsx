import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Instagram, Mail } from 'lucide-react';
import ScrollableGallery from './components/ScrollableGallery';
import PhotoViewer from './components/PhotoViewer';
import { initializePhotoSeries } from './data/photoSeries';

const App = () => {
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [currentSeriesPhotos, setCurrentSeriesPhotos] = useState([]);
  const [photoSeries, setPhotoSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPhotoSeries = async () => {
      try {
        const series = await initializePhotoSeries();
        setPhotoSeries(series);
      } catch (error) {
        console.error('Error loading photo series:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPhotoSeries();
  }, []);
  
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
      <header className="p-6 flex justify-between items-center max-w-7xl mx-auto">
        <h1 className="text-2xl font-light">ZET Photography</h1>
        <nav className="flex gap-8 items-center">
          <a href="#work" className="hover:text-gray-600">WORK</a>
          <a href="#about" className="hover:text-gray-600">ABOUT</a>
          <div className="flex gap-4">
            <a href="https://instagram.com" className="hover:text-gray-600">
              <Instagram size={20} />
            </a>
            <a href="mailto:your@email.com" className="hover:text-gray-600">
              <Mail size={20} />
            </a>
          </div>
        </nav>
      </header>

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

export default App;
import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getUrl } from 'aws-amplify/storage';
import '@aws-amplify/ui-react/styles.css';


const LazyImage = ({ src, alt, onClick }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [imageSrc, setImageSrc] = useState('');
    const imgRef = useRef();
  
    useEffect(() => {
      const loadImage = async () => {
        try {
          const result = await getUrl({
            key: src,
            options: {
              accessLevel: 'public'
            }
          });
          setImageSrc(result.url);
          setIsLoaded(true);
        } catch (error) {
          console.error('Error loading image:', error);
        }
      };
  
      loadImage();
    }, [src]);
  
    return (
      <div ref={imgRef} className="w-64 h-64 relative">
        {isLoaded ? (
          <img
            src={imageSrc}
            alt={alt}
            className="w-full h-full object-cover cursor-pointer"
            onClick={onClick}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 animate-pulse"></div>
        )}
      </div>
    );
  };
  
  const PhotographyApp = ({ signOut, user }) => {
    console.log('PhotographyApp rendered', { user });
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentSeries, setCurrentSeries] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showLeftButton, setShowLeftButton] = useState({});
  const [showRightButton, setShowRightButton] = useState({});

  const galleryRefs = useRef([]);
  const fullscreenRef = useRef(null);

  // Placeholder for your actual series and images
  const imageSeries = [
    {
      id: 1,
      name: "Urban Landscapes",
      images: [
        { id: 1, src: '/api/placeholder/400/300', alt: 'Urban 1' },
        { id: 2, src: '/api/placeholder/300/400', alt: 'Urban 2' },
        { id: 3, src: '/api/placeholder/400/300', alt: 'Urban 3' },
        { id: 4, src: '/api/placeholder/300/400', alt: 'Urban 4' },
        { id: 5, src: '/api/placeholder/400/300', alt: 'Urban 5' },
      ]
    },
    {
      id: 2,
      name: "Nature Close-ups",
      images: [
        { id: 6, src: '/api/placeholder/400/300', alt: 'Nature 1' },
        { id: 7, src: '/api/placeholder/300/400', alt: 'Nature 2' },
        { id: 8, src: '/api/placeholder/400/300', alt: 'Nature 3' },
        { id: 9, src: '/api/placeholder/300/400', alt: 'Nature 4' },
        { id: 10, src: '/api/placeholder/400/300', alt: 'Nature 5' },
      ]
    },
  ];

  useEffect(() => {
    galleryRefs.current = galleryRefs.current.slice(0, imageSeries.length);
  }, [imageSeries]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedImage) {
        switch (e.key) {
          case 'ArrowLeft':
            handlePrev();
            break;
          case 'ArrowRight':
            handleNext();
            break;
          case 'Escape':
            handleClose();
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, currentSeries, currentIndex]);

  const handleImageClick = (seriesIndex, imageIndex) => {
    setSelectedImage(imageSeries[seriesIndex].images[imageIndex]);
    setCurrentSeries(seriesIndex);
    setCurrentIndex(imageIndex);
  };

  const handleClose = () => {
    setSelectedImage(null);
  };

  const handlePrev = () => {
    const series = imageSeries[currentSeries].images;
    setCurrentIndex((prevIndex) => {
      const newIndex = prevIndex > 0 ? prevIndex - 1 : series.length - 1;
      setSelectedImage(series[newIndex]);
      return newIndex;
    });
  };

  const handleNext = () => {
    const series = imageSeries[currentSeries].images;
    setCurrentIndex((prevIndex) => {
      const newIndex = prevIndex < series.length - 1 ? prevIndex + 1 : 0;
      setSelectedImage(series[newIndex]);
      return newIndex;
    });
  };

  const handleScroll = (direction, index) => {
    const gallery = galleryRefs.current[index];
    const scrollAmount = 300; // Adjust this value as needed
    if (gallery) {
      if (direction === 'left') {
        gallery.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        gallery.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
    updateScrollButtonsVisibility(index);
  };

  const updateScrollButtonsVisibility = (index) => {
    const gallery = galleryRefs.current[index];
    if (gallery) {
      setShowLeftButton(prev => ({ ...prev, [index]: gallery.scrollLeft > 0 }));
      setShowRightButton(prev => ({ ...prev, [index]: gallery.scrollLeft < gallery.scrollWidth - gallery.clientWidth - 1 }));
    }
  };

  const handleTouchStart = (e, index) => {
    galleryRefs.current[index].touchStartX = e.touches[0].clientX;
  };

  const handleTouchMove = (e, index) => {
    if (!galleryRefs.current[index].touchStartX) return;

    const touchEndX = e.touches[0].clientX;
    const diff = galleryRefs.current[index].touchStartX - touchEndX;
    galleryRefs.current[index].scrollLeft += diff;
    galleryRefs.current[index].touchStartX = touchEndX;

    updateScrollButtonsVisibility(index);
  };

  const handleTouchEnd = (index) => {
    galleryRefs.current[index].touchStartX = null;
    updateScrollButtonsVisibility(index);
  };

  const handleMouseEnter = (index) => {
    updateScrollButtonsVisibility(index);
  };

  const handleMouseLeave = () => {
    setShowLeftButton({});
    setShowRightButton({});
  };

  // Fullscreen swipe handlers
  const handleFullscreenTouchStart = (e) => {
    fullscreenRef.current = e.touches[0].clientX;
  };

  const handleFullscreenTouchMove = (e) => {
    if (fullscreenRef.current === null) return;

    const touchEndX = e.touches[0].clientX;
    const diff = fullscreenRef.current - touchEndX;

    if (Math.abs(diff) > 50) { // Threshold for swipe
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
      fullscreenRef.current = null;
    }
  };

  const handleFullscreenTouchEnd = () => {
    fullscreenRef.current = null;
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="flex justify-between items-center p-4">
        <h1 className="text-2xl font-bold">Zet Photography</h1>
        <nav>
          <a href="#work" className="mr-4">WORK</a>
          <a href="#about" className="mr-4">ABOUT</a>
          <button onClick={signOut}>Sign out</button>
        </nav>
      </header>

      {/* Main content */}
      <main className="p-4">
        <h2 className="text-3xl font-bold mb-8">What catches your eye when your surroundings are not loud, fast, crowded, or towering?</h2>
        
        {/* Image galleries */}
        {imageSeries.map((series, seriesIndex) => (
          <div key={series.id} className="mb-8 relative"
               onMouseEnter={() => handleMouseEnter(seriesIndex)}
               onMouseLeave={handleMouseLeave}>
            <h3 className="text-xl font-semibold mb-4">{series.name}</h3>
            <div 
              ref={el => galleryRefs.current[seriesIndex] = el}
              className="overflow-x-auto whitespace-nowrap pb-4 relative" 
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              onTouchStart={(e) => handleTouchStart(e, seriesIndex)}
              onTouchMove={(e) => handleTouchMove(e, seriesIndex)}
              onTouchEnd={() => handleTouchEnd(seriesIndex)}
              onScroll={() => updateScrollButtonsVisibility(seriesIndex)}
            >
              <div className="inline-grid grid-flow-col gap-4">
                {series.images.map((image, imageIndex) => (
                  <LazyImage
                    key={image.id}
                    src={image.src}
                    alt={image.alt}
                    onClick={() => handleImageClick(seriesIndex, imageIndex)}
                  />
                ))}
              </div>
            </div>
            {showLeftButton[seriesIndex] && (
              <button 
                className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-50 p-2 rounded-full"
                onClick={() => handleScroll('left', seriesIndex)}
              >
                <ChevronLeft size={24} />
              </button>
            )}
            {showRightButton[seriesIndex] && (
              <button 
                className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-50 p-2 rounded-full"
                onClick={() => handleScroll('right', seriesIndex)}
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>
        ))}
      </main>

      {/* Fullscreen image view */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center"
          onTouchStart={handleFullscreenTouchStart}
          onTouchMove={handleFullscreenTouchMove}
          onTouchEnd={handleFullscreenTouchEnd}
        >
          <button onClick={handleClose} className="absolute top-4 right-4 text-white">
            <X size={24} />
          </button>
          <button onClick={handlePrev} className="absolute left-4 text-white">
            <ChevronLeft size={24} />
          </button>
          <img src={selectedImage.src} alt={selectedImage.alt} className="max-h-90vh max-w-90vw object-contain" />
          <button onClick={handleNext} className="absolute right-4 text-white">
            <ChevronRight size={24} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PhotographyApp;

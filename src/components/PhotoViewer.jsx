import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getUrl } from 'aws-amplify/storage';

const PhotoViewer = ({ photo, onClose, onNext, onPrev }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Fetch the image URL when photo changes
  useEffect(() => {
    const fetchImageUrl = async () => {
      if (!photo?.src) {
        setImageUrl(null);
        setIsLoaded(false);
        setHasError(false);
        return;
      }

      setIsLoaded(false);
      setHasError(false);

      try {
        const result = await getUrl({
          path: photo.src,
          options: {
            validateObjectExistence: true,
            expiresIn: 3600
          }
        });
        
        setImageUrl(result.url.toString());
        
      } catch (err) {
        console.error('Error getting image URL:', err);
        setHasError(true);
      }
    };

    fetchImageUrl();
  }, [photo?.src]);

  const handleImageLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };
  
  const handleImageError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  if (!photo) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      {/* Close button */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 z-[60]"
        aria-label="Close photo viewer"
      >
        <X size={24} />
      </button>
      
      {/* Previous button */}
      <button 
        onClick={onPrev}
        className="absolute left-4 text-white hover:text-gray-300 z-[60]"
        aria-label="Previous photo"
      >
        <ChevronLeft size={32} />
      </button>
      
      {/* Image container with proper sizing */}
      <div className="relative flex items-center justify-center h-full w-full p-4">
        
        {hasError && (
          <div className="text-red-400 text-xl">Failed to load image</div>
        )}
        
        {imageUrl && !hasError && (
          <img
            src={imageUrl}
            alt={photo.title || "Photo"}
            className={`max-h-[90vh] max-w-[90vw] object-contain transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}
      </div>
      
      {/* Next button */}
      <button 
        onClick={onNext}
        className="absolute right-4 text-white hover:text-gray-300 z-[60]"
        aria-label="Next photo"
      >
        <ChevronRight size={32} />
      </button>
      
    </div>
  );
};

export default PhotoViewer;
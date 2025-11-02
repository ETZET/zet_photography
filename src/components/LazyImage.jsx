import React, { useState, useRef, useEffect } from 'react';
import { usePresignedUrl } from '../hooks/usePresignedUrl';

const LazyImage = ({ src, alt, onClick, useThumbnail = false }) => {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imageRef = useRef(null);

  // Use React Query to fetch and cache the presigned URL
  const { data, isLoading, error, isError } = usePresignedUrl(
    isInView ? src : null, // Only fetch when in view
    useThumbnail
  );

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.1
      }
    );

    const currentRef = imageRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, []);

  // Handle image load error
  const handleImageError = (e) => {
    console.error('Image failed to load:', e);
    setIsLoaded(false);
  };

  if (isError && !isLoading) {
    return (
      <div className="w-full h-full bg-red-100 flex items-center justify-center text-red-600 text-sm p-4">
        <div className="text-center">
          <div>⚠️ Error loading image</div>
          <div className="text-xs mt-1">{error?.message || 'Unknown error'}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={imageRef}
      className="w-full h-full relative"
      onClick={onClick}
    >
      {/* Actual image */}
      {isInView && data?.url && !isError && (
        <img
          src={data.url}
          alt={alt}
          className={`w-full h-full object-cover cursor-pointer transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => {
            setIsLoaded(true);
          }}
          onError={handleImageError}
          crossOrigin="anonymous"
        />
      )}
    </div>
  );
};

export default LazyImage;

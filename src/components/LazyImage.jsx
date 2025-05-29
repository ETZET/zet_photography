import React, { useState, useRef, useEffect } from 'react';
import { getUrl } from 'aws-amplify/storage';

const LazyImage = ({ src, alt, onClick }) => {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const imageRef = useRef(null);

  // Fetch the image URL when the component mounts or src changes
  useEffect(() => {
    const fetchImageUrl = async () => {
      if (!src) return;

      setLoading(true);
      setError(null);

      try {
        const result = await getUrl({
          path: src,
          options: {
            // Remove accessLevel - it's not used in Gen 2
            validateObjectExistence: true, // Enable this to check if file exists
            expiresIn: 3600 // Optional: set expiration (default is 900 seconds)
          }
        });
        
        setImageUrl(result.url.toString());
        console.log('Image URL fetched successfully:', result.url.toString());
        
      } catch (err) {
        console.error('Error getting image URL:', err);
        setError(err.message || 'Failed to load image');
      } finally {
        setLoading(false);
      }
    };

    fetchImageUrl();
  }, [src]);

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
    setError('Failed to display image');
    setIsLoaded(false);
  };

  if (error && !loading) {
    return (
      <div className="w-full h-full bg-red-100 flex items-center justify-center text-red-600 text-sm p-4">
        <div className="text-center">
          <div>⚠️ Error loading image</div>
          <div className="text-xs mt-1">{error}</div>
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
      {/* Loading placeholder */}
      {(loading || !isInView || !isLoaded || !imageUrl) && (
        <div className="w-full h-full bg-gray-200 animate-pulse absolute top-0 left-0 flex items-center justify-center">
          {loading && (
            <div className="text-gray-500 text-sm">Loading...</div>
          )}
        </div>
      )}
      
      {/* Actual image */}
      {isInView && imageUrl && !error && (
        <img
          src={imageUrl}
          alt={alt}
          className={`w-full h-full object-cover cursor-pointer transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => {
            setIsLoaded(true);
            console.log('Image loaded successfully');
          }}
          onError={handleImageError}
        />
      )}
    </div>
  );
};

export default LazyImage;
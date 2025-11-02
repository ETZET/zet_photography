import React, { useState, useRef, useEffect } from 'react';
import { getUrl } from 'aws-amplify/storage';
import { ThumbnailService } from '../utils/thumbnailService';
import { useURLCache } from '../contexts/URLCacheContext';

const LazyImage = ({ src, alt, onClick, useThumbnail = false }) => {
  const { getCachedUrl, setCachedUrl } = useURLCache();
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cacheVersion, setCacheVersion] = useState(0);
  const imageRef = useRef(null);

  // Listen for global refresh events to invalidate cached URLs
  useEffect(() => {
    const handleRefresh = () => {
      console.log('LazyImage: Invalidating cached image URL for', src);
      setImageUrl(null); // Clear cached URL
      setIsLoaded(false);
      setCacheVersion(v => v + 1); // Force re-fetch
    };

    window.addEventListener('refreshPhotoSeries', handleRefresh);
    return () => window.removeEventListener('refreshPhotoSeries', handleRefresh);
  }, [src]);

  // Fetch the image URL when the component mounts or src changes
  useEffect(() => {
    const fetchImageUrl = async () => {
      if (!src) return;

      setLoading(true);
      setError(null);

      try {
        let pathToLoad = src;
        let finalUrl = null;

        // If thumbnail is requested, try thumbnail first
        if (useThumbnail) {
          const thumbnailPath = ThumbnailService.getThumbnailPath(src);

          // Check cache first for thumbnail
          const cachedThumbnailUrl = getCachedUrl(thumbnailPath);
          if (cachedThumbnailUrl) {
            pathToLoad = thumbnailPath;
            finalUrl = cachedThumbnailUrl;
          } else {
            try {
              // Check if thumbnail exists
              // CRITICAL: Short expiry + useAccelerateEndpoint: false to reduce browser caching
              const thumbnailResult = await getUrl({
                path: thumbnailPath,
                options: {
                  validateObjectExistence: true,
                  expiresIn: 300, // 5 minutes instead of 1 hour
                  useAccelerateEndpoint: false
                }
              });

              pathToLoad = thumbnailPath;
              finalUrl = thumbnailResult.url.toString();
              // Cache the thumbnail URL
              setCachedUrl(thumbnailPath, finalUrl, 300);

            } catch (thumbnailError) {
              console.log('Thumbnail not found, generating from original:', thumbnailPath);

              // Thumbnail doesn't exist, try to generate it
              try {
                await ThumbnailService.generateThumbnailForExistingImage(src);

                // Try loading thumbnail again after generation
                const newThumbnailResult = await getUrl({
                  path: thumbnailPath,
                  options: {
                    validateObjectExistence: true,
                    expiresIn: 300, // 5 minutes
                    useAccelerateEndpoint: false
                  }
                });

                pathToLoad = thumbnailPath;
                finalUrl = newThumbnailResult.url.toString();
                // Cache the newly generated thumbnail URL
                setCachedUrl(thumbnailPath, finalUrl, 300);

              } catch (generationError) {
                console.log('Failed to generate thumbnail, falling back to original:', generationError);
                // Fall back to original image
                pathToLoad = src;
              }
            }
          }
        }

        // If we haven't set a URL yet (either no thumbnail requested or fallback needed)
        if (!finalUrl) {
          // Check cache for original
          const cachedOriginalUrl = getCachedUrl(pathToLoad);
          if (cachedOriginalUrl) {
            finalUrl = cachedOriginalUrl;
          } else {
            const result = await getUrl({
              path: pathToLoad,
              options: {
                validateObjectExistence: true,
                expiresIn: 300, // 5 minutes to reduce browser caching
                useAccelerateEndpoint: false
              }
            });

            finalUrl = result.url.toString();
            // Cache the original URL
            setCachedUrl(pathToLoad, finalUrl, 300);
          }
        }

        setImageUrl(finalUrl);

      } catch (err) {
        console.error('Error getting image URL:', err);
        setError(err.message || 'Failed to load image');
      } finally {
        setLoading(false);
      }
    };

    fetchImageUrl();
  }, [src, useThumbnail, cacheVersion, getCachedUrl, setCachedUrl]); // Re-fetch when cacheVersion changes

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
          }}
          onError={handleImageError}
          crossOrigin="anonymous"
          // Force browser to revalidate instead of using stale cache
          key={`${src}-${cacheVersion}`}
        />
      )}
    </div>
  );
};

export default LazyImage;
import React, { useState, useRef, useEffect } from 'react';
import { getUrl } from 'aws-amplify/storage';
import { ThumbnailService } from '../utils/thumbnailService';

const LazyImage = ({ src, alt, onClick, useThumbnail = false }) => {
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
        let pathToLoad = src;
        
        // If thumbnail is requested, try thumbnail first
        if (useThumbnail) {
          const thumbnailPath = ThumbnailService.getThumbnailPath(src);
          
          try {
            // Check if thumbnail exists
            const thumbnailResult = await getUrl({
              path: thumbnailPath,
              options: {
                validateObjectExistence: true,
                expiresIn: 3600
              }
            });
            
            pathToLoad = thumbnailPath;
            setImageUrl(thumbnailResult.url.toString());
            console.log('Thumbnail URL fetched successfully:', thumbnailResult.url.toString());
            
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
                  expiresIn: 3600
                }
              });
              
              pathToLoad = thumbnailPath;
              setImageUrl(newThumbnailResult.url.toString());
              console.log('Generated thumbnail URL fetched successfully:', newThumbnailResult.url.toString());
              
            } catch (generationError) {
              console.log('Failed to generate thumbnail, falling back to original:', generationError);
              // Fall back to original image
              pathToLoad = src;
            }
          }
        }
        
        // If we haven't set an image URL yet (either no thumbnail requested or fallback needed)
        if (!imageUrl || pathToLoad === src) {
          const result = await getUrl({
            path: pathToLoad,
            options: {
              validateObjectExistence: true,
              expiresIn: 3600
            }
          });
          
          setImageUrl(result.url.toString());
          console.log('Image URL fetched successfully:', result.url.toString());
        }
        
      } catch (err) {
        console.error('Error getting image URL:', err);
        setError(err.message || 'Failed to load image');
      } finally {
        setLoading(false);
      }
    };

    fetchImageUrl();
  }, [src, useThumbnail]);

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
            console.log('Image loaded successfully');
          }}
          onError={handleImageError}
        />
      )}
    </div>
  );
};

export default LazyImage;
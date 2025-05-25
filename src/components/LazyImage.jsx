import React, { useState, useRef, useEffect } from 'react';
import { getUrl } from 'aws-amplify/storage';

const LazyImage = ({ src, alt, onClick }) => {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(null);
  const imageRef = useRef(null);

  // Fetch the image URL when the component mounts
  useEffect(() => {
    const fetchImageUrl = async () => {
      try {
        const { url } = await getUrl({
          key: src,
          options: {
            accessLevel: 'guest',
            validateObjectExistence: false
          }
        });
        setImageUrl(url.toString());
      } catch (err) {
        console.error('Error getting image URL:', err);
        setError(err);
      }
    };

    if (src) {
      fetchImageUrl();
    }
  }, [src]);

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
      }
    );

    if (imageRef.current) {
      observer.observe(imageRef.current);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  if (error) {
    return (
      <div className="w-full h-full bg-red-200 flex items-center justify-center">
        Error loading image
      </div>
    );
  }

  return (
    <div 
      ref={imageRef} 
      className="w-full h-full relative"
      onClick={onClick}
    >
      {(!isInView || !isLoaded || !imageUrl) && (
        <div className="w-full h-full bg-gray-200 animate-pulse absolute top-0 left-0"></div>
      )}
      {isInView && imageUrl && (
        <img
          src={imageUrl}
          alt={alt}
          className={`w-full h-full object-cover cursor-pointer transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setIsLoaded(true)}
        />
      )}
    </div>
  );
};

export default LazyImage;
import React, { useState } from 'react';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import '@aws-amplify/ui-react/styles.css';

const LazyImage = ({ src, alt, onClick }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="w-64 h-64 relative">
      {!isLoaded && (
        <div className="w-full h-full bg-gray-200 animate-pulse absolute top-0 left-0"></div>
      )}
      <StorageImage
        alt={alt}
        path={src}
        className={`w-full h-full object-cover cursor-pointer ${isLoaded ? '' : 'opacity-0'}`}
        onClick={onClick}
        onLoad={() => setIsLoaded(true)}
        errorMessage={(error) => {
          console.error('Error loading image:', error);
          return <div className="w-full h-full bg-red-200 flex items-center justify-center">Error loading image</div>;
        }}
      />
    </div>
  );
};

export default LazyImage;
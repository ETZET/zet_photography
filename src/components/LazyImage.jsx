// import React, { useState } from 'react';
// import { Image } from '@aws-amplify/ui-react';
// import { getUrl } from 'aws-amplify/storage';
// import '@aws-amplify/ui-react/styles.css';

// const LazyImage = ({ src, alt, onClick }) => {
//   const [isLoaded, setIsLoaded] = useState(false);
//   const [imageUrl, setImageUrl] = useState(null);
//   const [error, setError] = useState(null);

//   // Fetch the image URL when the component mounts
//   React.useEffect(() => {
//     const fetchImageUrl = async () => {
//       try {
//         const { url } = await getUrl({
//           key: src,
//           options: {
//             accessLevel: 'public', // or 'private' depending on your needs
//             validateObjectExistence: true
//           }
//         });
//         setImageUrl(url);
//       } catch (err) {
//         console.error('Error getting image URL:', err);
//         setError(err);
//       }
//     };

//     fetchImageUrl();
//   }, [src]);

//   if (error) {
//     return (
//       <div className="w-64 h-64 bg-red-200 flex items-center justify-center">
//         Error loading image
//       </div>
//     );
//   }

//   return (
//     <div className="w-64 h-64 relative">
//       {!isLoaded && (
//         <div className="w-full h-full bg-gray-200 animate-pulse absolute top-0 left-0"></div>
//       )}
//       {imageUrl && (
//         <Image
//           alt={alt}
//           src={imageUrl}
//           className={`w-full h-full object-cover cursor-pointer ${isLoaded ? '' : 'opacity-0'}`}
//           onClick={onClick}
//           onLoad={() => setIsLoaded(true)}
//         />
//       )}
//     </div>
//   );
// };

// export default LazyImage;

import React, { useState, useRef, useEffect } from 'react';
import { getImageDimensions } from '../utils/imageUtils';

const LazyImage = ({ src, alt, onClick }) => {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [dimensions, setDimensions] = useState(null);
  const imageRef = useRef(null);

  useEffect(() => {
    const loadImageDimensions = async () => {
      const dims = await getImageDimensions(src);
      setDimensions(dims);
    };
    loadImageDimensions();
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

  return (
    <div 
      ref={imageRef} 
      className="w-full h-full relative"
      onClick={onClick}
    >
      {(!isInView || !isLoaded) && (
        <div className="w-full h-full bg-gray-200 animate-pulse absolute top-0 left-0"></div>
      )}
      {isInView && dimensions && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover cursor-pointer transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
          onLoad={() => setIsLoaded(true)}
        />
      )}
    </div>
  );
};

export default LazyImage;
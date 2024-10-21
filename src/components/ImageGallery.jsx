import React, { useState, useRef } from 'react';
import { Storage } from 'aws-amplify';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const ImageGallery = ({ series, onImageClick }) => {
  const [images, setImages] = useState([]);
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  React.useEffect(() => {
    const loadImages = async () => {
      const loadedImages = await Promise.all(
        series.images.map(async (image) => {
          try {
            const signedURL = await Storage.get(image.src, { level: 'public' });
            return { ...image, src: signedURL };
          } catch (error) {
            console.error('Error loading image:', error);
            return image;
          }
        })
      );
      setImages(loadedImages);
    };

    loadImages();
  }, [series]);

  const scroll = (scrollOffset) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += scrollOffset;
      updateArrows();
    }
  };

  const updateArrows = () => {
    if (scrollRef.current) {
      setShowLeftArrow(scrollRef.current.scrollLeft > 0);
      setShowRightArrow(
        scrollRef.current.scrollLeft <
        scrollRef.current.scrollWidth - scrollRef.current.clientWidth
      );
    }
  };

  return (
    <div className="mb-8 relative">
      <h3 className="text-xl font-semibold mb-4">{series.name}</h3>
      <div
        className="relative overflow-hidden"
        onScroll={updateArrows}
      >
        {showLeftArrow && (
          <button
            className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-50 p-2 rounded-full z-10"
            onClick={() => scroll(-300)}
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto space-x-4 pb-4 scrollbar-hide"
          style={{ scrollBehavior: 'smooth' }}
        >
          {images.map((image, imageIndex) => (
            <div key={image.id} className="flex-shrink-0 w-64 h-64">
              <img
                src={image.src}
                alt={image.alt}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => onImageClick(series.id, imageIndex)}
                loading="lazy"
              />
            </div>
          ))}
        </div>
        {showRightArrow && (
          <button
            className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-50 p-2 rounded-full z-10"
            onClick={() => scroll(300)}
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ImageGallery;
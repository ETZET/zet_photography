import React, { useRef, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import LazyImage from './LazyImage';
import { getImageDimensions } from '../utils/imageUtils';

const ScrollableGallery = ({ series, onPhotoClick }) => {
  const scrollContainerRef = useRef(null);
  const [photoDimensions, setPhotoDimensions] = useState({});

  useEffect(() => {
    const loadAllDimensions = async () => {
      const dimensions = {};
      for (const photo of series.photos) {
        dimensions[photo.id] = await getImageDimensions(photo.src);
      }
      setPhotoDimensions(dimensions);
    };
    loadAllDimensions();
  }, [series.photos]);

  const scroll = (direction) => {
    const container = scrollContainerRef.current;
    const scrollAmount = container.clientWidth * 0.8;
    const newScrollPosition = container.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
    container.scrollTo({
      left: newScrollPosition,
      behavior: 'smooth'
    });
  };

  return (
    <div className="relative mb-16">
      <h3 className="text-xl font-light mb-4">{series.title}</h3>
      <div className="relative group h-[400px]">
        <button 
          onClick={() => scroll('left')}
          className="absolute left-4 top-[45%] -translate-y-1/2 bg-white bg-opacity-75 rounded-full shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity h-12 w-12 flex items-center justify-center"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        
        <div 
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth h-full"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {series.photos.map((photo) => {
            const dims = photoDimensions[photo.id];
            const width = dims ? (dims.width * 400) / dims.height : 400;
            
            return (
              <div
                key={photo.id}
                className="flex-none first:ml-0"
                style={{
                  width: `${width}px`,
                  height: "100%"
                }}
              >
                <LazyImage
                  src={photo.src}
                  alt={photo.title}
                  onClick={() => onPhotoClick(photo, series.photos)}
                  useThumbnail={true}
                />
              </div>
            );
          })}
        </div>
        
        <button 
          onClick={() => scroll('right')}
          className="absolute right-4 top-[45%] -translate-y-1/2 bg-white bg-opacity-75 rounded-full shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity h-12 w-12 flex items-center justify-center"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default ScrollableGallery;
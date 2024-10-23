import React from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const PhotoViewer = ({ photo, photos, onClose, onNext, onPrev }) => {
  if (!photo) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300"
      >
        <X size={24} />
      </button>
      
      <button 
        onClick={onPrev}
        className="absolute left-4 text-white hover:text-gray-300"
      >
        <ChevronLeft size={32} />
      </button>
      
      <img 
        src={photo.src} 
        alt={photo.title}
        className="max-h-[90vh] max-w-[90vw] object-contain"
      />
      
      <button 
        onClick={onNext}
        className="absolute right-4 text-white hover:text-gray-300"
      >
        <ChevronRight size={32} />
      </button>
    </div>
  );
};

export default PhotoViewer;
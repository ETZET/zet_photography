import React from 'react';
import { Mail } from 'lucide-react';
import LazyImage from './LazyImage';

const About = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex flex-col md:flex-row max-w-7xl mx-auto px-6 py-12 gap-12">
        {/* Left column - Image */}
        <div className="w-full md:w-1/3 h-[300px] md:h-[400px]">
          <LazyImage 
            src="public/images/profile/profile.jpeg" 
            alt="Photographer profile" 
          />
        </div>
        
        {/* Right column - Text content */}
        <div className="w-full md:w-2/3 flex flex-col justify-start">
          <h2 className="text-xl font-light mb-12">Enting Zhou</h2>
          
          <div className="mb-auto">
            <p className="text-base mb-6">
              I am passionate about color film photography, and I print in a color darkroom. 
              My favorite photographer is Koji Onaka.
            </p>
            
            {/* Add more paragraphs about your background, philosophy, etc. */}
            <p className="text-base mb-6">
              {/* Additional bio content can go here */}
            </p>
          </div>
          
          {/* Contact section at bottom */}
          <div className="mt-12">
            <a 
              href="mailto:etetzet@outlook.com" 
              className="inline-flex items-center gap-2 hover:opacity-70"
            >
              Email Me
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
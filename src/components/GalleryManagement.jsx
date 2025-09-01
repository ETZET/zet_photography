import React, { useState, useEffect } from 'react';
import { Upload, Plus, Trash2, Edit, Save, X, RefreshCw } from 'lucide-react';
import { uploadData, list } from 'aws-amplify/storage';
import { initializePhotoSeries, SeriesManager } from '../data/photoSeries';
import { ThumbnailService } from '../utils/thumbnailService';
import LazyImage from './LazyImage';

const GalleryManagement = () => {
  const [photoSeries, setPhotoSeries] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhotoSeries();
  }, []);

  const loadPhotoSeries = async () => {
    try {
      const series = await initializePhotoSeries();
      setPhotoSeries(series);
      if (series.length > 0) {
        setSelectedSeries(series[0]);
      }
    } catch (error) {
      console.error('Error loading photo series:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length || !selectedSeries) return;

    setIsUploading(true);
    const uploadPromises = files.map(async (file, index) => {
      try {
        // Generate unique filename with timestamp
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const fileName = `${selectedSeries.title.toLowerCase().replace(/\s+/g, '')}_${timestamp}_${index}.${fileExtension}`;
        
        // Upload to the selected series' S3 prefix (add public/ prefix)
        const key = `public/${selectedSeries.s3Prefix}/${fileName}`;
        
        // Use ThumbnailService to process upload (uploads both original and thumbnail)
        const result = await ThumbnailService.processImageUpload(file, key);
        console.log('Upload result:', result);

        // Add image to series configuration in S3
        await SeriesManager.addImageToSeries(selectedSeries.id, fileName);

        return {
          fileName,
          originalPath: result.originalPath,
          thumbnailPath: result.thumbnailPath,
          success: true
        };
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        return {
          fileName: file.name,
          error: error.message,
          success: false
        };
      }
    });

    const results = await Promise.all(uploadPromises);
    
    // Show results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (successful.length > 0) {
      console.log('Upload successful, refreshing data...');
      alert(`Successfully uploaded ${successful.length} image(s) to "${selectedSeries.title}"`);
      
      // Refresh the management gallery data
      await loadPhotoSeries();
      
      // Trigger refresh of main gallery
      window.dispatchEvent(new CustomEvent('refreshPhotoSeries'));
    }
    
    if (failed.length > 0) {
      alert(`Failed to upload ${failed.length} image(s). Check console for details.`);
    }

    setIsUploading(false);
    setUploadProgress(0);
    
    // Clear the file input
    event.target.value = '';
  };

  const handleSeriesSelect = (series) => {
    setSelectedSeries(series);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-xl font-light">Loading gallery management...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-light">Gallery Management</h1>
              <p className="text-gray-600 mt-2">Manage your photography collections</p>
            </div>
            <button
              onClick={loadPhotoSeries}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Series Selector */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-light mb-4">Photo Series</h2>
            <div className="space-y-2">
              {photoSeries.map((series) => (
                <button
                  key={series.id}
                  onClick={() => handleSeriesSelect(series)}
                  className={`w-full p-4 text-left border transition-colors duration-200 ${
                    selectedSeries?.id === series.id
                      ? 'border-gray-400 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <h3 className="font-medium">{series.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {series.images?.length || 0} images ({series.photos?.length || 0} loaded)
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {series.s3Prefix}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedSeries && (
              <>
                {/* Upload Section */}
                <div className="mb-8">
                  <h2 className="text-xl font-light mb-4">
                    Upload to "{selectedSeries.title}"
                  </h2>
                  
                  <div className="border-2 border-dashed border-gray-300 p-8 text-center hover:border-gray-400 transition-colors">
                    <Upload className="mx-auto mb-4 text-gray-400" size={48} />
                    
                    {isUploading ? (
                      <div>
                        <p className="text-lg mb-2">Uploading...</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                          <div 
                            className="bg-gray-900 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <p className="text-sm text-gray-600">{uploadProgress}%</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-lg mb-2">Drop files here or click to upload</p>
                        <p className="text-sm text-gray-600 mb-4">
                          Supports JPG, PNG, WebP images
                        </p>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="file-upload"
                        />
                        <label
                          htmlFor="file-upload"
                          className="inline-flex items-center px-6 py-3 bg-gray-900 text-white font-light hover:bg-gray-800 transition-colors cursor-pointer"
                        >
                          <Plus size={20} className="mr-2" />
                          Select Images
                        </label>
                      </>
                    )}
                  </div>
                </div>

                {/* Current Images Preview */}
                <div>
                  <h3 className="text-lg font-light mb-4">
                    Current Images ({selectedSeries.images?.length || 0})
                  </h3>
                  
                  {selectedSeries.images && selectedSeries.images.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {selectedSeries.images.slice(0, 12).map((imageName, index) => {
                        const imagePath = `public/${selectedSeries.s3Prefix}/${imageName}`;
                        return (
                          <div key={index} className="aspect-square bg-gray-100 border border-gray-200 overflow-hidden relative">
                            <LazyImage
                              src={imagePath}
                              alt={imageName}
                              useThumbnail={true}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 flex items-end">
                              <p className="text-xs text-white p-2 opacity-0 hover:opacity-100 transition-opacity truncate w-full">
                                {imageName}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      {selectedSeries.images.length > 12 && (
                        <div className="aspect-square bg-gray-50 border border-gray-200 flex items-center justify-center">
                          <p className="text-sm text-gray-500">
                            +{selectedSeries.images.length - 12} more
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No images in this series yet</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GalleryManagement;
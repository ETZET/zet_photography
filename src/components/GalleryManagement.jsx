import { useState, useEffect } from 'react';
import { Upload, Plus, Trash2, RefreshCw, Eye, EyeOff, Move, X, Save, Check, AlertCircle } from 'lucide-react';
import { initializePhotoSeries, SeriesManager } from '../data/photoSeries';
import { ThumbnailService } from '../utils/thumbnailService';
import LazyImage from './LazyImage';

const GalleryManagement = () => {
  const [photoSeries, setPhotoSeries] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddSeriesDialog, setShowAddSeriesDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [seriesFormData, setSeriesFormData] = useState({
    title: '',
    description: '',
    s3Prefix: ''
  });
  const [deletingSeries, setDeletingSeries] = useState(null);
  const [showReorderDialog, setShowReorderDialog] = useState(false);
  const [reorderingImages, setReorderingImages] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadPhotoSeries();
  }, []);

  // Auto-hide notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
  };

  const loadPhotoSeries = async (forceRefresh = false) => {
    try {
      // Remember currently selected series
      const currentSelectedId = selectedSeries?.id;

      // Always force refresh in management to see latest changes
      const series = await initializePhotoSeries(true);
      setPhotoSeries(series);

      // Restore selection or default to first
      if (currentSelectedId) {
        const previouslySelected = series.find(s => s.id === currentSelectedId);
        setSelectedSeries(previouslySelected || series[0]);
      } else if (series.length > 0) {
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
      showNotification(`Successfully uploaded ${successful.length} image(s) to "${selectedSeries.title}"`);

      // Small delay to ensure S3 write propagation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Refresh the management gallery data first
      await loadPhotoSeries();

      // Then trigger refresh of main gallery
      window.dispatchEvent(new CustomEvent('refreshPhotoSeries'));
    }
    
    if (failed.length > 0) {
      showNotification(`Failed to upload ${failed.length} image(s)`, 'error');
    }

    setIsUploading(false);
    setUploadProgress(0);
    
    // Clear the file input
    event.target.value = '';
  };

  const handleSeriesSelect = (series) => {
    setSelectedSeries(series);
  };

  const handleAddSeries = async () => {
    if (!seriesFormData.title || !seriesFormData.s3Prefix) {
      showNotification('Please provide a title and S3 prefix for the series', 'error');
      return;
    }

    try {
      const newSeries = await SeriesManager.addSeries(
        seriesFormData.title,
        seriesFormData.description,
        `images/${seriesFormData.s3Prefix.toLowerCase().replace(/\s+/g, '-')}`
      );
      
      setShowAddSeriesDialog(false);
      setSeriesFormData({ title: '', description: '', s3Prefix: '' });
      await loadPhotoSeries();
      setSelectedSeries(newSeries);
      
      // Trigger refresh of main gallery to show new series
      window.dispatchEvent(new CustomEvent('refreshPhotoSeries'));
      
      showNotification(`Series "${newSeries.title}" created successfully`);
    } catch (error) {
      console.error('Error adding series:', error);
      showNotification('Failed to create series', 'error');
    }
  };

  const handleDeleteSeries = async () => {
    if (!deletingSeries) return;

    try {
      await SeriesManager.deleteSeries(deletingSeries.id);
      setShowDeleteConfirm(false);
      setDeletingSeries(null);
      await loadPhotoSeries();
      
      // Trigger refresh of main gallery to reflect deletion
      window.dispatchEvent(new CustomEvent('refreshPhotoSeries'));
      
      showNotification(`Series "${deletingSeries.title}" has been deleted`);
    } catch (error) {
      console.error('Error deleting series:', error);
      showNotification('Failed to delete series', 'error');
    }
  };

  const toggleSeriesVisibility = async (series) => {
    console.log(`[TOGGLE_VIS] ========== toggleSeriesVisibility START ==========`);
    console.log(`[TOGGLE_VIS] Series:`, { id: series.id, title: series.title, currentIsHidden: series.isHidden });

    try {
      const newIsHidden = !series.isHidden;
      console.log(`[TOGGLE_VIS] Toggling visibility - new state will be isHidden=${newIsHidden}`);

      // Update local state immediately for instant UI feedback
      const updatedLocalSeries = { ...series, isHidden: newIsHidden };
      console.log(`[TOGGLE_VIS] Created updated local series object:`, { id: updatedLocalSeries.id, title: updatedLocalSeries.title, isHidden: updatedLocalSeries.isHidden });

      // Update in photoSeries array
      setPhotoSeries(prevSeries => {
        const updated = prevSeries.map(s => s.id === series.id ? updatedLocalSeries : s);
        console.log(`[TOGGLE_VIS] Updated photoSeries state - series visibility:`, updated.map(s => ({ id: s.id, title: s.title, isHidden: s.isHidden })));
        return updated;
      });

      // Update selectedSeries if it's the one being toggled
      if (selectedSeries?.id === series.id) {
        console.log(`[TOGGLE_VIS] Updating selectedSeries state`);
        setSelectedSeries(updatedLocalSeries);
      }

      // Save to S3 (this updates the cache internally)
      console.log(`[TOGGLE_VIS] Calling SeriesManager.updateSeries with isHidden=${newIsHidden}`);
      const result = await SeriesManager.updateSeries(series.id, {
        isHidden: newIsHidden
      });
      console.log(`[TOGGLE_VIS] SeriesManager.updateSeries result:`, result);

      // DynamoDB has strong consistency - no delay needed!
      // Trigger refresh of main gallery to reflect visibility change immediately
      console.log(`[TOGGLE_VIS] Dispatching refreshPhotoSeries event`);
      window.dispatchEvent(new CustomEvent('refreshPhotoSeries'));

      console.log(`[TOGGLE_VIS] Success! Series "${series.title}" is now ${newIsHidden ? 'hidden' : 'visible'}`);
      showNotification(`${series.title} is now ${newIsHidden ? 'hidden' : 'visible'}`);
    } catch (error) {
      console.error('[TOGGLE_VIS] Error updating series visibility:', error);
      showNotification('Failed to update series visibility', 'error');
      // Reload on error to restore correct state
      await loadPhotoSeries();
    }
  };

  const openReorderDialog = (series) => {
    console.log('Opening reorder dialog for series:', series.title);
    console.log('Current image order:', series.images);
    setReorderingImages([...series.images]);
    setShowReorderDialog(true);
  };

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === dropIndex) return;

    const newImages = [...reorderingImages];
    const draggedImage = newImages[draggedItem];
    
    // Remove the dragged item from its original position
    newImages.splice(draggedItem, 1);
    
    // If we're moving the item forward and removed an item before the drop position,
    // we need to adjust the index
    let adjustedIndex = dropIndex;
    if (draggedItem < dropIndex) {
      adjustedIndex = dropIndex - 1;
    }
    
    // Insert at the new position
    newImages.splice(adjustedIndex, 0, draggedImage);
    
    setReorderingImages(newImages);
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const saveImageOrder = async () => {
    if (!selectedSeries) return;

    setIsSavingOrder(true);
    try {
      console.log('Saving new image order:', reorderingImages);

      // Update the local state immediately for instant feedback
      const updatedLocalSeries = {
        ...selectedSeries,
        images: [...reorderingImages],
        // Also update photos array to reflect new order
        photos: reorderingImages.map((filename, index) => ({
          id: index + 1,
          src: `public/${selectedSeries.s3Prefix}/${filename}`,
          title: filename.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        }))
      };

      // Update the selected series immediately
      setSelectedSeries(updatedLocalSeries);

      // Update in the photoSeries array as well
      setPhotoSeries(prevSeries =>
        prevSeries.map(s => s.id === selectedSeries.id ? updatedLocalSeries : s)
      );

      // Close dialog immediately for better UX
      setShowReorderDialog(false);

      // Save to S3 (this updates the cache internally)
      await SeriesManager.reorderImages(selectedSeries.id, reorderingImages);

      // Small delay to ensure S3 write propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger refresh of main gallery
      window.dispatchEvent(new CustomEvent('refreshPhotoSeries'));

      console.log('Image order saved successfully');
      showNotification('Image order saved successfully');
    } catch (error) {
      console.error('Error saving image order:', error);
      showNotification('Failed to save image order', 'error');
      // Reload to restore correct state on error
      await loadPhotoSeries();
    } finally {
      setIsSavingOrder(false);
    }
  };

  const cancelReorder = () => {
    setShowReorderDialog(false);
    setReorderingImages([]);
    setDraggedItem(null);
    setDragOverIndex(null);
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
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 animate-slide-in`}>
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm ${
            notification.type === 'error' 
              ? 'bg-red-50 border border-red-200 text-red-800' 
              : 'bg-green-50 border border-green-200 text-green-800'
          }`}>
            {notification.type === 'error' ? (
              <AlertCircle size={20} className="flex-shrink-0" />
            ) : (
              <Check size={20} className="flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-light">Photo Series</h2>
              <button
                onClick={() => setShowAddSeriesDialog(true)}
                className="p-2 hover:bg-gray-100 transition-colors rounded"
                title="Add new series"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {photoSeries.map((series) => (
                <div
                  key={series.id}
                  className={`border transition-colors duration-200 ${
                    selectedSeries?.id === series.id
                      ? 'border-gray-400 bg-gray-50'
                      : 'border-gray-200'
                  }`}
                >
                  <button
                    onClick={() => handleSeriesSelect(series)}
                    className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium flex items-center gap-2">
                          {series.title}
                          {series.isHidden && <EyeOff size={14} className="text-gray-400" />}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {series.images?.length || 0} images
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {series.s3Prefix}
                        </p>
                      </div>
                    </div>
                  </button>
                  <div className="flex border-t border-gray-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSeriesVisibility(series);
                      }}
                      className="flex-1 p-2 hover:bg-gray-100 transition-colors text-sm flex items-center justify-center gap-1"
                      title={series.isHidden ? 'Make visible' : 'Hide series'}
                    >
                      {series.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                      {series.isHidden ? 'Show' : 'Hide'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingSeries(series);
                        setShowDeleteConfirm(true);
                      }}
                      className="flex-1 p-2 hover:bg-red-50 hover:text-red-600 transition-colors text-sm flex items-center justify-center gap-1 border-l border-gray-200"
                      title="Delete series"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
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
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-light">
                      Current Images ({selectedSeries.images?.length || 0})
                    </h3>
                    {selectedSeries.images && selectedSeries.images.length > 0 && (
                      <button
                        onClick={() => openReorderDialog(selectedSeries)}
                        className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 hover:bg-gray-50 transition-colors text-sm"
                      >
                        <Move size={16} />
                        Reorder Images
                      </button>
                    )}
                  </div>
                  
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

      {/* Add Series Dialog */}
      {showAddSeriesDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-light mb-4">Add New Series</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={seriesFormData.title}
                  onChange={(e) => setSeriesFormData({ ...seriesFormData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 focus:border-gray-500 focus:outline-none"
                  placeholder="e.g., Urban Photography"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={seriesFormData.description}
                  onChange={(e) => setSeriesFormData({ ...seriesFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 focus:border-gray-500 focus:outline-none"
                  placeholder="Brief description of the series"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Folder Name (S3 Prefix)
                </label>
                <input
                  type="text"
                  value={seriesFormData.s3Prefix}
                  onChange={(e) => setSeriesFormData({ ...seriesFormData, s3Prefix: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 focus:border-gray-500 focus:outline-none"
                  placeholder="e.g., urban-photos"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will create a folder at: images/{seriesFormData.s3Prefix || '[folder-name]'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddSeriesDialog(false);
                  setSeriesFormData({ title: '', description: '', s3Prefix: '' });
                }}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSeries}
                className="px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                Create Series
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reorder Images Dialog */}
      {showReorderDialog && selectedSeries && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-light">Reorder Images - {selectedSeries.title}</h2>
                <button
                  onClick={cancelReorder}
                  className="p-2 hover:bg-gray-100 transition-colors rounded"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Drag and drop images to reorder them. Changes will be saved when you click "Save Order".
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {reorderingImages.map((imageName, index) => {
                  const imagePath = `public/${selectedSeries.s3Prefix}/${imageName}`;
                  const isDragging = draggedItem === index;
                  const isDragOver = dragOverIndex === index;
                  const showDropIndicator = isDragOver && draggedItem !== null && draggedItem !== index;
                  
                  return (
                    <div key={`${imageName}-${index}`} className="relative">
                      {/* Drop indicator line */}
                      {showDropIndicator && draggedItem > index && (
                        <div className="absolute left-0 top-0 w-1 h-full bg-blue-500 z-20 -translate-x-2 animate-pulse" />
                      )}
                      
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`
                          relative aspect-square bg-gray-100 border-2 overflow-hidden cursor-move
                          transition-all duration-200
                          ${isDragging ? 'opacity-30 scale-95' : ''}
                          ${showDropIndicator ? 'border-blue-500 shadow-lg' : 'border-gray-200'}
                          hover:border-gray-400
                        `}
                      >
                        <div className="absolute top-1 left-1 bg-black bg-opacity-70 text-white text-xs px-1.5 py-0.5 rounded z-10 font-medium">
                          {index + 1}
                        </div>
                        <LazyImage
                          src={imagePath}
                          alt={imageName}
                          useThumbnail={true}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                          <p className="absolute bottom-1 left-1 right-1 text-xs text-white truncate px-1">
                            {imageName}
                          </p>
                        </div>
                      </div>
                      
                      {/* Drop indicator line */}
                      {showDropIndicator && draggedItem < index && (
                        <div className="absolute right-0 top-0 w-1 h-full bg-blue-500 z-20 translate-x-2 animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={cancelReorder}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-50 transition-colors"
                disabled={isSavingOrder}
              >
                Cancel
              </button>
              <button
                onClick={saveImageOrder}
                className="px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                disabled={isSavingOrder}
              >
                {isSavingOrder ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && deletingSeries && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-light mb-4">Confirm Deletion</h2>
            <p className="text-gray-700 mb-2">
              Are you sure you want to delete the series <strong>"{deletingSeries.title}"</strong>?
            </p>
            <p className="text-sm text-gray-600 mb-6">
              This action cannot be undone. The series configuration will be removed, but the images will remain in S3.
            </p>
            <div className="bg-red-50 border border-red-200 p-3 mb-6">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> This series contains {deletingSeries.images?.length || 0} images.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingSeries(null);
                }}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSeries}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete Series
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GalleryManagement;
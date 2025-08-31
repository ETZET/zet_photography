// Dynamic photo series loading from S3 configuration
import { SeriesManager } from '../utils/seriesManager.js';

// Function to initialize all photo series from S3 configuration
export const initializePhotoSeries = async () => {
  try {
    // Load series configuration from S3
    const series = await SeriesManager.loadSeriesConfig();
    console.log('Loaded photo series from S3:', series.length, 'series');
    return series;
  } catch (error) {
    console.error('Error loading photo series:', error);
    throw error;
  }
};

// Export SeriesManager for use in management components
export { SeriesManager };
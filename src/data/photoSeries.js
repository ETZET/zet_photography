// Dynamic photo series loading from DynamoDB via GraphQL
import { SeriesManager } from '../utils/seriesManager.js';

// Function to initialize all photo series from DynamoDB
export const initializePhotoSeries = async (forceRefresh = false) => {
  try {
    console.log(`[INIT] Starting initializePhotoSeries (forceRefresh: ${forceRefresh})`);
    // Load series configuration from DynamoDB
    const series = await SeriesManager.loadSeriesConfig(forceRefresh);
    console.log(`[INIT] Received ${series.length} series from DynamoDB`);
    console.log(`[INIT] Series visibility breakdown:`, series.map(s => ({
      id: s.id,
      title: s.title,
      isHidden: s.isHidden,
      order: s.order
    })));
    return series;
  } catch (error) {
    console.error('[INIT] Error loading photo series:', error);
    throw error;
  }
};

// Export SeriesManager for use in management components
export { SeriesManager };
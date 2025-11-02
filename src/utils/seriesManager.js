/**
 * Series Manager using Amplify Data (GraphQL/DynamoDB)
 * Provides strongly consistent database operations for photo series
 */

import { generateClient } from 'aws-amplify/data';

const client = generateClient();

export class SeriesManager {
  // No need for caching - DynamoDB is fast and strongly consistent!

  /**
   * Load all series from DynamoDB
   * @param {boolean} forceRefresh - Ignored (no caching needed)
   * @returns {Promise<Array>} Transformed series data
   */
  static async loadSeriesConfig(forceRefresh = false) {
    try {
      console.log('[SERIES_MGR] Loading series from DynamoDB...');

      const { data: series, errors } = await client.models.Series.list();

      if (errors) {
        console.error('[SERIES_MGR] Errors loading series:', errors);
        console.error('[SERIES_MGR] Errors loading series JSON:', JSON.stringify(errors, null, 2));
        throw new Error('Failed to load series from database');
      }

      if (!series || series.length === 0) {
        console.log('[SERIES_MGR] No series found in database');
        return [];
      }

      // Sort by order field in memory
      const sortedSeries = [...series].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      console.log(`[SERIES_MGR] Loaded ${sortedSeries.length} series from DynamoDB`);
      console.log('[SERIES_MGR] Series data:', sortedSeries.map(s => ({
        id: s.id,
        title: s.title,
        isHidden: s.isHidden,
        imageCount: s.images?.length || 0,
        order: s.order
      })));

      // Transform to match existing app format
      return this._transformConfig(sortedSeries);
    } catch (error) {
      console.error('[SERIES_MGR] Error loading series:', error);
      throw error;
    }
  }

  /**
   * Transform DynamoDB data to app format
   * @private
   */
  static _transformConfig(series) {
    console.log(`[SERIES_MGR] Transforming ${series.length} series`);

    const transformed = series.map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
      s3Prefix: s.s3Prefix,
      images: s.images || [],
      isHidden: s.isHidden ?? false,
      order: s.order ?? 0,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      // Transform images to photos array
      photos: (s.images || []).map((filename, index) => ({
        id: index + 1,
        src: `public/${s.s3Prefix}/${filename}`,
        title: filename.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      }))
    }));

    console.log('[SERIES_MGR] Transformation complete');
    return transformed;
  }

  /**
   * Update series metadata (including visibility)
   * @param {string} seriesId - DynamoDB ID
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} Updated series
   */
  static async updateSeries(seriesId, updates) {
    console.log(`[SERIES_MGR] Updating series ${seriesId}:`, updates);

    try {
      const { data, errors } = await client.models.Series.update({
        id: seriesId,
        ...updates
      });

      if (errors) {
        console.error('[SERIES_MGR] Update errors:', errors);
        throw new Error('Failed to update series');
      }

      console.log('[SERIES_MGR] Series updated successfully:', data);
      return data;
    } catch (error) {
      console.error('[SERIES_MGR] Error updating series:', error);
      throw error;
    }
  }

  /**
   * Add new series
   */
  static async addSeries(title, description, s3Prefix) {
    console.log(`[SERIES_MGR] Creating new series: ${title}`);

    try {
      // Get current max order
      const { data: existingSeries } = await client.models.Series.list();
      const maxOrder = existingSeries.reduce((max, s) => Math.max(max, s.order ?? 0), 0);

      const { data, errors } = await client.models.Series.create({
        title,
        description: description || '',
        s3Prefix,
        images: [],
        isHidden: false,
        order: maxOrder + 1
      });

      if (errors) {
        console.error('[SERIES_MGR] Create errors:', errors);
        console.error('[SERIES_MGR] Create errors JSON:', JSON.stringify(errors, null, 2));
        throw new Error('Failed to create series');
      }

      console.log('[SERIES_MGR] Series created:', data);
      return data;
    } catch (error) {
      console.error('[SERIES_MGR] Error creating series:', error);
      throw error;
    }
  }

  /**
   * Delete series
   */
  static async deleteSeries(seriesId) {
    console.log(`[SERIES_MGR] Deleting series: ${seriesId}`);

    try {
      const { data, errors } = await client.models.Series.delete({
        id: seriesId
      });

      if (errors) {
        console.error('[SERIES_MGR] Delete errors:', errors);
        throw new Error('Failed to delete series');
      }

      console.log('[SERIES_MGR] Series deleted:', data);
      return data;
    } catch (error) {
      console.error('[SERIES_MGR] Error deleting series:', error);
      throw error;
    }
  }

  /**
   * Add image to series
   */
  static async addImageToSeries(seriesId, filename) {
    console.log(`[SERIES_MGR] Adding image ${filename} to series ${seriesId}`);

    try {
      // First, get current series
      const { data: series } = await client.models.Series.get({ id: seriesId });

      if (!series) {
        throw new Error(`Series ${seriesId} not found`);
      }

      // Add image if not already present
      const currentImages = series.images || [];
      if (currentImages.includes(filename)) {
        console.log(`[SERIES_MGR] Image ${filename} already exists`);
        return series;
      }

      const updatedImages = [...currentImages, filename];

      const { data, errors } = await client.models.Series.update({
        id: seriesId,
        images: updatedImages
      });

      if (errors) {
        console.error('[SERIES_MGR] Add image errors:', errors);
        throw new Error('Failed to add image');
      }

      console.log(`[SERIES_MGR] Image added. New count: ${updatedImages.length}`);
      return data;
    } catch (error) {
      console.error('[SERIES_MGR] Error adding image:', error);
      throw error;
    }
  }

  /**
   * Remove image from series
   */
  static async removeImageFromSeries(seriesId, filename) {
    console.log(`[SERIES_MGR] Removing image ${filename} from series ${seriesId}`);

    try {
      // Get current series
      const { data: series } = await client.models.Series.get({ id: seriesId });

      if (!series) {
        throw new Error(`Series ${seriesId} not found`);
      }

      const updatedImages = (series.images || []).filter(img => img !== filename);

      const { data, errors } = await client.models.Series.update({
        id: seriesId,
        images: updatedImages
      });

      if (errors) {
        console.error('[SERIES_MGR] Remove image errors:', errors);
        throw new Error('Failed to remove image');
      }

      console.log(`[SERIES_MGR] Image removed. New count: ${updatedImages.length}`);
      return data;
    } catch (error) {
      console.error('[SERIES_MGR] Error removing image:', error);
      throw error;
    }
  }

  /**
   * Reorder images in a series
   */
  static async reorderImages(seriesId, orderedImageNames) {
    console.log(`[SERIES_MGR] Reordering images in series ${seriesId}`);

    try {
      const { data, errors } = await client.models.Series.update({
        id: seriesId,
        images: orderedImageNames
      });

      if (errors) {
        console.error('[SERIES_MGR] Reorder errors:', errors);
        throw new Error('Failed to reorder images');
      }

      console.log('[SERIES_MGR] Images reordered successfully');
      return data;
    } catch (error) {
      console.error('[SERIES_MGR] Error reordering images:', error);
      throw error;
    }
  }

  /**
   * Get raw series config (for compatibility)
   */
  static async getRawSeriesConfig(forceRefresh = false) {
    const { data: series } = await client.models.Series.list();
    return series || [];
  }

  /**
   * Clear cache (no-op for GraphQL version)
   */
  static clearCache() {
    console.log('[SERIES_MGR] clearCache() - no cache to clear (using DynamoDB)');
  }

  /**
   * Save series config (no-op - updates are atomic)
   */
  static async saveSeriesConfig(seriesConfig) {
    console.warn('[SERIES_MGR] saveSeriesConfig() called - this is deprecated with GraphQL');
    console.log('[SERIES_MGR] Use updateSeries() instead for atomic updates');
  }
}

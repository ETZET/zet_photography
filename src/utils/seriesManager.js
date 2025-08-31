import { uploadData, downloadData, list } from 'aws-amplify/storage';

const SERIES_CONFIG_KEY = 'config/series-config.json';

// Initial series configuration (to be uploaded to S3 first time)
const initialSeriesConfig = [
  {
    id: 1,
    title: "Flower Decay",
    description: "A collection exploring the beauty in decay",
    s3Prefix: "images/flowerdecay",
    images: [
      "flower0.jpg", "flower1.jpg", "flower2.jpg", "flower3.jpg", "flower4.jpg",
      "flower5.jpg", "flower6.jpg", "flower7.jpg", "flower8.jpg", "flower9.jpg",
      "flower10.jpg", "flower11.jpg", "flower12.jpg", "flower13.jpg", "flower14.jpg",
      "flower15.jpg", "flower16.jpg", "flower17.jpg", "flower18.jpg", "flower19.jpg",
      "flower20.jpg", "flower21.jpg", "flower22.jpg", "flower23.jpg", "flower24.jpg",
      "flower25.jpg", "flower26.jpg", "flower27.jpg", "flower28.jpg", "flower29.jpg",
      "flower30.jpg", "flower31.jpg", "flower32.jpg", "flower33.jpg", "flower34.jpg",
      "flower35.jpg", "flower36.jpg", "flower37.jpg", "flower38.jpg"
    ],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z"
  },
  {
    id: 2,
    title: "Plants Autopsy",
    description: "Botanical studies through scanning",
    s3Prefix: "images/scanner",
    images: [
      "img20230423_12502676.jpg", "img20230423_12511646.jpg", "img20230423_12520227.jpg",
      "img20230423_12524256.jpg", "img20230423_12591380.jpg", "img20230423_13001280.jpg",
      "img20230423_13005920.jpg", "img20230423_13014120.jpg", "img20230423_13023430.jpg",
      "img20230423_13032332.jpg", "img20230423_13040312.jpg", "img20230423_13050692.jpg",
      "img20230423_13062462.jpg", "img20230423_13072873.jpg", "img20230423_13081452.jpg",
      "img20230423_13100272.jpg"
    ],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z"
  },
  {
    id: 3,
    title: "Random Iphone Pics",
    description: "Everyday moments captured on mobile",
    s3Prefix: "images/iphone",
    images: [
      "car.jpg", "cat.jpg", "curb.jpg", "house.jpg", "road.jpg",
      "sand.jpg", "shell.jpg", "sky.jpg", "tree.jpg", "window.jpg"
    ],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z"
  }
];

export class SeriesManager {
  
  // Load series configuration from S3
  static async loadSeriesConfig() {
    try {
      console.log('Loading series config from S3...');
      const result = await downloadData({ key: SERIES_CONFIG_KEY }).result;
      const configText = await result.body.text();
      const config = JSON.parse(configText);
      console.log('Loaded config from S3:', config.map(s => ({ id: s.id, title: s.title, imageCount: s.images.length })));
      
      // Transform to the format expected by your app
      const transformedConfig = config.map(series => ({
        ...series,
        photos: series.images.map((filename, index) => ({
          id: index + 1,
          src: `public/${series.s3Prefix}/${filename}`,
          title: filename.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        }))
      }));
      
      console.log('Transformed config:', transformedConfig.map(s => ({ id: s.id, title: s.title, imageCount: s.images?.length || 0, photoCount: s.photos?.length || 0 })));
      return transformedConfig;
    } catch (error) {
      console.log('Series config not found, creating initial config...');
      // If config doesn't exist, create it with initial data
      await this.saveSeriesConfig(initialSeriesConfig);
      return this.loadSeriesConfig();
    }
  }

  // Save series configuration to S3
  static async saveSeriesConfig(seriesConfig) {
    try {
      const configData = JSON.stringify(seriesConfig, null, 2);
      await uploadData({
        key: SERIES_CONFIG_KEY,
        data: configData,
        options: {
          contentType: 'application/json'
        }
      }).result;
      
      console.log('Series configuration saved to S3');
      return true;
    } catch (error) {
      console.error('Error saving series configuration:', error);
      throw error;
    }
  }

  // Add new image to a series
  static async addImageToSeries(seriesId, filename) {
    try {
      console.log(`Adding image ${filename} to series ${seriesId}...`);
      const config = await this.getRawSeriesConfig();
      console.log('Current config:', config.map(s => ({ id: s.id, title: s.title, imageCount: s.images.length })));
      
      const seriesIndex = config.findIndex(series => series.id === seriesId);
      
      if (seriesIndex === -1) {
        throw new Error(`Series with ID ${seriesId} not found`);
      }

      // Add image if it doesn't already exist
      if (!config[seriesIndex].images.includes(filename)) {
        config[seriesIndex].images.push(filename);
        config[seriesIndex].updatedAt = new Date().toISOString();
        
        await this.saveSeriesConfig(config);
        console.log(`Successfully added ${filename} to series "${config[seriesIndex].title}". New image count: ${config[seriesIndex].images.length}`);
      } else {
        console.log(`Image ${filename} already exists in series "${config[seriesIndex].title}"`);
      }
      
      return config[seriesIndex];
    } catch (error) {
      console.error('Error adding image to series:', error);
      throw error;
    }
  }

  // Remove image from series
  static async removeImageFromSeries(seriesId, filename) {
    try {
      const config = await this.getRawSeriesConfig();
      const seriesIndex = config.findIndex(series => series.id === seriesId);
      
      if (seriesIndex === -1) {
        throw new Error(`Series with ID ${seriesId} not found`);
      }

      config[seriesIndex].images = config[seriesIndex].images.filter(img => img !== filename);
      config[seriesIndex].updatedAt = new Date().toISOString();
      
      await this.saveSeriesConfig(config);
      console.log(`Removed ${filename} from series "${config[seriesIndex].title}"`);
      
      return config[seriesIndex];
    } catch (error) {
      console.error('Error removing image from series:', error);
      throw error;
    }
  }

  // Add new series
  static async addSeries(title, description, s3Prefix) {
    try {
      const config = await this.getRawSeriesConfig();
      const newId = Math.max(...config.map(s => s.id)) + 1;
      
      const newSeries = {
        id: newId,
        title,
        description: description || '',
        s3Prefix,
        images: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      config.push(newSeries);
      await this.saveSeriesConfig(config);
      
      console.log(`Added new series: "${title}"`);
      return newSeries;
    } catch (error) {
      console.error('Error adding new series:', error);
      throw error;
    }
  }

  // Update series metadata
  static async updateSeries(seriesId, updates) {
    try {
      const config = await this.getRawSeriesConfig();
      const seriesIndex = config.findIndex(series => series.id === seriesId);
      
      if (seriesIndex === -1) {
        throw new Error(`Series with ID ${seriesId} not found`);
      }

      config[seriesIndex] = {
        ...config[seriesIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await this.saveSeriesConfig(config);
      console.log(`Updated series: "${config[seriesIndex].title}"`);
      
      return config[seriesIndex];
    } catch (error) {
      console.error('Error updating series:', error);
      throw error;
    }
  }

  // Delete series
  static async deleteSeries(seriesId) {
    try {
      const config = await this.getRawSeriesConfig();
      const seriesIndex = config.findIndex(series => series.id === seriesId);
      
      if (seriesIndex === -1) {
        throw new Error(`Series with ID ${seriesId} not found`);
      }

      const deletedSeries = config[seriesIndex];
      config.splice(seriesIndex, 1);
      
      await this.saveSeriesConfig(config);
      console.log(`Deleted series: "${deletedSeries.title}"`);
      
      return deletedSeries;
    } catch (error) {
      console.error('Error deleting series:', error);
      throw error;
    }
  }

  // Get raw config (without photo transformations)
  static async getRawSeriesConfig() {
    try {
      const result = await downloadData({ key: SERIES_CONFIG_KEY }).result;
      const configText = await result.body.text();
      return JSON.parse(configText);
    } catch (error) {
      console.log('Creating initial config...');
      await this.saveSeriesConfig(initialSeriesConfig);
      return initialSeriesConfig;
    }
  }
}

export default SeriesManager;
import { uploadData, getUrl } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/data';

export class ThumbnailService {
  
  // Generate thumbnail path from original path
  static getThumbnailPath(originalPath) {
    const pathParts = originalPath.split('.');
    const extension = pathParts.pop();
    const basePath = pathParts.join('.');
    return `${basePath}_thumb.${extension}`;
  }

  // Check if thumbnail exists in S3
  static async thumbnailExists(thumbnailPath) {
    try {
      await getUrl({
        path: thumbnailPath,
        options: {
          validateObjectExistence: true,
          expiresIn: 60 // Short expiry for existence check
        }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Generate thumbnail via Lambda function
  static async generateThumbnailViaLambda(s3ObjectKey) {
    try {
      const client = generateClient();
      const { data, errors } = await client.mutations.generateThumbnail({
        objectKey: s3ObjectKey
      });

      if (errors) {
        console.error('GraphQL errors:', errors);
        throw new Error(`GraphQL errors: ${errors.map(e => e.message).join(', ')}`);
      }

      console.log('Lambda thumbnail generation result:', data);
      return data;
    } catch (error) {
      console.error('Error calling Lambda function:', error);
      throw error;
    }
  }


  // Generate and upload thumbnail for existing S3 image
  static async generateThumbnailForExistingImage(originalPath) {
    try {
      const thumbnailPath = this.getThumbnailPath(originalPath);
      
      // Check if thumbnail already exists
      if (await this.thumbnailExists(thumbnailPath)) {
        console.log('Thumbnail already exists:', thumbnailPath);
        return thumbnailPath;
      }

      // Call Lambda function to generate thumbnail
      console.log('Calling Lambda to generate thumbnail for:', originalPath);
      await this.generateThumbnailViaLambda(originalPath);
      
      return thumbnailPath;
    } catch (error) {
      console.error('Error generating thumbnail for existing image:', error);
      throw error;
    }
  }

  // Process file during upload (upload original and trigger thumbnail generation)
  static async processImageUpload(imageFile, uploadPath) {
    try {
      const thumbnailPath = this.getThumbnailPath(uploadPath);
      
      // Upload original image first
      await uploadData({
        key: uploadPath,
        data: imageFile,
        options: {
          contentType: imageFile.type
        }
      }).result;
      
      console.log('Original image uploaded:', uploadPath);

      // Trigger Lambda function to generate thumbnail
      try {
        await this.generateThumbnailViaLambda(uploadPath);
        console.log('Thumbnail generation triggered for:', uploadPath);
      } catch (thumbnailError) {
        console.warn('Thumbnail generation failed, but original upload succeeded:', thumbnailError);
        // Don't fail the entire upload if thumbnail generation fails
      }
      
      return {
        originalPath: uploadPath,
        thumbnailPath: thumbnailPath
      };
    } catch (error) {
      console.error('Error processing image upload:', error);
      throw error;
    }
  }
}

export default ThumbnailService;
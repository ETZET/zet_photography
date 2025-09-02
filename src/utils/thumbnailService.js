import { uploadData, getUrl } from 'aws-amplify/storage';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { fetchAuthSession } from 'aws-amplify/auth';
import outputs from '../../amplify_outputs.json';

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
      // Get authenticated session for credentials
      const session = await fetchAuthSession();
      const credentials = session.credentials;

      // Create Lambda client
      const lambdaClient = new LambdaClient({
        region: outputs.storage.aws_region,
        credentials: credentials
      });

      // Get function name from outputs, fallback to hardcoded name
      const functionName = outputs.custom?.thumbnailGeneratorFunctionName || 'ThumbnailGeneratorFunction';

      // Prepare the payload
      const payload = {
        arguments: {
          objectKey: s3ObjectKey
        }
      };

      // Invoke Lambda function
      const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify(payload),
      });

      const response = await lambdaClient.send(command);
      const result = JSON.parse(new TextDecoder().decode(response.Payload));

      console.log('Lambda thumbnail generation result:', result);

      if (result.errorMessage) {
        throw new Error(`Lambda error: ${result.errorMessage}`);
      }

      return result;
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
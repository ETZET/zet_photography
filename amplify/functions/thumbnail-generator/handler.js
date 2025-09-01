import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import Jimp from 'jimp';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event) => {
  console.log('Thumbnail generator triggered:', JSON.stringify(event, null, 2));
  
  try {
    // Parse the event - could be from API Gateway or S3 trigger
    let bucketName, objectKey;
    
    if (event.Records) {
      // S3 trigger event
      const record = event.Records[0];
      bucketName = record.s3.bucket.name;
      objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    } else {
      // API Gateway event
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      bucketName = body.bucketName || process.env.STORAGE_BUCKET_NAME;
      objectKey = body.objectKey;
    }
    
    console.log(`Processing: ${bucketName}/${objectKey}`);
    
    // Skip if this is already a thumbnail
    if (objectKey.includes('_thumb.')) {
      console.log('Skipping thumbnail file');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Skipped thumbnail file' })
      };
    }
    
    // Generate thumbnail key
    const thumbnailKey = generateThumbnailKey(objectKey);
    
    try {
      // Get original image from S3
      const getObjectParams = {
        Bucket: bucketName,
        Key: objectKey
      };
      
      const originalImage = await s3Client.send(new GetObjectCommand(getObjectParams));
      const imageBuffer = await streamToBuffer(originalImage.Body);
      
      // Generate thumbnail using Jimp
      const thumbnailBuffer = await generateThumbnailWithJimp(imageBuffer, 300, 80);
      
      // Upload thumbnail to S3
      const putObjectParams = {
        Bucket: bucketName,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
        CacheControl: 'max-age=31536000', // 1 year cache
      };
      
      await s3Client.send(new PutObjectCommand(putObjectParams));
      
      console.log(`Thumbnail generated successfully: ${thumbnailKey}`);
      
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          message: 'Thumbnail generated successfully',
          originalKey: objectKey,
          thumbnailKey: thumbnailKey,
          thumbnailSize: thumbnailBuffer.length
        })
      };
      
    } catch (error) {
      console.error('Error processing image:', error);
      
      // Return success even if thumbnail generation fails
      // This prevents upload failures due to thumbnail issues
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          message: 'Original upload successful, thumbnail generation failed',
          error: error.message,
          originalKey: objectKey
        })
      };
    }
    
  } catch (error) {
    console.error('Lambda execution error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

// Helper function to convert stream to buffer
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Helper function to generate thumbnail using Jimp
async function generateThumbnailWithJimp(imageBuffer, maxSize, quality) {
  try {
    // Load the image using Jimp
    const image = await Jimp.read(imageBuffer);
    
    // Resize with aspect ratio preservation
    // Jimp.AUTO maintains aspect ratio for the other dimension
    image.resize(maxSize, maxSize, Jimp.RESIZE_BEZIER);
    
    // Convert to JPEG with quality (0-100)
    const thumbnailBuffer = await image.quality(quality).getBufferAsync(Jimp.MIME_JPEG);
    
    return thumbnailBuffer;
  } catch (error) {
    console.error('Error generating thumbnail with Jimp:', error);
    throw error;
  }
}

// Helper function to generate thumbnail key
function generateThumbnailKey(originalKey) {
  const pathParts = originalKey.split('.');
  const extension = pathParts.pop();
  const basePath = pathParts.join('.');
  return `${basePath}_thumb.${extension}`;
}
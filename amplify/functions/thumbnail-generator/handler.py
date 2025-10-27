import boto3
import json
import os
import uuid
from urllib.parse import unquote_plus
from PIL import Image
import io

s3_client = boto3.client('s3')

def resize_image(image_data, max_size=300, quality=80):
    """Resize image maintaining aspect ratio"""
    print(f'[RESIZE] Starting resize_image - max_size={max_size}, quality={quality}')
    print(f'[RESIZE] Input image data size: {len(image_data)} bytes')

    with Image.open(io.BytesIO(image_data)) as image:
        print(f'[RESIZE] Original image loaded - size={image.size}, mode={image.mode}, format={image.format}')

        # Calculate thumbnail size maintaining aspect ratio
        original_size = image.size
        image.thumbnail((max_size, max_size), Image.LANCZOS)
        print(f'[RESIZE] Thumbnail created - original size={original_size}, new size={image.size}')

        # Save to bytes buffer as JPEG
        output_buffer = io.BytesIO()
        # Convert to RGB if image has transparency (RGBA)
        if image.mode in ('RGBA', 'LA'):
            print(f'[RESIZE] Converting from {image.mode} to RGB')
            background = Image.new('RGB', image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background
            print(f'[RESIZE] Conversion complete - new mode={image.mode}')

        print(f'[RESIZE] Saving as JPEG - quality={quality}')
        image.save(output_buffer, format='JPEG', quality=quality, progressive=True)
        output_buffer.seek(0)
        output_data = output_buffer.getvalue()
        print(f'[RESIZE] Thumbnail saved - output size={len(output_data)} bytes')
        return output_data

def generate_thumbnail_key(original_key):
    """Generate thumbnail key with _thumb suffix"""
    path_parts = original_key.rsplit('.', 1)
    if len(path_parts) == 2:
        base_path, extension = path_parts
        return f"{base_path}_thumb.{extension}"
    return f"{original_key}_thumb"

def lambda_handler(event, context):
    """
    AWS Lambda handler for generating thumbnails from uploaded images.
    Following Amplify Gen 2 Python Lambda best practices.
    """
    print(f'Event: {json.dumps(event, default=str)}')
    
    try:
        # Parse GraphQL mutation event from Amplify
        args = event.get('arguments', {})
        object_key = args.get('objectKey')
        
        # Get bucket name from environment - set by Amplify automatically
        bucket_name = os.environ.get('AMPLIFY_STORAGE_BUCKET_NAME')
        
        if not bucket_name:
            raise Exception('Storage bucket name not found in environment variables')
        
        print(f'Processing: {bucket_name}/{object_key}')
        
        # Skip if this is already a thumbnail
        if '_thumb.' in object_key:
            print('Skipping thumbnail file')
            return {'message': 'Skipped thumbnail file'}
        
        # Generate thumbnail key
        thumbnail_key = generate_thumbnail_key(object_key)
        
        try:
            # Download original image from S3
            response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
            image_data = response['Body'].read()
            
            # Generate thumbnail using PIL
            thumbnail_data = resize_image(image_data, max_size=600, quality=95)
            
            # Upload thumbnail to S3
            s3_client.put_object(
                Bucket=bucket_name,
                Key=thumbnail_key,
                Body=thumbnail_data,
                ContentType='image/jpeg',
                CacheControl='max-age=31536000'  # 1 year cache
            )
            
            print(f'Thumbnail generated successfully: {thumbnail_key}')
            
            return {
                'message': 'Thumbnail generated successfully',
                'originalKey': object_key,
                'thumbnailKey': thumbnail_key,
                'thumbnailSize': len(thumbnail_data)
            }
            
        except Exception as error:
            print(f'Error processing image: {str(error)}')
            
            # Return success even if thumbnail generation fails
            # This prevents upload failures due to thumbnail issues
            return {
                'message': 'Original upload successful, thumbnail generation failed',
                'error': str(error),
                'originalKey': object_key
            }
    
    except Exception as error:
        print(f'Lambda execution error: {str(error)}')
        raise Exception(f'Lambda execution error: {str(error)}')
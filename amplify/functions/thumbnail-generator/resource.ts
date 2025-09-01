import { defineFunction } from '@aws-amplify/backend';

// Using a community Sharp layer for production deployment
// Layer ARN for us-east-1: arn:aws:lambda:us-east-1:770693421928:layer:Klayers-p39-sharp:1
// Adjust for your AWS region if different

export const thumbnailGenerator = defineFunction({
  name: 'thumbnail-generator',
  entry: './handler.js',
  runtime: 20,
  timeoutSeconds: 30,
  memoryMB: 512,
  // Environment will include SHARP_LAYER_ARN for layer configuration
  environment: {
    SHARP_IGNORE_GLOBAL_LIBVIPS: '1'  // Helps Sharp work in Lambda environment
  }
});
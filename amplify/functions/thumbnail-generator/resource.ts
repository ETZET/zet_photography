import { defineFunction } from '@aws-amplify/backend';

// Using a community Sharp layer for production deployment
// Layer ARN for us-east-1: arn:aws:lambda:us-east-1:770693421928:layer:Klayers-p39-sharp:1
// Adjust for your AWS region if different

export const thumbnailGenerator = defineFunction({
  name: 'thumbnail-generator',
  entry: './handler.py',
  // Note: Amplify Gen 2 uses CDK construct for Python runtime
  // The Python runtime will be configured in backend.ts
  timeoutSeconds: 30,
  memoryMB: 512,
  // Python runtime doesn't need bundling configuration
  environment: {
    // Python-specific environment variables can be added here if needed
  }
});
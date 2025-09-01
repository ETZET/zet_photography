import { defineFunction } from '@aws-amplify/backend';

export const thumbnailGenerator = defineFunction({
  name: 'thumbnail-generator',
  entry: './handler.js',
  runtime: 20,
  timeoutSeconds: 30,
  memoryMB: 512
});
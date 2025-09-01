import { defineFunction } from '@aws-amplify/backend';

export const thumbnailGenerator = defineFunction({
  name: 'thumbnail-generator',
  entry: './handler.js',
  environment: {
    STORAGE_BUCKET_NAME: 'amplifyTeamDrive'
  },
  runtime: 20,
  timeoutSeconds: 30,
  memoryMB: 512
});
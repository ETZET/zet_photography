import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { ThumbnailGeneratorStack } from './functions/thumbnail-generator/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more/
 */
const backend = defineBackend({
  auth,
  data,
  storage,
});

// Add the ThumbnailGenerator custom Lambda stack to the backend
const thumbnailStack = new ThumbnailGeneratorStack(
  backend.createStack('ThumbnailGeneratorStack'),
  'thumbnailGeneratorResource'
);

// Grant the Lambda function access to the S3 bucket
thumbnailStack.function.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      's3:GetObject',
      's3:PutObject',
    ],
    resources: [`${backend.storage.resources.bucket.bucketArn}/*`],
  })
);

// Grant the Lambda function permission to list bucket contents
thumbnailStack.function.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      's3:ListBucket',
    ],
    resources: [backend.storage.resources.bucket.bucketArn],
  })
);

// Add bucket name as environment variable for the Lambda function
thumbnailStack.function.addEnvironment('AMPLIFY_STORAGE_BUCKET_NAME', backend.storage.resources.bucket.bucketName);

// Add function to backend outputs so it appears in amplify_outputs.json
backend.addOutput({
  custom: {
    thumbnailGeneratorFunctionName: thumbnailStack.function.functionName,
    thumbnailGeneratorFunctionArn: thumbnailStack.function.functionArn,
  }
});
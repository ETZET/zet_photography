import { defineAuth } from '@aws-amplify/backend';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    email: {
      required: true,
    },
  },
  access: (allow) => [
    // Allow unauthenticated users to invoke Lambda functions
    allow.unauthenticated().to(['lambda:InvokeFunction']),
  ],
});

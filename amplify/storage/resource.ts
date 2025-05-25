import { defineStorage } from "@aws-amplify/backend";

// export const photoBucket = defineStorage({
//   name: 'photoBucket',
//   isDefault: true, // identify your default storage bucket (required)
//   // TODO: configure access
// });

// export const photoResizedBucket = defineStorage({
//   name: 'photoResized',
//   // TODO: configure access
// });

export const storage = defineStorage({
  name: 'amplifyTeamDrive',
  access: (allow) => ({
    'profile-pictures/{entity_id}/*': [
      allow.guest.to(['read']),
      allow.entity('identity').to(['read', 'write', 'delete'])
    ],
    'picture-submissions/*': [
      allow.authenticated.to(['read','write']),
      allow.guest.to(['read', 'write'])
    ],
    'public/images/*': [
      allow.authenticated.to(['read', 'write']),
      allow.guest.to(['read', 'write'])
    ],
    'images/*': [
      allow.authenticated.to(['read', 'write']),
      allow.guest.to(['read'])
    ],
  })
});
import { defineStorage } from "@aws-amplify/backend";

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
    // Configuration files - only authenticated users can write
    'config/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write'])
    ],
    // ✅ TRY THIS: More permissive pattern that should catch all subfolders
    'public/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write'])
    ],
    // Keep this as backup
    'images/*': [
      allow.authenticated.to(['read', 'write']),
      allow.guest.to(['read'])
    ],
  })
});
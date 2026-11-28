import { initBotId } from 'botid/client/core';

// Runs before hydration so every browser write carries a BotID challenge.
// Keep the level in sync with the server checks. Basic is the free tier.
initBotId({
  protect: [
    { path: '/api/session', method: 'POST', advancedOptions: { checkLevel: 'basic' } },
    { path: '/api/messages', method: 'POST', advancedOptions: { checkLevel: 'basic' } },
    { path: '/api/studio', method: 'POST', advancedOptions: { checkLevel: 'basic' } },
    { path: '/api/review', method: 'POST', advancedOptions: { checkLevel: 'basic' } },
    { path: '/api/board', method: 'POST', advancedOptions: { checkLevel: 'basic' } },
    { path: '/api/board', method: 'PATCH', advancedOptions: { checkLevel: 'basic' } },
  ],
});

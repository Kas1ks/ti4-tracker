import { handleApi } from './api.js';
import { GameRoom } from './rooms/GameRoom.js';
import { RoomDirectory } from './rooms/RoomDirectory.js';

export { GameRoom, RoomDirectory };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};

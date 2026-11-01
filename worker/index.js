import { handleApi } from './api.js';
import { GameRoom } from './rooms/GameRoom.js';
import { RoomDirectory } from './rooms/RoomDirectory.js';
import { MiltyDraft } from './milty/MiltyDraft.js';
import { StatsStore } from './stats/StatsStore.js';

export { GameRoom, RoomDirectory, MiltyDraft, StatsStore };

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

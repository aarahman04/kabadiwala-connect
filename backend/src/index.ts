import { createServer } from 'node:http';
import { createApp } from './app';
import { storeFromEnv } from './store';

const store = storeFromEnv();
const port = Number(process.env.PORT ?? 8787);
const app = createApp({
  store,
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  adminToken: process.env.ADMIN_TOKEN,
});

createServer((req, res) => void app(req, res)).listen(port, () => {
  console.log(`Kabadiwala Connect API on :${port} (store: ${store.kind})`);
});

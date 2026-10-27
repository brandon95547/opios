// The Express app: the API under /api, behind the login, and the public unsubscribe pages under /u.
import express from 'express';
import { openDb } from './db.js';
import { loadKey } from './secrets.js';
import { createAuth } from './auth.js';
import { createSettings } from './settings.js';
import { createSender } from './sender.js';
import { contactsRouter } from './contacts.js';
import { templatesRouter, recompileBrandTemplates } from './templates.js';
import { brandsRouter, apiRouter } from './brands.js';
import { mediaFiles, mediaRouter } from './media.js';
import { campaignsRouter } from './campaigns.js';
import { settingsRouter, overviewRouter, exportRouter } from './routes.js';
import { unsubscribeRouter } from './unsubscribe.js';

// Changes come only from Opios's own pages: a request another site's page makes is turned away.
// (The session cookie is SameSite=Lax as well, which already keeps it off such requests.)
function sameOrigin(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const origin = req.get('origin');
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch { /* not a URL */ }
    if (host !== (req.get('x-forwarded-host') || req.get('host'))) return res.status(403).json({ error: 'Requests from other sites are not allowed.' });
  }
  next();
}

function errors(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That is too much to send at once.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'That request could not be read.' });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong on the server.' });
}

export function createApp({ dataDir, production = false, basePath = '', setupCode = '', trustProxy = 'loopback', log = console } = {}) {
  const db = openDb(dataDir);
  const settings = createSettings(db, loadKey(dataDir));
  const sender = createSender({ db, settings, log });
  const auth = createAuth(db, { cookiePath: basePath || '/', setupCode, production });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' });
    if (production) {
      // Pictures in emails come from anywhere on the web; scripts only from Opios itself.
      res.set('Content-Security-Policy', "default-src 'self'; img-src * data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src 'self' about:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
    }
    next();
  });

  // Everything is served under basePath (such as /opios), so Opios can share a domain.
  const site = express.Router();
  site.use('/u', unsubscribeRouter({ db, settings }));
  site.use('/media', mediaFiles(dataDir));

  const api = express.Router();
  // Scripts adding updates, with an API key instead of the login.
  api.use('/v1', apiRouter({ db }));
  api.use(express.json({ limit: '20mb' }));
  api.use(sameOrigin);
  api.use('/auth', auth.router);
  api.use(auth.requireAuth);
  api.use(overviewRouter({ db, settings }));
  api.use(contactsRouter({ db }));
  api.use(templatesRouter({ db }));
  api.use(campaignsRouter({ db, settings, sender }));
  api.use(brandsRouter({ db, onBrandChanged: (id) => recompileBrandTemplates(db, id).catch((err) => log.error('Recompiling templates:', err)) }));
  api.use(mediaRouter({ db, dataDir, basePath, settings }));
  api.use(settingsRouter({ settings }));
  api.use(exportRouter({ db }));
  api.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  api.use(errors);
  site.use('/api', api);
  app.use(basePath || '/', site);

  // Picks up any message that was being sent when the app last stopped.
  sender.kick();

  return {
    app,
    db,
    sender,
    settings,
    async close() {
      await sender.stop();
      db.close();
    },
  };
}

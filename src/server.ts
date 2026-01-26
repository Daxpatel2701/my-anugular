import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Proxy for minder-proxy API calls.
 * Forwards requests from /api/minder-proxy/* to the Worker backend.
 */
app.use('/api/minder-proxy', async (req, res, next) => {
  console.log('[DEBUG] Proxy middleware hit:', req.method, req.url);
  try {
    const targetUrl = `https://fe-react-v1.practeaz.workers.dev/api/minder-proxy${req.url}`;

    // Collect body for non-GET requests
    let body: Buffer | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...req.headers as any,
        host: 'fe-react-v1.practeaz.workers.dev', // Override Host
      },
      body: body as any,
    });

    // Forward status and headers
    res.status(response.status);
    response.headers.forEach((value, key) => {
      // Exclude content-encoding/length to let Express handle it if needed, 
      // or just forward everything except encoding which might break if decoded
      if (key.toLowerCase() !== 'content-encoding' && key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, value);
      }
    });

    const responseBody = await response.arrayBuffer();
    res.send(Buffer.from(responseBody));
  } catch (error) {
    console.error('Proxy error:', error);
    next(error);
  }
});

/**
 * Proxy for login API calls.
 * Forwards requests from /login to the Worker backend.
 */
app.use('/login', async (req, res, next) => {
  console.log('[DEBUG] Login proxy middleware hit:', req.method, req.url);
  try {
    const targetUrl = `https://fe-react-v1.practeaz.workers.dev/login`;

    // Collect body for non-GET requests
    let body: Buffer | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...req.headers as any,
        host: 'fe-react-v1.practeaz.workers.dev', // Override Host
      },
      body: body as any,
    });

    // Forward status and headers
    res.status(response.status);
    response.headers.forEach((value, key) => {
      // Exclude content-encoding/length to let Express handle it if needed, 
      // or just forward everything except encoding which might break if decoded
      if (key.toLowerCase() !== 'content-encoding' && key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, value);
      }
    });

    const responseBody = await response.arrayBuffer();
    res.send(Buffer.from(responseBody));
  } catch (error) {
    console.error('Login Proxy error:', error);
    next(error);
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

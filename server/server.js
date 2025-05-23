/* eslint-disable no-console */

// ──────────────────── imports ────────────────────
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { google } from 'googleapis';
import NodeCache from 'node-cache';
import pLimit from 'p-limit';
import dotenv from 'dotenv';

// load .env only when running outside Vercel
if (!process.env.VERCEL) {
  dotenv.config({ path: '../.env' });
}

// ──────────────────── constants ───────────────────
const PORT                   = 3001;
const CACHE_TTL_SEC          = 300;         // 5 minutes
const MAX_PARALLEL_DOWNLOADS = 5;

const {
  MARKDOWN_FOLDER_ID,
  JSON_FOLDER_ID,
  RESULT_FOLDER_ID,
  GOOGLE_CLOUD_CREDENTIALS,
} = process.env;

// ──────────────────── app setup ───────────────────
const app = express();
app.use(compression());

const allowedOrigins = [
  'https://json-editor-dspy.vercel.app',
  'http://localhost:5173',
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('CORS: origin not allowed'), false);
    },
  }),
);
app.use(express.json());

// ──────────────────── cache helpers ───────────────
const cache     = new NodeCache({ stdTTL: CACHE_TTL_SEC, checkperiod: CACHE_TTL_SEC * 1.1 });
const cacheGet  = (k)        => cache.get(k);
const cacheSet  = (k, v)     => cache.set(k, v);
const cacheDel  = (pref='')  =>
  pref ? cache.keys().forEach(k => k.startsWith(pref) && cache.del(k)) : cache.flushAll();

// ────────────── Google Drive client setup ─────────
const credentials = JSON.parse(GOOGLE_CLOUD_CREDENTIALS);
function initDrive() {
  const auth = new google.auth.JWT({
    email:  credentials.client_email,
    key:    credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}
const drive = initDrive();

// ───────────── list‑all helper (pagination) ───────
async function listAll(query, fields) {
  const out = [];
  let pageToken = null;
  do {
    const { data } = await drive.files.list({
      q: query,
      fields: `nextPageToken, files(${fields})`,
      pageSize: 1000,
      pageToken,
    });
    if (data.files?.length) out.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

// ───────────── fetch & cache raw file bytes ───────
const limit = pLimit(MAX_PARALLEL_DOWNLOADS);

async function fetchFileBytes(fileId) {
  const key = `file-${fileId}`;
  const hit = cacheGet(key);
  if (hit) return hit;

  const { data } = await drive.files.get({
    fileId,
    alt: 'media',
    responseType: 'arraybuffer',
  });

  const buf =
    Buffer.isBuffer(data)
      ? data
      : data instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(data))
      : typeof data === 'object'
      ? Buffer.from(JSON.stringify(data))
      : Buffer.from(String(data));

  cacheSet(key, buf);
  return buf;
}

// ───────────────────── routes ─────────────────────

// list markdown files
app.get('/api/markdown-files', async (_, res) => {
  const k = 'markdown-index';
  const hit = cacheGet(k);
  if (hit) return res.json(hit);

  try {
    const files = await listAll(
      `'${MARKDOWN_FOLDER_ID}' in parents and trashed=false`,
      'id,name,modifiedTime',
    );
    cacheSet(k, files);
    res.json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list markdown files' });
  }
});

// list JSON folders (and their files)
app.get('/api/json-folders', async (_, res) => {
  const k = 'json-index';
  const hit = cacheGet(k);
  if (hit) return res.json(hit);

  try {
    const folders = await listAll(
      `'${JSON_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      'id,name',
    );
    const out = await Promise.all(
      folders.map(async (f) => ({
        ...f,
        files: await listAll(
          `'${f.id}' in parents and mimeType='application/json' and trashed=false`,
          'id,name,modifiedTime',
        ),
      })),
    );
    cacheSet(k, out);
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list JSON folders' });
  }
});

// list result‑files
app.get('/api/result-files', async (_, res) => {
  const k = 'result-index';
  const hit = cacheGet(k);
  if (hit) return res.json(hit);

  try {
    const folders = await listAll(
      `'${RESULT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      'id,name',
    );
    const out = await Promise.all(
      folders.map(async (f) => ({
        folderId: f.id,
        folderName: f.name,
        files: await listAll(
          `'${f.id}' in parents and mimeType='application/json' and trashed=false`,
          'id,name,modifiedTime',
        ),
      })),
    );
    cacheSet(k, out);
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch result folder files' });
  }
});

// file content (UTF‑8)
app.get('/api/files/:fileId/content', async (req, res) => {
  try {
    const buf = await limit(() => fetchFileBytes(req.params.fileId));
    res.send(buf.toString('utf8'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch file content' });
  }
});

// download (raw stream → cache)
app.get('/api/files/:fileId/download', async (req, res) => {
  try {
    const { fileId } = req.params;
    const {
      data: { name },
    } = await drive.files.get({ fileId, fields: 'name' });
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL_SEC}`);

    const hit = cacheGet(`file-${fileId}`);
    if (hit) return res.end(hit);

    const { data: stream } = await drive.files.get({
      fileId,
      alt: 'media',
      responseType: 'stream',
    });
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => cacheSet(`file-${fileId}`, Buffer.concat(chunks)));
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Download failed' });
  }
});

// save/replace a JSON file inside a result sub‑folder
app.post('/api/save-json', async (req, res) => {
  try {
    const { jsonFile = {}, folderName } = req.body;

    if (!folderName || !jsonFile.name || jsonFile.content === undefined) {
      return res
        .status(400)
        .json({ error: 'Invalid body: folderName, jsonFile.name & .content required' });
    }

    // ensure destination folder
    const matches = await listAll(
      `'${RESULT_FOLDER_ID}' in parents and name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      'id',
    );
    let destFolderId;
    if (matches.length) destFolderId = matches[0].id;
    else {
      const { data } = await drive.files.create({
        resource: {
          name: folderName,
          parents: [RESULT_FOLDER_ID],
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      destFolderId = data.id;
    }

    // delete existing file (if any)
    const existing = await listAll(
      `'${destFolderId}' in parents and name='${jsonFile.name.replace(
        /'/g,
        "\\'",
      )}' and mimeType='application/json' and trashed=false`,
      'id',
    );
    if (existing.length) {
      await drive.files.delete({ fileId: existing[0].id });
    }

    // upload new file
    const body =
      typeof jsonFile.content === 'string'
        ? jsonFile.content
        : JSON.stringify(jsonFile.content, null, 2);

    await drive.files.create({
      resource: {
        name: jsonFile.name,
        parents: [destFolderId],
        mimeType: 'application/json',
      },
      media: { mimeType: 'application/json', body },
      fields: 'id',
    });

    cacheDel('result-index');
    res.json({ message: 'File saved successfully' });
  } catch (err) {
    console.error('[save-json] error', err);
    res.status(500).json({ error: 'Failed to save JSON file' });
  }
});

// clear cache (entire or by prefix)
app.post('/api/cache/clear', (req, res) => {
  try {
    const { keyPrefix = '' } = req.body ?? {};
    cacheDel(keyPrefix);
    res.json({ message: 'Cache cleared', clearedPrefix: keyPrefix || 'all' });
  } catch (err) {
    console.error('[cache/clear] error', err);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// health
app.get('/api/health', (_, res) =>
  res.json({ status: 'OK', cachedKeys: cache.keys().length }),
);

// ──────────────────── export / listen ─────────────
export default app;              // ← Vercel picks this up

// local dev convenience
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server running → http://localhost:${PORT}`));
}
// server.js
/* eslint-disable no-console */
const express      = require('express');
const cors         = require('cors');
const compression  = require('compression');
const { google }   = require('googleapis');
const NodeCache    = require('node-cache');
const pLimit       = require('p-limit').default;
const dotenv       = require('dotenv');

// Load environment variables
dotenv.config({ path: '../.env' });

console.log(process.env)

/* ----------------------------- constants ----------------------------- */
const PORT                   = 3001;
const CACHE_TTL_SEC          = 300;   // 5 minutes
const MAX_PARALLEL_DOWNLOADS = 5;

// Folder IDs moved to environment variables for security
// Add these to your .env file:
// MARKDOWN_FOLDER_ID=1YIbPXYUwDhQ_wjSlFEdaM-Fio0wdzoJS
// JSON_FOLDER_ID=183oEQEl_4KFbxLpfFNvX11YDXbD8cUgf
// RESULT_FOLDER_ID=1rVwwuNmExsaV1QJm4z4MYrEXk9etixlw
const MARKDOWN_FOLDER_ID = process.env.MARKDOWN_FOLDER_ID
const JSON_FOLDER_ID     = process.env.JSON_FOLDER_ID;
const RESULT_FOLDER_ID   = process.env.RESULT_FOLDER_ID;

/* ---------------------------- app setup ----------------------------- */
const app = express();
app.use(compression());
app.use(cors());
app.use(express.json());

/* ------------------------------ cache -------------------------------- */
const cache = new NodeCache({ stdTTL: CACHE_TTL_SEC, checkperiod: CACHE_TTL_SEC * 1.1 });
const cacheGet = (k)            => cache.get(k);
const cacheSet = (k, v)         => cache.set(k, v);
const cacheDel = (pref='')      => pref ? cache.keys().forEach(k=>k.startsWith(pref)&&cache.del(k)) : cache.flushAll();

/* ------------------------ Google Drive client ------------------------ */
const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
function initDrive() {
  const auth = new google.auth.JWT({
    email:  credentials.client_email,
    key:    credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive']
    });
  return google.drive({ version: 'v3', auth });
}
const drive = initDrive();

/* ----------------------- helper: list all items ---------------------- */
async function listAll(query, fields) {
  let out = [], pageToken = null;
  do {
    const { data } = await drive.files.list({
      q: query,
      fields: `nextPageToken, files(${fields})`,
      pageSize: 1000,
      pageToken
    });
    if (data.files?.length) out.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

/* --------------- helper: download & cache file bytes ---------------- */
const limit = pLimit(MAX_PARALLEL_DOWNLOADS);
// download & cache file bytes (stream‑based, always returns a Buffer)
// download & cache file bytes – always returns a Buffer
async function fetchFileBytes(fileId) {
  const key = `file-${fileId}`;
  const hit = cacheGet(key);
  if (hit) return hit;

  // ask Drive for raw bytes
  const { data } = await drive.files.get({
    fileId,
    alt: 'media',
    responseType: 'arraybuffer',   // prefer raw binary
  });

  let buf;

  if (Buffer.isBuffer(data)) {
    buf = data;                                   // already a Buffer
  } else if (data instanceof ArrayBuffer) {
    buf = Buffer.from(new Uint8Array(data));      // convert ArrayBuffer
  } else if (typeof data === 'object') {
    buf = Buffer.from(JSON.stringify(data));      // JSON auto‑parsed by gaxios
  } else {                                        // string or other
    buf = Buffer.from(String(data));
  }

  cacheSet(key, buf);
  return buf;
}

/* ------------------------------- routes ------------------------------ */
// markdown list
app.get('/api/markdown-files', async (_, res) => {
  const k = 'markdown-index';
  const hit = cacheGet(k);
  if (hit) {
    res.setHeader('Content-Type', 'application/json');
    return res.json(hit);
  }

  try {
    const files = await listAll(
      `'${MARKDOWN_FOLDER_ID}' in parents and trashed=false`,
      'id,name,modifiedTime'
    );
    cacheSet(k, files);
    res.setHeader('Content-Type', 'application/json');
    res.json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Failed to list markdown files' });
  }
});

// json folder list
app.get('/api/json-folders', async (_, res) => {
  const k = 'json-index';
  const hit = cacheGet(k);
  if (hit) return res.json(hit);

  try {
    const folders = await listAll(
      `'${JSON_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      'id,name'
    );
    const out = await Promise.all(
      folders.map(async f => ({
        ...f,
        files: await listAll(
          `'${f.id}' in parents and mimeType='application/json' and trashed=false`,
          'id,name,modifiedTime'
        )
      }))
    );
    cacheSet(k, out);
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Failed to list JSON folders' });
  }
});

// **result‑files list**  ← restored
app.get('/api/result-files', async (_, res) => {
  const k = 'result-index';
  const hit = cacheGet(k);
  if (hit) return res.json(hit);

  try {
    const folders = await listAll(
      `'${RESULT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      'id,name'
    );
    const out = await Promise.all(
      folders.map(async f => ({
        folderId:   f.id,
        folderName: f.name,
        files: await listAll(
          `'${f.id}' in parents and mimeType='application/json' and trashed=false`,
          'id,name,modifiedTime'
        )
      }))
    );
    cacheSet(k, out);
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Failed to fetch result folder files' });
  }
});

// file content (UTF‑8)
app.get('/api/files/:fileId/content', async (req, res) => {
  try {
    const buf = await limit(() => fetchFileBytes(req.params.fileId));
    res.send(buf.toString('utf8'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Failed to fetch file content' });
  }
});

// download (stream + cache)
app.get('/api/files/:fileId/download', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { data:{name} } = await drive.files.get({ fileId, fields:'name' });
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL_SEC}`);

    const hit = cacheGet(`file-${fileId}`);
    if (hit) return res.end(hit);

    const { data:stream } = await drive.files.get({ fileId, alt:'media', responseType:'stream' });
    const chunks=[];
    stream.on('data', c=>chunks.push(c));
    stream.on('end',()=>cacheSet(`file-${fileId}`, Buffer.concat(chunks)));
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Download failed' });
  }
});

// POST /api/save-json  – creates / overwrites a JSON file in a result sub‑folder
app.post('/api/save-json', async (req, res) => {
  try {
    const { jsonFile = {}, folderName } = req.body;

    /* ---------- basic validation (log details before bailing) --------- */
    if (!folderName || !jsonFile.name || jsonFile.content === undefined) {
      console.warn('[save-json] bad request body', req.body);
      return res.status(400).json({
        error: 'Invalid request: must include folderName, jsonFile.name, jsonFile.content',
      });
    }

    /* ---------------- ensure destination folder exists --------------- */
    const matches = await listAll(
      `'${RESULT_FOLDER_ID}' in parents ` +
        `and name='${folderName.replace(/'/g, "\\'")}' ` +
        `and mimeType='application/vnd.google-apps.folder' ` +
        `and trashed=false`,
      'id'
    );

    let destFolderId;
    if (matches.length) {
      destFolderId = matches[0].id;
    } else {
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

    /* -------------------- upload or overwrite file ------------------- */
    const mediaBody =
      typeof jsonFile.content === 'string'
        ? jsonFile.content
        : JSON.stringify(jsonFile.content, null, 2);
    
    // Check if a file with the same name already exists in the destination folder
    const existingFiles = await listAll(
      `'${destFolderId}' in parents ` +
        `and name='${jsonFile.name.replace(/'/g, "\\'")}'` +
        `and mimeType='application/json' ` +
        `and trashed=false`,
      'id,name'
    );
    
    // If file exists, delete it first
    if (existingFiles.length > 0) {
      console.log(`[save-json] replacing existing file: ${jsonFile.name}`);
      await drive.files.delete({
        fileId: existingFiles[0].id
      });
    }

    // Create the new file
    await drive.files.create({
      resource: {
        name: jsonFile.name,
        parents: [destFolderId],
        mimeType: 'application/json',
      },
      media: { mimeType: 'application/json', body: mediaBody },
      fields: 'id',
    });

    /* -------------------- invalidate cached index -------------------- */
    cacheDel('result-index');

    res.json({ message: 'File saved successfully' });
  } catch (err) {
    console.error('[save-json] error', err);
    res.status(500).json({ error: 'Failed to save JSON file' });
  }
});

// POST /api/cache/clear – invalidate whole cache or keys that start with a prefix
app.post('/api/cache/clear', (req, res) => {
  try {
    const { keyPrefix = '' } = req.body ?? {};
    cacheDel(keyPrefix);                               // ← existing helper
    res.json({
      message: 'Cache cleared',
      clearedPrefix: keyPrefix || 'all',
    });
  } catch (err) {
    console.error('[cache/clear] error', err);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});


// health
app.get('/api/health', (_, res) =>
  res.json({ status:'OK', cachedKeys: cache.keys().length })
);

/* ------------------------------- start ------------------------------- */
app.listen(PORT, () =>
  console.log(`Server running → http://localhost:${PORT}`)
);

// Arcano AI: questionario -> carta dei tarocchi personalizzata (Leonardo Nano Banana 2) -> video (Kling 3.0 via Leonardo)
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ARCANI, DOMANDE, calcola, descrizione } = require('./arcani');
const { componi, PANEL_FRAZ } = require('./template');

const API = 'https://cloud.leonardo.ai/api/rest/v1';
const API_V2 = 'https://cloud.leonardo.ai/api/rest/v2';
const KEY = process.env.LEONARDO_API_KEY;
const auth = { authorization: `Bearer ${KEY}`, accept: 'application/json' };

const MODEL = process.env.LEONARDO_MODEL || 'nano-banana-2';
const REF_STRENGTH = process.env.REF_STRENGTH || 'HIGH';
const VIDEO_MODEL = process.env.VIDEO_MODEL || 'kling-3.0';
const VIDEO_DURATION = parseInt(process.env.VIDEO_DURATION || '5', 10);
const VIDEO_MODE = process.env.VIDEO_MODE || 'RESOLUTION_720';
const VIDEO_PROMPT = process.env.VIDEO_PROMPT || 'Subtle cinematic animation of this tarot card. The camera is completely static. The person slowly lifts their gaze to the viewer, blinks naturally, breathes gently and gives a warm, confident smile. Clothing and cloak move softly as in a light breeze. Light rays and symbols in the background glow and pulse gently. Clouds and floating elements drift slowly. Animals move only slightly: manes and tails in the wind, a gentle head movement, no walking or running. Keep the face, hands and identity unchanged. Smooth, elegant, no morphing.';
const PORT = process.env.PORT || 3000;

// Illustrazione generata dall'AI: 4:5, va nel riquadro della carta. Il resto della carta lo compone template.js
const IMG_W = parseInt(process.env.IMG_W || '928', 10), IMG_H = parseInt(process.env.IMG_H || '1152', 10);

const DATA = path.join(__dirname, 'data');
fs.mkdirSync(DATA, { recursive: true });
const DB_FILE = path.join(DATA, 'carte.json');
let db = {};
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch {}
const salva = () => fs.writeFile(DB_FILE, JSON.stringify(db, null, 1), () => {});

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
app.set('trust proxy', true);
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Leonardo ----------

async function uploadInitImage(buffer, mimetype) {
  const ext = mimetype === 'image/png' ? 'png' : mimetype === 'image/webp' ? 'webp' : 'jpg';
  const r = await fetch(`${API}/init-image`, {
    method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ extension: ext })
  });
  if (!r.ok) throw new Error(`init-image: ${r.status} ${await r.text()}`);
  const { uploadInitImage: u } = await r.json();
  const fields = typeof u.fields === 'string' ? JSON.parse(u.fields) : u.fields;
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('file', new Blob([buffer], { type: mimetype }), `photo.${ext}`);
  const up = await fetch(u.url, { method: 'POST', body: form });
  if (!up.ok && up.status !== 204) throw new Error(`upload S3: ${up.status} ${await up.text()}`);
  return u.id;
}

// La foto originale non serve più dopo la generazione: la cancelliamo da Leonardo (best effort)
async function deleteInitImage(id) {
  try { await fetch(`${API}/init-image/${encodeURIComponent(id)}`, { method: 'DELETE', headers: auth }); } catch {}
}

function cardPrompt(arcano, scelte) {
  const a = ARCANI[arcano];
  const tratti = [a.traits, ...scelte.map(o => o.en)].join(', ');
  return `Using the person in the reference photo as the subject, create a dreamlike painterly storybook illustration, vertical 4:5, filling the entire image edge to edge.

Keep the person's face clearly recognizable: same facial features, face shape, hairstyle and skin tone. The person is the clear focus, shown from the waist up, centered, with the face in the upper third of the image.

The scene represents the tarot archetype ${a.nome.m} with these traits: ${tratti}. Symbols: ${a.simboli}. Secondary elements stay smaller and further back, they never crowd the figure or cover the lower part of the body. Animals, if any, are small and in the background.

Style: whimsical, poetic, gently surreal, soft gouache and oil textures, warm luminous colors, a few floating dreamlike elements in the sky, a symbolic landscape that tells the traits visually.

No text, no letters, no border, no frame, no card layout: only the illustration. Mood: positive, magical, inspiring. No dark or ominous elements.`;
}

async function createImage(initImageId, prompt, w = IMG_W, h = IMG_H) {
  const r = await fetch(`${API_V2}/generations`, {
    method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, public: false,
      parameters: {
        prompt, width: w, height: h, quantity: 1, prompt_enhance: 'OFF',
        guidances: { image_reference: [{ image: { id: initImageId, type: 'UPLOADED' }, strength: REF_STRENGTH }] }
      }
    })
  });
  const text = await r.text();
  // Se il formato 4:5 non fosse accettato dal modello, ripiega sul 2:3 già collaudato
  if (r.status === 400 && w !== 848) { console.warn('Formato non accettato, uso 848x1264:', text); return createImage(initImageId, prompt, 848, 1264); }
  if (!r.ok) throw new Error(`generations: ${r.status} ${text}`);
  const j = JSON.parse(text);
  if (Array.isArray(j)) throw new Error(`generations: ${text}`);
  const id = j.generate?.generationId || j.sdGenerationJob?.generationId || j.generationId;
  if (!id) throw new Error(`generations: risposta inattesa ${text}`);
  return id;
}

async function getGeneration(id) {
  const r = await fetch(`${API}/generations/${encodeURIComponent(id)}`, { headers: auth });
  if (!r.ok) throw new Error(`get generation: ${r.status} ${await r.text()}`);
  return (await r.json()).generations_by_pk;
}

async function waitForImage(genId) {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const g = await getGeneration(genId);
    if (g?.status === 'FAILED') throw new Error('generazione fallita');
    if (g?.status === 'COMPLETE' && g.generated_images?.length) return g.generated_images[0];
  }
  throw new Error('timeout generazione immagine');
}

async function startVideo(imageId) {
  const r = await fetch(`${API_V2}/generations`, {
    method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: VIDEO_MODEL, public: false,
      parameters: {
        prompt: VIDEO_PROMPT, duration: VIDEO_DURATION, mode: VIDEO_MODE, motion_has_audio: false,
        guidances: { start_frame: [{ image: { id: imageId, type: 'GENERATED' } }] }
      }
    })
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`video: ${r.status} ${text}`);
  const j = JSON.parse(text);
  if (Array.isArray(j)) throw new Error(`video: ${text}`);
  const id = j.generate?.generationId || j.motionVideoGenerationJob?.generationId || j.sdGenerationJob?.generationId || j.generationId;
  if (!id) throw new Error(`video: risposta inattesa ${text}`);
  return id;
}

function findMp4(o) {
  if (!o) return null;
  if (typeof o === 'string') return /^https?:\/\/.+\.mp4(\?|$)/i.test(o) ? o : null;
  if (typeof o === 'object') for (const v of Object.values(o)) { const f = findMp4(v); if (f) return f; }
  return null;
}

function baseUrl(req) {
  return (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

// ---------- API ----------

app.get('/api/domande', (req, res) => {
  res.json(DOMANDE.map(d => ({ testo: d.testo, opzioni: d.opzioni.map(o => o.testo) })));
});

app.post('/api/carta', upload.single('photo'), async (req, res) => {
  let initId;
  try {
    if (!KEY) return res.status(500).json({ error: 'LEONARDO_API_KEY mancante sul server' });
    if (!req.file) return res.status(400).json({ error: 'Manca la foto' });
    if (req.body.consenso !== 'si') return res.status(400).json({ error: 'Serve il consenso' });
    const risposte = JSON.parse(req.body.risposte || '[]').map(Number);
    const genere = req.body.genere === 'f' ? 'f' : 'm';
    const { arcano, scelte } = calcola(risposte);
    const a = ARCANI[arcano];

    const id = crypto.randomBytes(5).toString('hex');
    initId = await uploadInitImage(req.file.buffer, req.file.mimetype);
    const genId = await createImage(initId, cardPrompt(arcano, scelte));
    const gi = await waitForImage(genId);
    deleteInitImage(initId); initId = null;

    const imgBuf = Buffer.from(await (await fetch(gi.url)).arrayBuffer());
    const card = await componi({
      illustrazione: imgBuf,
      nome: a.nome[genere] || a.nome.m,
      motto: a.motto,
      qrUrl: `${baseUrl(req)}/c/${id}`
    });
    fs.writeFileSync(path.join(DATA, `${id}.png`), card);

    db[id] = {
      id, arcano, genere, creata: new Date().toISOString(),
      nome: a.nome[genere] || a.nome.m,
      testo: descrizione(arcano, risposte, genere),
      leonardoImageId: gi.id, videoGenId: null, videoUrl: null, videoStato: 'IN_CORSO'
    };
    // Il video parte subito, così è pronto anche se la persona chiude la pagina
    try { db[id].videoGenId = await startVideo(gi.id); }
    catch (e) { console.error(e); db[id].videoStato = 'FALLITO'; }
    salva();
    res.json(pubblica(db[id]));
  } catch (e) {
    console.error(e);
    if (initId) deleteInitImage(initId);
    res.status(500).json({ error: 'Non sono riuscito a creare la carta, riprova.' });
  }
});

function pubblica(c) {
  return {
    id: c.id, nome: c.nome, testo: c.testo, arcano: c.arcano,
    immagine: `/carte/${c.id}.png`, riquadro: PANEL_FRAZ, video: c.videoStato
  };
}

app.get('/api/carta/:id', (req, res) => {
  const c = db[req.params.id];
  if (!c) return res.status(404).json({ error: 'Carta non trovata' });
  res.json(pubblica(c));
});

// Stato del video (il browser lo interroga ogni pochi secondi)
app.get('/api/video/:id', async (req, res) => {
  try {
    const c = db[req.params.id];
    if (!c) return res.status(404).json({ error: 'Carta non trovata' });
    if (c.videoStato === 'IN_CORSO' && c.videoGenId) {
      const g = await getGeneration(c.videoGenId);
      if (g?.status === 'FAILED') c.videoStato = 'FALLITO';
      const url = g?.status === 'COMPLETE' ? findMp4(g.generated_images) : null;
      if (url) { c.videoUrl = url; c.videoStato = 'PRONTO'; }
      if (c.videoStato !== 'IN_CORSO') salva();
    }
    res.json({ stato: c.videoStato, url: c.videoStato === 'PRONTO' ? `/api/video-file/${c.id}` : null });
  } catch (e) {
    console.error(e);
    res.json({ stato: 'IN_CORSO' });
  }
});

// Il video passa dal nostro server (stessa origine, supporto Range per Safari)
app.get('/api/video-file/:id', async (req, res) => {
  try {
    const c = db[req.params.id];
    if (!c?.videoUrl) return res.status(404).json({ error: 'video non pronto' });
    const up = await fetch(c.videoUrl, { headers: req.headers.range ? { range: req.headers.range } : {} });
    res.status(up.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
      const v = up.headers.get(h); if (v) res.setHeader(h, v);
    }
    if (!up.headers.get('content-type')) res.setHeader('content-type', 'video/mp4');
    if (!up.headers.get('accept-ranges')) res.setHeader('accept-ranges', 'bytes');
    res.setHeader('cache-control', 'public, max-age=3600');
    if (!up.body) return res.end();
    const reader = up.body.getReader();
    req.on('close', () => reader.cancel().catch(() => {}));
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) await new Promise(r => res.once('drain', r));
    }
    res.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: 'video_failed' }); else res.end();
  }
});

app.get('/carte/:file', (req, res) => {
  const f = path.basename(req.params.file);
  if (!/^[0-9a-f]{10}\.png$/.test(f)) return res.status(404).end();
  const p = path.join(DATA, f);
  if (!fs.existsSync(p)) return res.status(404).end();
  res.sendFile(p);
});

// Pagina aperta dal QR stampato sulla carta
app.get('/c/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'carta.html')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 500).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Foto troppo pesante' : 'Errore del server' });
});

app.listen(PORT, () => console.log(`Pronto su http://localhost:${PORT} (immagine: ${MODEL}, video: ${VIDEO_MODEL})`));

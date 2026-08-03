import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(express.json())

// Permitir peticiones desde bsky.app (para el bookmarklet)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-admin-key')
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

const ADMIN_KEY = process.env.ADMIN_KEY || 'cambiar-esto'
const HOSTNAME = process.env.HOSTNAME || 'localhost'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_REPO = process.env.GITHUB_REPO
const DATA_FILE = 'data.json'

// ─── GitHub storage ───────────────────────────────────────────────────────────

async function readData() {
  try {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })
    if (r.status === 404) return { feeds: {}, posts: {} }
    const json = await r.json()
    const content = Buffer.from(json.content, 'base64').toString('utf8')
    return JSON.parse(content)
  } catch (e) {
    console.error('readData error:', e.message)
    return { feeds: {}, posts: {} }
  }
}

async function writeData(data) {
  let sha = null
  try {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })
    if (r.ok) {
      const json = await r.json()
      sha = json.sha
    }
  } catch (e) {}

  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64')
  const body = { message: 'Update feed data', content, ...(sha && { sha }) }

  const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  if (!r.ok) console.error('writeData error:', await r.text())
}

// ─── AT Protocol ─────────────────────────────────────────────────────────────

app.get('/.well-known/did.json', (req, res) => {
  res.json({
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: `did:web:${HOSTNAME}`,
    service: [{ id: '#bsky_fg', type: 'BskyFeedGenerator', serviceEndpoint: `https://${HOSTNAME}` }]
  })
})

app.get('/xrpc/app.bsky.feed.getFeedSkeleton', async (req, res) => {
  const feedUri = req.query.feed
  if (!feedUri) return res.status(400).json({ error: 'feed param required' })
  const feedId = feedUri.split('/').pop()
  const data = await readData()
  if (!data.feeds[feedId]) return res.status(404).json({ error: 'feed not found' })
  const limit = Math.min(parseInt(req.query.limit) || 30, 100)
  const cursor = req.query.cursor ? parseInt(req.query.cursor) : Date.now()
  const posts = (data.posts[feedId] || [])
    .filter(p => p.added_at < cursor)
    .sort((a, b) => b.added_at - a.added_at)
    .slice(0, limit)
  const newCursor = posts.length > 0 ? String(posts[posts.length - 1].added_at) : undefined
  res.json({ feed: posts.map(p => ({ post: p.uri })), ...(newCursor && { cursor: newCursor }) })
})

// ─── Auth ─────────────────────────────────────────────────────────────────────

function checkAuth(req, res) {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) {
    res.status(401).json({ error: 'No autorizado' })
    return false
  }
  return true
}

// ─── API JSON ────────────────────────────────────────────────────────────────

app.get('/admin/feeds', async (req, res) => {
  if (!checkAuth(req, res)) return
  const data = await readData()
  res.json(Object.values(data.feeds))
})

app.post('/admin/feeds', async (req, res) => {
  if (!checkAuth(req, res)) return
  const { id, name, description, did } = req.body
  if (!did) return res.status(400).json({ error: 'did requerido' })
  const data = await readData()
  if (data.feeds[id]) return res.status(409).json({ error: 'feed ya existe' })
  data.feeds[id] = { id, name, description, did }
  data.posts[id] = []
  await writeData(data)
  res.json({ ok: true, feed_uri: `at://${did}/app.bsky.feed.generator/${id}` })
})

app.post('/admin/feeds/:feedId/posts', async (req, res) => {
  if (!checkAuth(req, res)) return
  const { uri } = req.body
  const { feedId } = req.params
  const data = await readData()
  if (!data.feeds[feedId]) return res.status(404).json({ error: 'feed not found' })
  if (!data.posts[feedId]) data.posts[feedId] = []
  if (!data.posts[feedId].find(p => p.uri === uri)) {
    data.posts[feedId].push({ uri, added_at: Date.now() })
    await writeData(data)
  }
  res.json({ ok: true })
})

app.delete('/admin/feeds/:feedId/posts', async (req, res) => {
  if (!checkAuth(req, res)) return
  const { uri } = req.body
  const { feedId } = req.params
  const data = await readData()
  if (data.posts[feedId]) {
    data.posts[feedId] = data.posts[feedId].filter(p => p.uri !== uri)
    await writeData(data)
  }
  res.json({ ok: true })
})

app.get('/admin/feeds/:feedId/posts', async (req, res) => {
  if (!checkAuth(req, res)) return
  const data = await readData()
  res.json((data.posts[req.params.feedId] || []).sort((a, b) => b.added_at - a.added_at))
})

app.post('/admin/register-feed', async (req, res) => {
  if (!checkAuth(req, res)) return
  const { feedId, appPassword, identifier, avatarBase64, avatarMimeType } = req.body
  if (!feedId || !appPassword || !identifier) return res.status(400).json({ error: 'Faltan parámetros' })

  const data = await readData()
  const feed = data.feeds[feedId]
  if (!feed) return res.status(404).json({ error: 'Feed no encontrado' })

  // Obtener token de sesión
  const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: appPassword })
  })
  if (!sessionRes.ok) return res.status(401).json({ error: 'App Password incorrecta o cuenta no encontrada' })
  const session = await sessionRes.json()

  // Subir avatar si se proporcionó
  let avatarBlob = null
  if (avatarBase64 && avatarMimeType) {
    const imageBuffer = Buffer.from(avatarBase64, 'base64')
    const blobRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
      method: 'POST',
      headers: {
        'Content-Type': avatarMimeType,
        'Authorization': `Bearer ${session.accessJwt}`
      },
      body: imageBuffer
    })
    if (blobRes.ok) {
      const blobData = await blobRes.json()
      avatarBlob = blobData.blob
    }
  }

  // Registrar el feed en Bluesky
  const record = {
    '$type': 'app.bsky.feed.generator',
    did: `did:web:${HOSTNAME}`,
    displayName: feed.name,
    description: feed.description || '',
    createdAt: new Date().toISOString()
  }
  if (avatarBlob) record.avatar = avatarBlob

  const recordRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.putRecord', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.accessJwt}` },
    body: JSON.stringify({
      repo: feed.did,
      collection: 'app.bsky.feed.generator',
      rkey: feedId,
      record
    })
  })
  if (!recordRes.ok) {
    const err = await recordRes.text()
    return res.status(500).json({ error: 'Error al registrar en Bluesky: ' + err })
  }
  res.json({ ok: true, url: `https://bsky.app/profile/${identifier}/feed/${feedId}` })
})

// ─── Interfaz web ────────────────────────────────────────────────────────────

app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, 'admin.html'))
})

// ─── Arrancar ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Feed generator corriendo en http://localhost:${PORT}`))

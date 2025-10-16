import fs from 'fs';
import express from 'express';
import bodyParser from 'body-parser';
import qrcode from 'qrcode';
import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'cambia_esto';
const AUTH_DIR = './auth_data';
const AUTH_PATH = process.env.AUTH_PATH || './auth_info.json'; // usa /data en Render (disk)
let latestQR = null;


// Asegurar carpeta
fs.mkdirSync(AUTH_DIR, { recursive: true });

/**
 * Si ya existe auth_backup.json, restaurar su contenido a los archivos de Baileys
 */
/**
if (fs.existsSync(BACKUP_FILE)) {
  console.log('🔁 Restaurando sesión desde auth_backup.json...');
  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
  for (const [filename, content] of Object.entries(backup)) {
    fs.writeFileSync(`${AUTH_DIR}/${filename}`, content);
  }
}
*/
const app = express();
app.use(bodyParser.json());

// Inicializar autenticación
const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

const sock = makeWASocket({
  auth: state,
  printQRInTerminal: false,
});

// Guardar credenciales cuando cambien
sock.ev.on('creds.update', async () => {
  await saveCreds();

  // Guardar backup en un solo archivo JSON
  const files = fs.readdirSync(AUTH_DIR);
  const backup = {};
  for (const file of files) {
    const content = fs.readFileSync(`${AUTH_DIR}/${file}`, 'utf8');
    backup[file] = content;
  }
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
  console.log('💾 Credenciales actualizadas en auth_backup.json');
});


sock.ev.on('connection.update', (update) => {
  const { qr, connection, lastDisconnect } = update;

  if (qr) {
    latestQR = qr;
    console.log('📱 Nuevo QR generado. Usa el endpoint /qr para verlo.');
  }

  if (connection === 'open') {
    latestQR = null;
    console.log(`✅ Conectado como ${sock.user?.id}`);
  }

  if (connection === 'close') {
    console.log('❌ Desconectado:', lastDisconnect?.error || lastDisconnect);
  }
});

// Middleware de API key
function requireKey(req, res, next) {
  const key = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (key !== API_KEY) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

// Endpoints
app.get('/status', requireKey, (req, res) => {
  res.json({ connected: !!sock.user, user: sock.user || null });
});

app.get('/qr', requireKey, async (req, res) => {
  if (!latestQR) return res.json({ ok: false, message: 'No hay QR activo' });
  const dataUrl = await qrcode.toDataURL(latestQR);
  res.json({ ok: true, qr: dataUrl });
});

app.post('/send', requireKey, async (req, res) => {
  try {
    const { to, text } = req.body;
    if (!to || !text) return res.status(400).json({ ok: false, error: 'Faltan parámetros' });
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const result = await sock.sendMessage(jid, { text });
    res.json({ ok: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.toString() });
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor activo en puerto ${PORT}`));

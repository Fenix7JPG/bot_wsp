import express from 'express';
import bodyParser from 'body-parser';
import qrcode from 'qrcode';
import { makeWASocket, useSingleFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'cambia_esto';
const AUTH_PATH = process.env.AUTH_PATH || '/data/auth_info.json'; // usa /data en Render (disk)
let latestQR = null;

const app = express();
app.use(bodyParser.json());

// auth state (single-file) - guarda en /data para persistir
const { state, saveState } = await useSingleFileAuthState(AUTH_PATH);

// crea socket
const sock = makeWASocket({
  auth: state,
  printQRInTerminal: false
});

sock.ev.on('creds.update', saveState);

sock.ev.on('connection.update', (update) => {
  // update puede contener 'qr' string, 'connection' y 'lastDisconnect'
  if (update.qr) {
    latestQR = update.qr; // string que puedes convertir a imagen
  }
  if (update.connection === 'open') {
    latestQR = null;
    console.log('✅ Conectado a WhatsApp');
  }
  if (update.lastDisconnect) {
    const reason = update.lastDisconnect.error?.output?.statusCode || update.lastDisconnect.error;
    console.log('Desconectado:', reason);
  }
});

// middleware api-key simple
function requireKey(req, res, next) {
  const key = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (key !== API_KEY) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

// endpoint para ver estado
app.get('/status', requireKey, (req, res) => {
  res.json({ connected: !!sock.user, user: sock.user || null });
});

// endpoint para pedir QR (para emparejar la primera vez)
app.get('/qr', requireKey, async (req, res) => {
  if (!latestQR) return res.json({ ok: false, qr: null, msg: 'No hay QR activo. ¿Ya emparejaste?' });
  // devuelve dataURL de imagen para mostrar en navegador
  const dataUrl = await qrcode.toDataURL(latestQR);
  res.json({ ok: true, dataUrl });
});

// endpoint para enviar mensaje (bridge para Python)
app.post('/send', requireKey, async (req, res) => {
  try {
    const { to, text } = req.body;
    if (!to || !text) return res.status(400).json({ ok: false, error: 'to y text son requeridos' });
    // to debe tener formato '519XXXXXXXX@s.whatsapp.net' o simplemente '519XXXXXXXX'
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const result = await sock.sendMessage(jid, { text });
    res.json({ ok: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.toString() });
  }
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));

import makeWASocket, { fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import P from 'pino'
import fs from 'fs'
import qrcode from 'qrcode-terminal'

const AUTH_FILE = './auth.json'

// Cargar o crear estado vacío
let state = fs.existsSync(AUTH_FILE)
  ? JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
  : { creds: {}, keys: {} }

async function start() {
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'silent' }),
  })

  // Guardar credenciales cada vez que se actualicen
  sock.ev.on('creds.update', () => {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2))
  })

  // Manejo de conexión
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 Escanea este QR con tu WhatsApp (solo primera vez)\n')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'connecting') console.log('🔌 Conectando...')
    if (connection === 'open') console.log('✅ Conectado con WhatsApp Web!')

    if (connection === 'close') {
      console.log('❌ Conexión cerrada')
      if (lastDisconnect?.error?.output?.statusCode !== 401) {
        console.log('♻️ Intentando reconectar automáticamente...')
        setTimeout(start, 3000) // reintentar en 3 segundos
      } else {
        console.log('⚠️ Sesión inválida. Escanea el QR nuevamente.')
      }
    }
  })

  // Ejemplo: responder a mensajes
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0]
    if (!msg.message) return
    const from = msg.key.remoteJid
    const text = msg.message.conversation || msg.message?.extendedTextMessage?.text
    if (text?.toLowerCase() === '.hola') {
      await sock.sendMessage(from, { text: '¡Hola! 😄' })
    }
  })
}

// Ejecutar bot
start()

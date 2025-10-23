import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import P from 'pino'
import fs from 'fs'
import qrcode from 'qrcode-terminal' // Necesitas instalar: npm install qrcode-terminal

const AUTH_FILE = './auth.json'

async function conexion() {
  const authPath = './auth_data'
  if (!fs.existsSync(authPath)) fs.mkdirSync(authPath)

  const { state, saveCreds } = await useMultiFileAuthState(authPath)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'silent' }),
  })

  // Guardar credenciales en un solo archivo
  sock.ev.on('creds.update', async () => {
    await saveCreds()
    fs.writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2))
  })

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      // Aquí generamos el QR en la terminal
      qrcode.generate(qr, { small: true })
      console.log('📱 Escanea este QR con WhatsApp Web')
    }

    if (connection === 'connecting') console.log('🔌 Conectando...')
    if (connection === 'open') console.log('✅ Conectado con WhatsApp Web!')
    if (connection === 'close') {
      console.log('❌ Conexión cerrada')
      if (lastDisconnect?.error?.output?.statusCode !== 401) {
        console.log('♻️ Reconecta escaneando QR nuevamente si es necesario')
      }
    }
  })

  return sock
}

async function main() {
  const sock = await conexion()
}

main()

import makeWASocket, {
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'
import P from 'pino'
import fs from 'fs'

async function conexion(number,codigo="WAZAWAZA") {
  const authPath = './auth_data'

  // Crear carpeta si no existe
  if (!fs.existsSync(authPath)) fs.mkdirSync(authPath)

  // Usar sistema multifile de Baileys (cada credencial en un archivo dentro de la carpeta)
  const { state, saveCreds } = await useMultiFileAuthState(authPath)
  const store = makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' }))
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: store },
    printQRInTerminal: false, // para escanear QR si no está vinculado
    logger: P({ level: 'silent' }),
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect } = u
    if (connection === 'connecting') console.log('🔌 Conectando...')
    if (connection === 'open') console.log('✅ Conectado con WhatsApp Web!')
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401
      if (shouldReconnect) {
        console.log('♻️ Reconectando...')
        conexion(number)
      }
    }
  })
  if (!state.creds?.registered) {
    await new Promise(res => setTimeout(res, 2000))
    const code = await sock.requestPairingCode(number)
    console.log('📱 Tu código de emparejamiento es:', code)
  }
  return sock
}

async function start(sock) {
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0]
    const from = msg.key.remoteJid
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text

    if (text?.toLowerCase() === '.hola') {
      await sock.sendMessage(from, { text: '¡Hola! 😄' })
    }
  })
}

const sock = await conexion('51947266830')
start(sock)

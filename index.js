import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import P from 'pino'
import fs from 'fs'

const AUTH_FILE = './auth.json'

async function conexion(number,code) {
  const authPath = './auth_data'
  if (!fs.existsSync(authPath)) fs.mkdirSync(authPath)

  // MultiFile internamente
  const { state, saveCreds } = await useMultiFileAuthState(authPath)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: 'silent' }),
  })

  // Cada vez que se actualizan credenciales, guardarlas en un solo JSON
  sock.ev.on('creds.update', async () => {
    await saveCreds()
    fs.writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2))
  })

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'connecting') console.log('🔌 Conectando...')
    if ((connection === 'open')) console.log('✅ Conectado con WhatsApp Web!')
    if (connection === 'close') {
      console.log('❌ Conexión cerrada')
      if (lastDisconnect?.error?.output?.statusCode !== 401) {
        
        console.log('♻️ Puedes reconectar manualmente ejecutando la función de conexión')

        return conexion(number,code)


      }
    }
  })
  if (!state.creds?.registered) {
    await new Promise(res => setTimeout(res, 2000))
    const _code = await sock.requestPairingCode(number,code)
    console.log('📱 Tu código de emparejamiento es:', _code)
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

// Función principal
async function main() {
  const sock = await conexion("51947266830","WAZAWAZA")
  start(sock)
}

main()

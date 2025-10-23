import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import P from 'pino'

const main = async () => {
  const { state, saveCreds } = await useMultiFileAuthState('./auth')
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: 'silent' })
  })

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0]
    //if (!msg.message || msg.key.fromMe) return

    const from = msg.key.remoteJid
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text

    if (text?.toLowerCase() === '.hola') {
      await sock.sendMessage(from, { text: '¡Hola! 😄' })
    }
  })

  sock.ev.on('creds.update', saveCreds)
}

main()

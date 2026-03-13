const fs = require('fs');
const os = require('os');
const path = require('path');
const { JB } = require('../ryan');

const dynamicImport = new Function('modulePath', 'return import(modulePath)');

const normalizeNumber = (jid = '') => String(jid).split('@')[0].replace(/\D/g, '');

const isOwnerSender = (senderJid = '') => {
  const owners = (process.env.OWNER_NUMBER || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => n.replace(/\D/g, ''));

  return owners.includes(normalizeNumber(senderJid));
};

const buildImageDownloadEnvelope = (mek) => {
  const directImage = mek.message?.imageMessage;
  if (directImage) {
    return { message: { imageMessage: directImage } };
  }

  const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (quoted?.imageMessage) {
    return { message: { imageMessage: quoted.imageMessage } };
  }

  return null;
};

JB({
  pattern: 'dp',
  react: '🖼️',
  desc: 'Set bot profile photo from sent/replied image (owner only)',
  category: 'owner',
  filename: __filename
}, async (sock, mek, m, { from, sender, reply }) => {
  try {
    const senderJid = mek?.key?.participant || mek?.key?.remoteJid || sender || '';
    if (!isOwnerSender(senderJid)) {
      return reply('⫎ `Owner only command.` ❌');
    }

    const imageEnvelope = buildImageDownloadEnvelope(mek);
    if (!imageEnvelope) {
      return reply('⫎ `Send an image with .dp caption or reply to an image with .dp` 🖼️');
    }

    await sock.sendMessage(from, { react: { text: '⏳', key: mek.key } });

    let baileys;
    try {
      baileys = await dynamicImport('@vreden/meta');
    } catch {
      return reply('⚠️ `Failed to load media tools.`');
    }

    const { downloadMediaMessage } = baileys;
    const imageBuffer = await downloadMediaMessage(imageEnvelope, 'buffer', {}, { logger: console });

    if (!imageBuffer || !imageBuffer.length) {
      return reply('⫎ `Unable to read image payload.` ❌');
    }

    const tempPath = path.join(os.tmpdir(), `jb-dp-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);

    try {
      fs.writeFileSync(tempPath, imageBuffer);
      const ownJid = (sock.user?.id || '').split(':')[0] + '@s.whatsapp.net';
      await sock.updateProfilePicture(ownJid, { url: tempPath });
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }

    await reply('✅ `Profile picture updated.`');
    await sock.sendMessage(from, { react: { text: '✅', key: mek.key } });
  } catch (err) {
    console.error('DP ERROR:', err);
    await reply(`⫎ *System Error:* \`${err?.message || 'unknown error'}\``);
    await sock.sendMessage(from, { react: { text: '❌', key: mek.key } });
  }
});

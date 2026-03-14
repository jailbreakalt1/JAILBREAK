const fs = require('fs');
const path = require('path');

// --- CONFIG ---
const ownerNumbers = (process.env.OWNER_NUMBER || '')
    .split(',')
    .map(n => n.trim().replace(/\D/g, ''))
    .filter(Boolean);
const OWNER_NUMBER = ownerNumbers[0] ? `${ownerNumbers[0]}@s.whatsapp.net` : null;
const STORAGE_LIMIT_HOURS = 2;
const TEMP_DIR = path.join(__dirname, '..', 'temp');

const jbContext = {
    forwardingScore: 1,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363424536255731@newsletter',
        newsletterName: 'JAILBREAK HOME',
        serverMessageId: -1
    }
};

const dynamicImport = new Function('modulePath', 'return import(modulePath)');
let downloadContentFromMessage;

const messageStore = new Map();

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const makeStoreKey = (remoteJid = '', msgId = '') => `${remoteJid}:${msgId}`;

// Garbage Collector
setInterval(() => {
    const now = Date.now();
    messageStore.forEach((val, key) => {
        if (now - val.timestamp > (STORAGE_LIMIT_HOURS * 3600000)) {
            if (val.mediaPath && fs.existsSync(val.mediaPath)) fs.unlinkSync(val.mediaPath);
            messageStore.delete(key);
        }
    });
}, 300000);

/**
 * 📥 Main Logic: Store and Reveal
 */
async function storeMessage(mek, conn) {
    try {
        if (!mek?.message || mek.key.fromMe) return;

        const from = mek.key.remoteJid;
        if (!from) return;

        if (!downloadContentFromMessage) {
            const baileys = await dynamicImport('@vreden/meta');
            downloadContentFromMessage = baileys.downloadContentFromMessage;
        }

        const id = mek.key.id;
        const rawType = Object.keys(mek.message)[0];
        let mtype = rawType;
        let mediaMsg = mek.message[rawType];
        let isViewOnce = false;

        // Correct unwrap for Baileys ViewOnce structure
        if (mtype === 'viewOnceMessage' || mtype === 'viewOnceMessageV2') {
            isViewOnce = true;
            const innerType = Object.keys(mediaMsg.message)[0];
            mediaMsg = mediaMsg.message[innerType];
            mtype = innerType;
        }

        const entry = {
            msg: mek,
            timestamp: Date.now(),
            mediaPath: null,
            type: mtype,
            senderJid: mek.key.participant || from,
            chatJid: from
        };

        // Text Content
        if (mtype === 'conversation' || mtype === 'extendedTextMessage') {
            entry.text = mediaMsg.text || mediaMsg;
        }

        // Media Content
        const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'];
        if (mediaTypes.includes(mtype)) {
            try {
                const stream = await downloadContentFromMessage(mediaMsg, mtype.replace('Message', ''));
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                const ext = mtype === 'audioMessage' ? 'ogg' : mtype === 'videoMessage' ? 'mp4' : mtype === 'imageMessage' ? 'jpg' : 'bin';
                const filePath = path.join(TEMP_DIR, `${Date.now()}-${id}.${ext}`);
                fs.writeFileSync(filePath, buffer);
                entry.mediaPath = filePath;

                // ⚡ AUTO REVEAL VIEW ONCE TO FIRST OWNER
                if (isViewOnce && OWNER_NUMBER) {
                    const sender = (entry.senderJid || '').split('@')[0];
                    const revealHeader = `╔════════════════════╗\n   ╼ VIEW ONCE REVEAL ╾   \n╚════════════════════╝\n⎛\n  ⧯ 𝙸𝙽𝚃𝙴𝚁𝙲𝙴𝙿𝚃𝙴𝙳\n  ◈ From: @${sender}\n  ◈ Chat: ${from}\n  ◈ Type: \`${mtype}\` \n⎝\n> ☬ *JAILBREAK SIGHT* ☬`;

                    const options = { quoted: mek, mentions: [entry.senderJid], contextInfo: jbContext };
                    if (mtype === 'imageMessage') await conn.sendMessage(OWNER_NUMBER, { image: buffer, caption: revealHeader }, options);
                    else if (mtype === 'videoMessage') await conn.sendMessage(OWNER_NUMBER, { video: buffer, caption: revealHeader }, options);
                    else if (mtype === 'audioMessage') {
                        await conn.sendMessage(OWNER_NUMBER, { text: revealHeader }, options);
                        await conn.sendMessage(OWNER_NUMBER, { audio: buffer, mimetype: 'audio/mp4', ptt: true }, options);
                    }
                }
            } catch (err) {
                console.error('Media Storage Error:', err.message);
            }
        }

        messageStore.set(makeStoreKey(from, id), entry);
    } catch (e) {
        console.error('Store Error:', e.message);
    }
}

async function handleAntiDelete(conn, mek) {
    try {
        if (!OWNER_NUMBER || !mek.message?.protocolMessage || mek.message.protocolMessage.type !== 0) return;

        const deletedKey = mek.message.protocolMessage.key || {};
        const deletedId = deletedKey.id;
        const deletedRemoteJid = deletedKey.remoteJid || mek.key.remoteJid;
        const data = messageStore.get(makeStoreKey(deletedRemoteJid, deletedId));

        if (data) {
            const sender = (data.senderJid || '').split('@')[0];
            const header = `╔════════════════════╗\n   ╼ RECOVERY ACTIVE ╾   \n╚════════════════════╝\n⎛\n  ⧯ 𝙳𝙴𝙻𝙴𝚃𝙴𝙳 𝙸𝙽𝚃𝙴𝙻\n  ◈ Sender: @${sender}\n  ◈ Chat: ${data.chatJid}\n  ◈ Type: \`${data.type}\`\n⎝\n> ☬ *JAILBREAK ANTI-DELETE* ☬`;
            const options = { quoted: mek, mentions: [data.senderJid], contextInfo: jbContext };

            if (data.mediaPath && fs.existsSync(data.mediaPath)) {
                const media = fs.readFileSync(data.mediaPath);
                if (data.type === 'imageMessage') await conn.sendMessage(OWNER_NUMBER, { image: media, caption: header }, options);
                else if (data.type === 'videoMessage') await conn.sendMessage(OWNER_NUMBER, { video: media, caption: header }, options);
                else if (data.type === 'audioMessage') await conn.sendMessage(OWNER_NUMBER, { audio: media, mimetype: 'audio/mp4', ptt: true }, options);
                else if (data.type === 'documentMessage') await conn.sendMessage(OWNER_NUMBER, { document: media, fileName: 'deleted-file', mimetype: 'application/octet-stream', caption: header }, options);
                else await conn.sendMessage(OWNER_NUMBER, { text: `${header}\n\n⚠️ Unsupported stored media type.` }, options);
            } else if (data.text) {
                const textVal = typeof data.text === 'string' ? data.text : (data.text.text || '');
                await conn.sendMessage(OWNER_NUMBER, { text: `${header}\n\n📝 *Content:* \`${textVal}\`` }, options);
            }
        }
    } catch (e) {
        console.error('Anti-Delete Error:', e.message);
    }
}

module.exports = { storeMessage, handleAntiDelete };

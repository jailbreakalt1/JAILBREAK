const acrcloud = require("acrcloud");
const yts = require("yt-search");
const { JB } = require('../ryan');
const chalk = require('chalk');

// --- NEWSLETTER & FORWARD METADATA ---
const jbContext = {
    forwardingScore: 1,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363424536255731@newsletter',
        newsletterName: 'JAILBREAK HOME',
        serverMessageId: -1
    }
};

const SONG_REQUEST_CHANNEL_LINK = "https://whatsapp.com/channel/0029VagJIAr3bbVzV70jSU1p";

// ─── DYNAMIC IMPORT ───
const dynamicImport = new Function('modulePath', 'return import(modulePath)');

// ─── ACRCLOUD CONFIG ───
const acr = new acrcloud({
    host: 'identify-us-west-2.acrcloud.com',
    access_key: '4ee38e62e85515a47158aeb3d26fb741',
    access_secret: 'KZd3cUQoOYSmZQn1n5ACW5XSbqGlKLhg6G8S8EvJ'
});

const MAX_BUFFER_SIZE = 8 * 1024 * 1024; // 8MB

// ─── TRIGGERS ───
const HOT_WORDS = ['shazam', 'find', 'id'];

function hasTrigger(text = '') {
    const t = text.toLowerCase();
    return HOT_WORDS.some(w => t.includes(w));
}

// ─── IDENTIFY SONG ───
async function identifySong(buffer) {
    if (buffer.length > MAX_BUFFER_SIZE) {
        buffer = buffer.slice(0, MAX_BUFFER_SIZE);
    }
    const result = await acr.identify(buffer);
    if (result.status.code !== 0 || !result.metadata?.music?.length) return null;
    return result.metadata.music[0];
}

// ─── JB COMMAND ───
JB({
    pattern: 'find',
    alias: ['shazam', 'id'],
    react: '🎵',
    desc: 'Identify a song from audio or video',
    category: 'group',
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {

    try {
        const text =
            mek.message?.conversation ||
            mek.message?.extendedTextMessage?.text ||
            mek.message?.videoMessage?.caption ||
            mek.message?.imageMessage?.caption ||
            '';

        // ─── DYNAMIC BAILEYS IMPORT ───
        let baileys;
        try {
            baileys = await dynamicImport('@vreden/meta');
        } catch {
            return reply('⚠️ Internal error loading media tools.');
        }

        const { downloadMediaMessage } = baileys;

        // ─── MEDIA DETECTION ───
        let mediaMessage = null;
        let isQuoted = false;

        if (mek.message?.videoMessage) {
            mediaMessage = mek.message.videoMessage;
        } else if (mek.message?.audioMessage) {
            mediaMessage = mek.message.audioMessage;
        } else if (mek.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const q = mek.message.extendedTextMessage.contextInfo.quotedMessage;
            if (q.videoMessage) mediaMessage = q.videoMessage;
            else if (q.audioMessage) mediaMessage = q.audioMessage;
            isQuoted = true;
        }

        if (!mediaMessage) {
            return reply('🎵 *Send/Reply to audio/video with "Shazam" or "Find" to identify it.*');
        }

        await conn.sendMessage(from, { react: { text: '🔎', key: mek.key } });

        // ─── DOWNLOAD MEDIA ───
        const buffer = await downloadMediaMessage(
            { message: { [mediaMessage.mimetype?.startsWith('video') ? 'videoMessage' : 'audioMessage']: mediaMessage } },
            'buffer',
            {},
            { logger: console }
        );

        // ─── IDENTIFY ───
        const song = await identifySong(buffer);
        if (!song) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply('⫎ *Failed to identify.* Try a clearer audio segment.');
        }

        // ─── METADATA ───
        const title = song.title || 'Unknown';
        const artists = song.artists?.map(a => a.name).join(', ') || 'Unknown';
        const album = song.album?.name || 'Single';
        const genres = song.genres?.map(g => g.name).join(', ') || 'General';

        // ─── YOUTUBE SEARCH ───
        const yt = await yts(`${title} ${artists}`);
        const ytLink = yt?.videos?.[0]?.url || 'Not available';
        const thumbnail = yt?.videos?.[0]?.thumbnail || "https://files.catbox.moe/s80m7e.png";

        // ─── RESPONSE ───
        const header = `╔════════════════════╗\n   ╼ 𝚂𝙾𝙽𝙶 𝙸𝙳𝙴𝙽𝚃𝙸𝙵𝙸𝙴𝙳 ╾   \n╚════════════════════╝\n`;
        const body = 
`⎛
  ◈ 𝚂𝙾𝙽𝙶 : \`${title}\`
  ◈ 𝙰𝚁𝚃𝙸𝚂𝚃 : \`${artists}\`
  ◈ 𝙰𝙻𝙱𝚄𝙼 : \`${album}\`
  ◈ 𝙶𝙴𝙽𝚁𝙴 : \`${genres}\`
⎝

⧯ *YouTube Link:* ${ytLink}

> ☬ *JAILBREAK HUB* ☬`;

        await conn.sendMessage(from, {
            text: header + body,
            contextInfo: {
                ...jbContext,
                externalAdReply: {
                    title: `INTERCEPTED: ${title.toUpperCase()}`,
                    body: `Artist: ${artists}`,
                    mediaType: 1,
                    thumbnailUrl: thumbnail,
                    sourceUrl: SONG_REQUEST_CHANNEL_LINK
                }
            }
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (err) {
        console.error(chalk.red('[SHAZAM ERROR]'), err);
        reply('⚠️ *System Error during identification.*');
    }
});

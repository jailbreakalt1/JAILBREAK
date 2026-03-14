// FILE: plugins/status.js
// Optimized Status Handler for JAILBREAK AI
// Handles auto-view, auto-react, and forwarding to OWNER DM with System Branding.

const moment = require('moment-timezone');

// Load owners once on startup
const ownerNumbers = (process.env.OWNER_NUMBER || '')
    .split(',')
    .map(num => num.trim().replace(/\D/g, ''));

/**
 * Sanitizes JID to a clean number
 */
function sanitizeNumberDigits(x = '') {
    return String(x).replace(/\D/g, '');
}

/**
 * Handles the logic for processing and forwarding a WhatsApp Status/Story message.
 */
async function handleStatusUpdate(conn, mek, forwardJid, disableReadReceipts = false, utils) {
    const { downloadMediaMessage, getContentType } = utils || {};
    
    // Safety Check: We need these to process status correctly
    if (!getContentType) {
        console.error('❌ [STATUS] Exiting: getContentType utility missing.');
        return;
    }

    const posterJid = mek.key.participant || mek.participant;
    if (!posterJid || posterJid === 'status@broadcast') return;

    const posterNumber = sanitizeNumberDigits(posterJid.split('@')[0] || '');

    // 1. Filter: Ignore Bot's own statuses
    if (posterJid === conn.user.id.split(':')[0] + '@s.whatsapp.net' || posterJid === conn.user.id) return;

    // ==========================================================
    // 2. AUTO-VIEW AND AUTO-REACT
    // ==========================================================
    const randomEmojis = ['👍', '👀', '🔥', '🤐', '😮', '🍿', '💯', '😂', '👏', '🥂', '🤔', '🫡', '⚡', '🛸'];
    const randomEmoji = randomEmojis[Math.floor(Math.random() * randomEmojis.length)];

    try {
        // Auto-view (Mark as read)
        if (!disableReadReceipts) {
            await conn.readMessages([mek.key]);
        }
        // Auto-react to the status broadcast
        await conn.sendMessage('status@broadcast', { 
            react: { text: randomEmoji, key: mek.key } 
        }, { statusJidList: [posterJid] });

        console.log(`🟢 [STATUS] Viewed & Reacted (${randomEmoji}) to ${posterNumber}`);
    } catch (e) {
        console.error('⚠️ [STATUS] React failed:', e.message);
    }

    // ==========================================================
    // 3. PREPARE MESSAGE DATA & BRANDING
    // ==========================================================
    const mtype = getContentType(mek.message);
    const body = (mtype === 'conversation' ? mek.message.conversation : 
                  mek.message[mtype]?.caption || mek.message[mtype]?.text || '')?.trim();

    let displayName = mek.pushName || posterNumber;

    let profilePicUrl;
    try {
        profilePicUrl = await conn.profilePictureUrl(posterJid, 'image');
    } catch {
        profilePicUrl = 'https://placehold.co/150x150/1e293b/ffffff?text=JB';
    }

    const postedTime = moment(mek.messageTimestamp * 1000).tz('Africa/Harare').format('HH:mm • DD/MM/YY');
    
    // Jailbreak Branding Logic
    const jbContext = {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363424536255731@newsletter',
            newsletterName: 'JAILBREAK HOME',
            serverMessageId: -1
        },
        externalAdReply: {
            title: `STATUS: ${displayName.toUpperCase()}`,
            body: `Captured by Jailbreak System [${randomEmoji}]`,
            thumbnailUrl: profilePicUrl,
            mediaType: 1,
            renderLargerThumbnail: true,
            sourceUrl: 'https://whatsapp.com/channel/0029VagJIAr3bbVzV70jSU1p' 
        }
    };

    const captionHeader = 
        `⚡ *JAILBREAK STATUS INTERCEPT*\n\n` +
        `👤 *Poster:* ${displayName}\n` +
        `📱 *Number:* ${posterNumber}\n` +
        `🕒 *Captured:* ${postedTime}\n` +
        `🎭 *Reaction:* ${randomEmoji}`;

    let fullCaption = captionHeader;
    if (body) fullCaption += `\n\n📝 *Caption:*\n${body}`;

    let messageToSend = {
        text: fullCaption,
        ai: true,
        contextInfo: jbContext
    };

    // ==========================================================
    // 4. MEDIA HANDLING
    // ==========================================================
    if (['imageMessage', 'videoMessage', 'audioMessage'].includes(mtype) && downloadMediaMessage) {
        try {
            const buffer = await downloadMediaMessage(mek, 'buffer', {});
            if (buffer) {
                if (mtype === 'imageMessage') {
                    messageToSend = { image: buffer, caption: fullCaption, ai: true, contextInfo: jbContext };
                } else if (mtype === 'videoMessage') {
                    messageToSend = { video: buffer, caption: fullCaption, mimetype: 'video/mp4', ai: true, contextInfo: jbContext };
                } else if (mtype === 'audioMessage') {
                    messageToSend = { audio: buffer, mimetype: 'audio/mp4', ptt: true, ai: true, contextInfo: jbContext };
                }
            }
        } catch (error) {
            console.error('❌ [STATUS] Media download failed:', error.message);
            messageToSend.text += `\n\n⚠️ *Media Intercept Failed*`;
        }
    }

    // ==========================================================
    // 5. SEND TO OWNER
    // ==========================================================
    const targetJid = (ownerNumbers.length > 0 && ownerNumbers[0])
        ? ownerNumbers[0] + '@s.whatsapp.net'
        : conn.user.id.split(':')[0] + '@s.whatsapp.net';

    try {
        await conn.sendMessage(targetJid, messageToSend);
        console.log(`✅ [STATUS] Intercept Logged to Owner: ${posterNumber}`);
    } catch (err) {
        console.error(`❌ [STATUS] Intercept Log failed:`, err.message);
    }
}

module.exports = { handleStatusUpdate };

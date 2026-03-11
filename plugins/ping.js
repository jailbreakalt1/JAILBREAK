/**
 * A comprehensive ping command to check bot latency, uptime, and resource usage.
 * Optimized for Pterodactyl VPS / Node.js
 * Enhanced with AI Label, Newsletter Metadata, and Buffer-based Image sending.
 */

const { JB } = require("../ryan");
const os = require('os');
const axios = require('axios');
const moment = require('moment-timezone');

// Asset URL
const PING_IMAGE_URL = "https://files.catbox.moe/s80m7e.png";
const newsletterJid = '120363424536255731@newsletter';

/**
 * Helper to format uptime
 */
function formatUptime(uptime) {
    const seconds = Math.floor(uptime % 60);
    const minutes = Math.floor((uptime / 60) % 60);
    const hours = Math.floor((uptime / (60 * 60)) % 24);
    const days = Math.floor(uptime / (60 * 60 * 24));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.join(' ') || '0s';
}

// 🏓 PING Command
JB({
    pattern: "jb",
    alias: ["ping", "jailbreak"],
    desc: "Checks the bot's latency, uptime, resource usage and network.",
    category: "general",
    react: "⚡",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        // 1. Full Metadata Context
        const jbContext = {
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: newsletterJid,
                newsletterName: 'JAILBREAK HOME',
                serverMessageId: -1
            },
            externalAdReply: {
                title: "JAILBREAK SYSTEM: PING",
                body: "Checking Core Latency...",
                mediaType: 1,
                thumbnailUrl: PING_IMAGE_URL,
                sourceUrl: 'https://whatsapp.com/channel/0029VagJIAr3bbVzV70jSU1p'
            }
        };

        // 2. Initial Latency Check
        const timestamp_start = Date.now();
        
        // 3. Stats Calculation
        const now = moment().tz("Africa/Harare");
        const botLatency = Date.now() - timestamp_start;
        const botUptime = formatUptime(process.uptime());
        const totalMemory = os.totalmem();
        const usedMemory = totalMemory - os.freemem();

        // 4. Stylized ASCII Response
        const responseText = 
            `*╔═══════════════════╗*\n` +
            `*║   ₊˚⊹ ᰔ⋆ JAIL BREAK.ai ₊˚ෆ     ║*\n\n` +
            `┌───────────────────┐\n` +
            `  𝚅𝙸𝚃𝙰𝙻 𝚂𝙸𝙶𝙽𝚂\n` +
            `  ☬ 𝔭𝔦𝔫𝔤   :: \`${botLatency}ms\`\n` +
            `  ☬ úṕtíḿé :: \`${botUptime}\`\n` +
            `  ☬ ̠s̠̠t̠a̠̠t̠̠u̠̠s̠ :: \`Online\`\n` +
            `├───────────────────┤\n` +
            `  𝚃𝙸𝙼𝙸𝙽𝙶 𝙳𝙰𝚃𝙰\n` +
            `  ⧯ 𝒹𝒶𝓉𝑒 :: \`${now.format("DD MMM YYYY")}\`\n` +
            `  ⧯ tเ๓є :: \`${now.format("HH:mm:ss")}\`\n` +
            `  ⧯ ̷z̷̷o̷̷n̷̷e̷: :: \`KWEKWE (CAT)\`\n` +
            `├───────────────────┤\n` +
            `  ʀᴇꜱᴏᴜʀᴄᴇꜱ\n` +
            `  ⨇ 尺卂爪 :: \`${(usedMemory / 1024 / 1024).toFixed(2)}MB / ${(totalMemory / 1024 / 1024).toFixed(0)}MB\`\n` +
            `  ⨇ ʰᵒˢᵗ :: \`${os.hostname()}\`\n` +
            `  ⨇ ͓̽C͓͓̽̽P͓͓̽̽U͓̽ :: \`x${os.cpus().length} Cores\`\n` +
            `╰────────────────────\n\n` +
            `> ₛYₛₜₑₘ ₒₚₚₑᵣₐₜᵢₒₙₐₗ\n` +
            `╚═══════════════════╝`;

        // 5. Send Image as Buffer
        const response = await axios.get(PING_IMAGE_URL, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data, 'utf-8');

        await conn.sendMessage(from, {
            image: imageBuffer,
            caption: responseText,
            ai: true,
            contextInfo: jbContext
        }, { quoted: mek });

    } catch (e) {
        console.error("Ping Error:", e);
        await conn.sendMessage(from, { text: `❌ Ping Error: ${e.message}` }, { quoted: mek });
    }
});

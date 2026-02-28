const { JB } = require('../ryan');

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

JB({
    pattern: "lyrics",
    alias: ["lyric"],
    desc: "Finds and returns lyrics for a given song with album art.",
    category: "group",
    react: "🎶",
    filename: __filename
}, async (conn, mek, m, { q, reply }) => {
    // 1. Check for query
    if (!q) {
        return reply(`*🔍 QUERY REQUIRED*\n\nExample: \`.lyrics starboy\``);
    }

    // Dynamic import for fetch to handle ES modules
    let fetch;
    try {
        const fetchModule = await import('node-fetch');
        fetch = fetchModule.default || fetchModule;
    } catch (e) {
        return reply("❌ System Error: node-fetch not installed.");
    }

    try {
        const songTitle = q.trim();
        const apiUrl = `https://lyricsapi.fly.dev/api/lyrics?q=${encodeURIComponent(songTitle)}`;

        // Send processing reaction
        await conn.sendMessage(mek.key.remoteJid, { react: { text: '⏳', key: mek.key } });

        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error('API unreachable');

        const data = await res.json();

        // 2. Validate Result
        if (!data || !data.result || !data.result.lyrics) {
            await conn.sendMessage(mek.key.remoteJid, { react: { text: "❌", key: mek.key } });
            return reply(`*NOT FOUND*\n\nCould not locate lyrics for: \`${songTitle}\``);
        }

        const { title, artist, image, lyrics } = data.result;

        // 3. Format Premium Message
        const header = `╔════════════════════╗\n   ╼ 𝙻𝚈𝚁𝙸𝙲𝚂 𝙵𝙾𝚄𝙽𝙳 ╾   \n╚════════════════════╝\n`;
        const body = `⎛\n  ◈ 𝚂𝙾𝙽𝙶 : \`${title || songTitle}\`\n  ◈ 𝙰𝚁𝚃𝙸𝚂𝚃 : \`${artist || "Unknown"}\` \n⎝\n\n${lyrics}\n\n> ☬ *JAILBREAK HUB* ☬`;

        const messageOptions = {
            contextInfo: {
                ...jbContext,
                externalAdReply: {
                    title: `Now Playing: ${title}`,
                    body: artist,
                    mediaType: 1,
                    thumbnailUrl: image || "https://files.catbox.moe/s80m7e.png",
                    sourceUrl: "https://whatsapp.com/channel/0029VagJIAr3bbVzV70jSU1p"
                }
            },
            quoted: mek
        };

        // 4. Send Content
        if (image) {
            await conn.sendMessage(mek.key.remoteJid, { 
                image: { url: image }, 
                caption: header + body 
            }, messageOptions);
        } else {
            await conn.sendMessage(mek.key.remoteJid, { 
                text: header + body 
            }, messageOptions);
        }

        await conn.sendMessage(mek.key.remoteJid, { react: { text: "✅", key: mek.key } });

    } catch (error) {
        console.error('Lyrics Error:', error);
        await conn.sendMessage(mek.key.remoteJid, { react: { text: "❌", key: mek.key } });
        return reply(`*ERROR*: Internal API failure.`);
    }
});
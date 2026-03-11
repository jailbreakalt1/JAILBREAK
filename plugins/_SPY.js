const { JB } = require('../ryan');
const axios = require('axios');
const moment = require('moment');

// Global Metadata to be used in all sends
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
    pattern: "spy",
    alias: ["whois", "userinfo"],
    react: "🕵️",
    desc: "Get information about a WhatsApp user",
    category: "public",
    use: ".spy @user | .spy 2637xxxxxx | reply to a message",
    filename: __filename
}, async (conn, mek, m, { from, reply, args }) => {
    try {
        let targetJid;

        /* ───── TARGET RESOLUTION ───── */
        const rawArg = args.join('').replace(/\D/g, '');
        if (rawArg.length >= 6) {
            targetJid = rawArg + '@s.whatsapp.net';
        } else if (m.mentionedJid?.length) {
            targetJid = m.mentionedJid[0];
        } else if (m.quoted?.sender) {
            targetJid = m.quoted.sender;
        } else {
            targetJid = from.endsWith('@g.us') ? mek.key.participant : from;
        }

        if (!targetJid) return reply("⧯ \`Error: Tag, reply, or provide a valid number.\` ❌");

        await reply("⎆ \`Decrypting User Intel...\` ⏳");

        /* ───── PROFILE PICTURE ───── */
        let profilePic;
        try {
            profilePic = await conn.profilePictureUrl(targetJid, 'image');
        } catch {
            profilePic = 'https://files.catbox.moe/s80m7e.png'; // Fallback to system asset
        }

        /* ───── ABOUT / BIO ───── */
        let about = "No bio found";
        try {
            const res = await conn.fetchStatus(targetJid);
            about = res?.status || about;
        } catch {}

        /* ───── PHONE VALIDATION ───── */
        const ABSTRACT_API_KEY = "028b996094b545c8beb77eee1cf632bd";
        const phoneNumber = targetJid.split('@')[0];

        let validation = "⫎ \`Signal Interrupted\`";
        try {
            const { data } = await axios.get(
                `https://phonevalidation.abstractapi.com/v1/?api_key=${ABSTRACT_API_KEY}&phone=${phoneNumber}`
            );

            validation = 
                `  ⨇ Valid: \`${data.valid}\`\n` +
                `  ⨇ Country: \`${data.country?.name || 'Unknown'}\`\n` +
                `  ⨇ Carrier: \`${data.carrier || 'Unknown'}\`\n` +
                `  ⨇ Location: \`${data.location || 'Unknown'}\`\n` +
                `  ⨇ Type: \`${data.type || 'Unknown'}\``;
        } catch {
            validation = `  ⫎ \`Abstract API Limit Reached\``;
        }

        /* ───── FORMATTED OUTPUT ───── */
        const responseText = 
`╔════════════════════╗
      ╼ USER INTEL ╾      
╚════════════════════╝
⎛
  ⧯ 𝙸𝙳𝙴𝙽𝚃𝙸𝚃𝚈 𝙳𝙰𝚃𝙰
  ◈ JID: \`${targetJid}\`
  ◈ Bio: \`${about}\`
  ◈ Status: \`Online/Visible\`

  ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
  ֎ 𝙿𝙷𝙾𝙽𝙴 𝚅𝙰𝙻𝙸𝙳𝙰𝚃𝙸𝙾𝙽
${validation}
⎝
> ☬ *JAILBREAK SPY SYSTEM* ☬`;

        await conn.sendMessage(from, {
            image: { url: profilePic },
            caption: responseText,
            contextInfo: {
                ...jbContext, // Attached Newsletter Metadata
                externalAdReply: {
                    title: "INTEL DECODED: " + phoneNumber,
                    body: "Jailbreak OS Security Module",
                    mediaType: 1,
                    thumbnailUrl: "https://files.catbox.moe/s80m7e.png",
                    sourceUrl: 'https://whatsapp.com/channel/0029VagJIAr3bbVzV70jSU1p'
                }
            }
        }, { quoted: mek });

    } catch (err) {
        console.error("❌ Spy command error:", err);
        reply("⧯ \`Critical Error: Intel gathering failed.\` ❌");
    }
});

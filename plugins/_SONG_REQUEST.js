const { JB } = require("../ryan");
const yts = require("yt-search");
const axios = require("axios");

// Pulling backend URL from .env with a fallback to the internal IP
const BACKEND_URL = process.env.BACKEND_URL || "http://172.18.0.179:5000"; 
const SONG_REQUEST_CHANNEL_LINK = "https://whatsapp.com/channel/0029VagJIAr3bbVzV70jSU1p";

const jbContext = {
    forwardingScore: 1,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363424536255731@newsletter',
        newsletterName: 'JAILBREAK HOME',
        serverMessageId: -1
    }
};

/**
 * .song / .play command
 */
JB({
    pattern: "song",
    alias: ["play", "audio"],
    react: "🎧",
    desc: "Download audio from YouTube as a document",
    category: "group",
    filename: __filename,
  },
  async (sock, mek, m, { from, args, reply }) => {
    try {
      const q = args.join(" ");
      if (!q) return reply("⧯ `I CAN DO A LOT OF THINGS, BUT CAN'T GUESS SONGS` \n\n `> Provide a song name or YouTube link.` 🎵");

      await sock.sendMessage(from, { react: { text: "⏳", key: mek.key } });

      let url;
      let ytsInfo = null;

      if (q.includes("youtube.com/") || q.includes("youtu.be/")) {
        url = q;
        // Try to fetch search info anyway for the rich caption
        const search = await yts(q);
        if (search.videos.length) ytsInfo = search.videos[0];
      } else {
        const search = await yts(q);
        if (!search.videos.length) return reply("⫎ `Error: No results found in the database.` ❌");
        ytsInfo = search.videos[0];
        url = ytsInfo.url;
      }

      // 1. Get Metadata
      const infoRes = await axios.post(`${BACKEND_URL}/video_info`, { url }, { timeout: 20000 });
      const info = infoRes.data;

      // Extract rich data for caption
      const author = ytsInfo ? ytsInfo.author.name : "Unknown Artist";
      const ago = ytsInfo ? ytsInfo.ago : "Recently";
      const sender = mek.key.participant || from;
      const pushName = mek.pushName || "User";

      // 2. Download Audio (Backend auto-converts to MP3)
      const downloadRes = await axios({
        method: 'post',
        url: `${BACKEND_URL}/download/audio`,
        data: { url },
        responseType: 'arraybuffer',
        timeout: 300000 // 5 minutes
      });

      // 3. Format the Caption
      const docCaption = 
`⧯ *𝙹𝙰𝙸𝙻𝙱𝚁𝙴𝙰𝙺_𝙰𝙸* 𝙱𝚁𝙸𝙽𝙶𝚂 𝚈𝙾𝚄
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
◈ *𝚃𝙸𝚃𝙻𝙴 :* \`${info.title}\`
◈ *𝙰𝚁𝚃𝙸𝚂𝚃 :* \`${author}\`
◈ *𝚁𝙴𝙻𝙴𝙰𝚂𝙴𝙳 :* \`${ago}\`
◈ *𝙳𝚄𝚁𝙰𝚃𝙸𝙾𝙽 :* \`${info.timestamp}\`
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
⎆ @${pushName} _ENJOY_ 🎧
  follow our channel
> ☬ *𝚂𝙾𝚄𝚁𝙲𝙴 :* 𝙹𝙰𝙸𝙻𝙱𝚁𝙴𝙰𝙺 𝙷𝚄𝙱 ☬`;

      // 4. Send as Document
      await sock.sendMessage(from, {
          document: Buffer.from(downloadRes.data),
          mimetype: 'audio/mpeg',
          fileName: `${info.title}.mp3`,
          caption: docCaption,
          mentions: [sender], // Mentions the user in the caption
          contextInfo: {
            ...jbContext,
            externalAdReply: {
              title: info.title,
              body: `Duration: ${info.timestamp} | JAILBREAK AUDIO`,
              thumbnailUrl: info.thumbnail || "https://files.catbox.moe/s80m7e.png",
              renderLargerThumbnail: true,
              mediaType: 1,
              sourceUrl: url
            }
          }
      }, { quoted: mek });

      await sock.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
      console.error("SONG ERROR:", e);
      const errMsg = e.response?.data?.error || e.message;
      reply(`⫎ *System Error:* \`${errMsg}\`\n\n> ◈ URL: ${BACKEND_URL}`);
      await sock.sendMessage(from, { react: { text: "❌", key: mek.key } });
    }
  }
);

/**
 * .video command
 */
JB({
    pattern: "video",
    alias: ["v", "mp4"],
    react: "🎬",
    desc: "Download video from YouTube",
    category: "group",
    filename: __filename,
  },
  async (sock, mek, m, { from, args, reply }) => {
    try {
      const q = args.join(" ");
      if (!q) return reply("⧯ `I CAN DO A LOT OF THINGS, BUT CAN'T GUESS SONGS` \n\n `> Provide a song name or YouTube link.` 🎵");

      await sock.sendMessage(from, { react: { text: "⏳", key: mek.key } });

      let url;
      let ytsInfo = null;

      if (q.includes("youtube.com/") || q.includes("youtu.be/")) {
        url = q;
        const search = await yts(q);
        if (search.videos.length) ytsInfo = search.videos[0];
      } else {
        const search = await yts(q);
        if (!search.videos.length) return reply("⫎ `Error: No results found in the database.` ❌");
        ytsInfo = search.videos[0];
        url = ytsInfo.url;
      }

      const infoRes = await axios.post(`${BACKEND_URL}/video_info`, { url }, { timeout: 20000 });
      const info = infoRes.data;

      const author = ytsInfo ? ytsInfo.author.name : "Unknown Channel";
      const ago = ytsInfo ? ytsInfo.ago : "Recently";
      const sender = mek.key.participant || from;
      const pushName = mek.pushName || "User";

      const downloadRes = await axios({
        method: 'post',
        url: `${BACKEND_URL}/download/video`,
        data: { url },
        responseType: 'arraybuffer',
        timeout: 600000 // 10 minutes
      });

      const vidCaption = 
`⧯ *𝙹𝙰𝙸𝙻𝙱𝚁𝙴𝙰𝙺_𝙰𝙸* 𝚅𝙸𝚂𝚄𝙰𝙻𝚂
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
◈ *𝚃𝙸𝚃𝙻𝙴 :* \`${info.title}\`
◈ *𝙲𝙷𝙰𝙽𝙽𝙴𝙻 :* \`${author}\`
◈ *𝚄𝙿𝙻𝙾𝙰𝙳𝙴𝙳 :* \`${ago}\`
◈ *𝙳𝚄𝚁𝙰𝚃𝙸𝙾𝙽 :* \`${info.timestamp}\`
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
⎆ @${pushName} _ENJOY_ 🎬
   follow our channel
> ☬ *𝚂𝙾𝚄𝚁𝙲𝙴 :* 𝙹𝙰𝙸𝙻𝙱𝚁𝙴𝙰𝙺 𝙷𝚄𝙱 ☬`;

      await sock.sendMessage(from, {
          video: Buffer.from(downloadRes.data),
          mimetype: "video/mp4",
          caption: vidCaption,
          mentions: [sender],
          contextInfo: {
            ...jbContext,
            externalAdReply: {
              title: info.title,
              body: "JAILBREAK VIDEO SOURCE",
              thumbnailUrl: info.thumbnail || "https://files.catbox.moe/s80m7e.png",
              mediaType: 1,
              sourceUrl: url
            }
          }
      }, { quoted: mek });

      await sock.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
      console.error("VIDEO ERROR:", e);
      const errMsg = e.response?.data?.error || e.message;
      reply(`⫎ *System Error:* \`${errMsg}\``);
      await sock.sendMessage(from, { react: { text: "❌", key: mek.key } });
    }
  }
);

/*
image scraper
*/
JB({
    pattern: "img",
    alias: ["image", "gimg"],
    react: "🖼️",
    desc: "Search and download images from Google",
    category: "group",
    filename: __filename,
  },
  async (sock, mek, m, { from, args, reply }) => {
    try {
      const q = args.join(" ");
      if (!q) return reply("⧯ `What image should I search for?` 🖼️");

      await sock.sendMessage(from, { react: { text: "⏳", key: mek.key } });
      await reply("⎆ `Querying Visual Database...` 🌐");

      const response = await axios.post(`${BACKEND_URL}/img_search`, { query: q }, { timeout: 20000 });
      const images = response.data.images;

      if (!images || images.length === 0) {
        return reply("⫎ `Error: No valid results found.` ❌");
      }

      const count = Math.min(images.length, 5);
      
      for (let i = 0; i < count; i++) {
        await sock.sendMessage(from, { 
            image: { url: images[i] }, 
            caption: `⧯ *𝙹𝙰𝙸𝙻𝙱𝚁𝙴𝙰𝙺 𝙸𝙼𝙰𝙶𝙴 𝚂𝙴𝙰𝚁𝙲𝙷*\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n◈ *𝚀𝚄𝙴𝚁𝚈 :* \`${q}\`\n◈ *𝚁𝙴𝚂𝚄𝙻𝚃 :* \`${i + 1} of ${count}\`\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n> ☬ *𝚂𝚈𝚂𝚃𝙴𝙼 𝙰𝙲𝚃𝙸𝚅𝙴* ☬`
        }, { quoted: mek });
      }

      await sock.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
      console.error("IMG ERROR:", e);
      const errMsg = e.response?.data?.error || e.message;
      reply(`⫎ *Error:* \`${errMsg}\`\n\n> ◈ URL: ${BACKEND_URL}`);
      await sock.sendMessage(from, { react: { text: "❌", key: mek.key } });
    }
  }
);

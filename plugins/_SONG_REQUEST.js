const { JB } = require("../ryan");
const yts = require("yt-search");
const axios = require("axios");

// Updated to your new Render URL
const BACKEND_URL = "http://172.18.0.179:5000"; 
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
    alias: ["play"],
    react: "🎵",
    desc: "Download audio from YouTube",
    category: "group",
    filename: __filename,
  },
  async (sock, mek, m, { from, args, reply }) => {
    try {
      const q = args.join(" ");
      if (!q) return reply("⧯ `Provide a song name or YouTube link.` 🎵");

      let url;
      if (q.includes("youtube.com/") || q.includes("youtu.be/")) {
        url = q;
      } else {
        const search = await yts(q);
        if (!search.videos.length) return reply("⫎ `Error: No results found.` ❌");
        url = search.videos[0].url;
      }

      await reply("⎆ `Fetching Audio...` ⏳");

      // 1. Get Metadata
      const infoRes = await axios.post(`${BACKEND_URL}/video_info`, { url }, { timeout: 20000 });
      const info = infoRes.data;

      // 2. Download Audio (Backend auto-converts to MP3)
      const downloadRes = await axios({
        method: 'post',
        url: `${BACKEND_URL}/download/audio`,
        data: { url },
        responseType: 'arraybuffer',
        timeout: 300000 // 5 minutes
      });

      // 3. Send to WhatsApp
      await sock.sendMessage(from, {
          audio: Buffer.from(downloadRes.data),
          mimetype: 'audio/mpeg',
          fileName: `${info.title}.mp3`,
          ptt: false,
          contextInfo: {
            ...jbContext,
            externalAdReply: {
              title: info.title,
              body: `Duration: ${info.timestamp} | JAILBREAK`,
              thumbnailUrl: info.thumbnail,
              renderLargerThumbnail: true,
              mediaType: 1,
              sourceUrl: url
            }
          }
      }, { quoted: mek });

    } catch (e) {
      console.error("SONG ERROR:", e);
      const errMsg = e.response?.data?.error || e.message;
      reply(`⧯ *System Error:* \`${errMsg}\`\n\n> URL: ${BACKEND_URL}`);
    }
  }
);

/**
 * .video command
 */
JB({
    pattern: "video",
    react: "🎬",
    desc: "Download video from YouTube",
    category: "group",
    filename: __filename,
  },
  async (sock, mek, m, { from, args, reply }) => {
    try {
      const q = args.join(" ");
      if (!q) return reply("⧯ `Provide a video name or link.` 🎬");

      let url;
      if (q.includes("youtube.com/") || q.includes("youtu.be/")) {
        url = q;
      } else {
        const search = await yts(q);
        if (!search.videos.length) return reply("⫎ `Error: No results found.` ❌");
        url = search.videos[0].url;
      }

      await reply("⎆ `Fetching Video...` ⏳");

      const infoRes = await axios.post(`${BACKEND_URL}/video_info`, { url }, { timeout: 20000 });
      const info = infoRes.data;

      const downloadRes = await axios({
        method: 'post',
        url: `${BACKEND_URL}/download/video`,
        data: { url },
        responseType: 'arraybuffer',
        timeout: 600000 // 10 minutes
      });

      await sock.sendMessage(from, {
          video: Buffer.from(downloadRes.data),
          mimetype: "video/mp4",
          caption: `⨇ *Title:* \`${info.title}\`\n⨇ *Time:* \`${info.timestamp}\`\n\n> ☬ JAILBREAK VIDEO ☬`,
          contextInfo: {
            ...jbContext,
            externalAdReply: {
              title: info.title,
              body: "JAILBREAK VIDEO SOURCE",
              thumbnailUrl: info.thumbnail,
              mediaType: 1,
              sourceUrl: url
            }
          }
      }, { quoted: mek });

    } catch (e) {
      console.error("VIDEO ERROR:", e);
      const errMsg = e.response?.data?.error || e.message;
      reply(`⧯ *System Error:* \`${errMsg}\``);
    }
  }
);

/*
image scraper
*/

JB(
  {
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

      await reply("⎆ `Searching Google Database...` ⏳");

      // Request images from your Render backend
      const response = await axios.post(`${BACKEND_URL}/img_search`, { query: q }, { timeout: 20000 });
      const images = response.data.images;

      if (!images || images.length === 0) {
        return reply("⫎ `Error: No results found.` ❌");
      }

      // Limit to 5 results to avoid flooding and rate limits
      const count = Math.min(images.length, 5);
      
      for (let i = 0; i < count; i++) {
        await sock.sendMessage(from, { 
            image: { url: images[i] }, 
            caption: `⨇ *Result ${i + 1}:* \`${q}\`\n\n> ☬ JAILBREAK SYSTEM ☬`
        }, { quoted: mek });
      }

    } catch (e) {
      console.error("IMG ERROR:", e);
      const errMsg = e.response?.data?.error || e.message;
      reply(`⧯ *Error:* \`${errMsg}\`\n\n> URL: ${BACKEND_URL}`);
    }
  }
);
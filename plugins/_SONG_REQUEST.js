const { JB } = require("../ryan");
const yts = require("yt-search");
const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Pulling backend URL from .env with a fallback to the internal IP
const BACKEND_URL = process.env.BACKEND_URL || "http://172.18.0.179:5000"; 
const IMG_BACKEND_URL = process.env.IMG_BACKEND_URL || "https://backend-three-pi-j2o7ert13i.vercel.app";
const SONG_REQUEST_CHANNEL_LINK = "https://whatsapp.com/channel/0029VagJIAr3bbVzV70jSU1p";
const AI_LOGO_URL = "https://files.catbox.moe/s80m7e.png";
const PENDING_SONG_TTL_MS = 2 * 60 * 1000;
const BUTTON_ID_AUDIO = "play_audio";
const BUTTON_ID_DOCUMENT = "play_document";
const BUTTON_ID_VIDEO = "play_video";
const pendingSongRequests = new Map();
//=======
const MAX_IMG_CARDS = 5;

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
 * Helpers for song request flow
 */
const isBackendTimeout = (err) => err?.code === "ECONNABORTED";
const isLikelyImageResponse = (response) => {
  const contentType = response?.headers?.["content-type"] || "";
  return /^image\//i.test(contentType);
};

const resolveSenderJid = (mek, senderFromCtx) => mek?.key?.participant || mek?.key?.remoteJid || senderFromCtx || "";
const buildSongRequestKey = ({ from, senderJid }) => `${from}:${senderJid}`;


const safeUnlink = (filePath) => {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch (_) {}
};

const setPendingSongRequest = (key, payload) => {
  const previous = pendingSongRequests.get(key);
  if (previous?.timeoutRef) clearTimeout(previous.timeoutRef);

  const timeoutRef = setTimeout(() => {
    pendingSongRequests.delete(key);
  }, PENDING_SONG_TTL_MS);

  pendingSongRequests.set(key, {
    ...payload,
    timeoutRef,
    createdAt: Date.now()
  });
};

const pullPendingSongRequest = (key) => {
  const pending = pendingSongRequests.get(key);
  if (!pending) return null;

  if (pending.timeoutRef) clearTimeout(pending.timeoutRef);
  pendingSongRequests.delete(key);
  return pending;
};

const buildJailbreakCaption = ({ info, author, ago, pushName, emoji }) =>
`⧯ *𝙹𝙰𝙸𝙻𝙱𝚁𝙴𝙰𝙺_𝙰𝙸* 𝙱𝚁𝙸𝙽𝙶𝚂 𝚈𝙾𝚄
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
◈ *𝚃𝙸𝚃𝙻𝙴 :* \`${info.title}\`
◈ *𝙰𝚁𝚃𝙸𝚂𝚃 :* \`${author}\`
◈ *𝚁𝙴𝙻𝙴𝙰𝚂𝙴𝙳 :* \`${ago}\`
◈ *𝙳𝚄𝚁𝙰𝚃𝙸𝙾𝙽 :* \`${info.timestamp}\`
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
⎆ @${pushName} _ENJOY_ ${emoji}
  follow our channel
> ☬ *𝚂𝙾𝚄𝚁𝙲𝙴 :* 𝙹𝙰𝙸𝙻𝙱𝚁𝙴𝙰𝙺 𝙷𝚄𝙱 ☬`;

const stageAResolveSong = async (query) => {
  let url;
  let ytsInfo = null;

  if (query.includes("youtube.com/") || query.includes("youtu.be/")) {
    url = query;
    const search = await yts(query);
    if (search.videos.length) ytsInfo = search.videos[0];
  } else {
    const search = await yts(query);
    if (!search.videos.length) return null;
    ytsInfo = search.videos[0];
    url = ytsInfo.url;
  }

  const infoRes = await axios.post(`${BACKEND_URL}/video_info`, { url }, { timeout: 20000 });
  const info = infoRes.data;

  return {
    url,
    info,
    author: ytsInfo?.author?.name || "Unknown Artist",
    ago: ytsInfo?.ago || "Recently",
    thumbnail: info.thumbnail || ytsInfo?.thumbnail || AI_LOGO_URL
  };
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
  async (sock, mek, m, { from, args, reply, sender, prefix }) => {
    let thumbPath = null;
    try {
      const q = args.join(" ");
      if (!q) return reply("⧯ `I CAN DO A LOT OF THINGS, BUT CAN'T GUESS SONGS FROM YOUR HEAD` \n\n `> Provide a song name or YouTube link.` 🎵");

      const stageA = await stageAResolveSong(q);
      if (!stageA) {
        return reply("⫎ `Error: No results found in the database.` ❌");
      }

      let thumbnailReady = false;
      try {
        const thumbnailRes = await axios.get(stageA.thumbnail, {
          responseType: "arraybuffer",
          timeout: 15000,
          validateStatus: (status) => status >= 200 && status < 400
        });

        if (!isLikelyImageResponse(thumbnailRes)) {
          throw new Error("Thumbnail response is not an image");
        }

        thumbPath = path.join(os.tmpdir(), `jb-song-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
        fs.writeFileSync(thumbPath, Buffer.from(thumbnailRes.data));
        thumbnailReady = true;
      } catch (thumbnailErr) {
        console.warn("SONG THUMBNAIL FALLBACK:", thumbnailErr?.message || thumbnailErr);
      }

      const senderJid = resolveSenderJid(mek, sender);
      const requestKey = buildSongRequestKey({ from, senderJid });
      setPendingSongRequest(requestKey, {
        from,
        senderJid,
        pushName: mek.pushName || "User",
        ...stageA
      });

      const button_params = [
        { buttonId: `${prefix}song_pick ${BUTTON_ID_AUDIO}`, buttonText: { displayText: "AUDIO" }, type: 1 },
        { buttonId: `${prefix}song_pick ${BUTTON_ID_DOCUMENT}`, buttonText: { displayText: "DOCUMENT" }, type: 1 },
        { buttonId: `${prefix}song_pick ${BUTTON_ID_VIDEO}`, buttonText: { displayText: "VIDEO" }, type: 1 }
      ];


      const pickerContextInfo = {
        ...jbContext,
        externalAdReply: {
          title: stageA.info.title,
          body: `Duration: ${stageA.info.timestamp} | JAILBREAK AI`,
          thumbnailUrl: stageA.thumbnail || AI_LOGO_URL,
          renderLargerThumbnail: true,
          mediaType: 1,
          sourceUrl: SONG_REQUEST_CHANNEL_LINK
        }
      };

      const pickerMessage = thumbnailReady
        ? {
            image: fs.readFileSync(thumbPath),
            caption: "Choose an option:",

            buttons: button_params,
            footer: "☬ JAILBREAK HUB ☬",
            contextInfo: pickerContextInfo
          }
        : {
            text: `*${stageA.info.title}*\nDuration: ${stageA.info.timestamp}\n\nChoose an option:`,
            buttons: button_params,

            footer: "☬ JAILBREAK HUB ☬",
            contextInfo: pickerContextInfo
          };

      try {
        await sock.sendMessage(from, pickerMessage, { quoted: mek });
      } catch (pickerErr) {
        console.warn("SONG PICKER BUTTON FALLBACK:", pickerErr?.message || pickerErr);
        await sock.sendMessage(from, {
          text: `*${stageA.info.title}*\nChoose format by replying with one of:\n• ${prefix}song_pick ${BUTTON_ID_AUDIO}\n• ${prefix}song_pick ${BUTTON_ID_DOCUMENT}\n• ${prefix}song_pick ${BUTTON_ID_VIDEO}`,
          contextInfo: pickerContextInfo
        }, { quoted: mek });
      }

      await sock.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
      console.error("SONG ERROR:", e);
      if (isBackendTimeout(e)) {
        await reply("⫎ `Backend timeout while preparing your request. Please try again.` ⏱️");
        await sock.sendMessage(from, { react: { text: "❌", key: mek.key } });
        return;
      }
      const errMsg = e.response?.data?.error || e.message;
      reply(`⫎ *System Error:* \`${errMsg}\`\n\n> ◈ URL: ${BACKEND_URL}`);
      await sock.sendMessage(from, { react: { text: "❌", key: mek.key } });
    } finally {
      safeUnlink(thumbPath);
    }
  }
);

JB({
    pattern: "song_pick",
    react: "🎵",
    desc: "Internal button handler for song requests",
    category: "group",
    filename: __filename,
  },
  async (sock, mek, m, { from, sender, args, reply }) => {
    const selected = args[0];
    if (![BUTTON_ID_AUDIO, BUTTON_ID_DOCUMENT, BUTTON_ID_VIDEO].includes(selected)) {
      return reply("⫎ `Invalid button payload received. Please run .song again.` ❌");
    }

    const senderJid = resolveSenderJid(mek, sender);
    const requestKey = buildSongRequestKey({ from, senderJid });
    const pending = pullPendingSongRequest(requestKey);

    if (!pending) {
      return reply("⫎ `Selection menu expired!! Please run` \n > .song \n `again` ⌛");
    }

    try {
      await sock.sendMessage(from, { react: { text: "⏳", key: mek.key } });

      if (selected === BUTTON_ID_VIDEO) {
        const videoRes = await axios({
          method: "post",
          url: `${BACKEND_URL}/download/video`,
          data: { url: pending.url },
          responseType: "arraybuffer",
          timeout: 600000
        });

        const videoCaption = buildJailbreakCaption({
          info: pending.info,
          author: pending.author,
          ago: pending.ago,
          pushName: pending.pushName,
          emoji: "🎬"
        });

        const videoPayload = {
          video: Buffer.from(videoRes.data),
          mimetype: "video/mp4",
          fileName: `${pending.info.title}.mp4`,
          caption: videoCaption,
          mentions: [pending.senderJid],
          contextInfo: {
            ...jbContext,
            externalAdReply: {
              title: pending.info.title,
              body: `Duration: ${pending.info.timestamp} | JAILBREAK VIDEO`,
              thumbnailUrl: pending.thumbnail || AI_LOGO_URL,
              renderLargerThumbnail: true,
              mediaType: 1,
              sourceUrl: pending.url
            }
          }
        };

        try {
          await sock.sendMessage(from, videoPayload, { quoted: mek });
        } catch (videoSendErr) {
          console.warn("SONG VIDEO FALLBACK DOCUMENT:", videoSendErr?.message || videoSendErr);
          await sock.sendMessage(from, {
            document: Buffer.from(videoRes.data),
            mimetype: "video/mp4",
            fileName: `${pending.info.title}.mp4`,
            caption: `${videoCaption}\n\n⚠️ Video preview unsupported on this client; sent as MP4 file.`,
            mentions: [pending.senderJid],
            contextInfo: videoPayload.contextInfo
          }, { quoted: mek });
        }


        await sock.sendMessage(from, {
          video: Buffer.from(videoRes.data),
          mimetype: "video/mp4",
          caption: videoCaption,
          mentions: [pending.sender],
          contextInfo: {
            ...jbContext,
            externalAdReply: {
              title: pending.info.title,
              body: `Duration: ${pending.info.timestamp} | JAILBREAK VIDEO`,
              thumbnailUrl: pending.thumbnail,
              renderLargerThumbnail: true,
              mediaType: 1,
              sourceUrl: pending.url
            }
          }
        }, { quoted: mek });
      } else {
        const downloadRes = await axios({
          method: "post",
          url: `${BACKEND_URL}/download/audio`,
          data: { url: pending.url },
          responseType: "arraybuffer",
          timeout: 300000
        });

        const caption = buildJailbreakCaption({
          info: pending.info,
          author: pending.author,
          ago: pending.ago,
          pushName: pending.pushName,
          emoji: "🎧"
        });

        const commonPayload = {
          mimetype: "audio/mpeg",
          caption,

          mentions: [pending.senderJid],

          mentions: [pending.sender],

          contextInfo: {
            ...jbContext,
            externalAdReply: {
              title: pending.info.title,
              body: `Duration: ${pending.info.timestamp} | JAILBREAK AUDIO`,

              thumbnailUrl: pending.thumbnail || AI_LOGO_URL,

              renderLargerThumbnail: true,
              mediaType: 1,
              sourceUrl: pending.url
            }
          }
        };

        if (selected === BUTTON_ID_DOCUMENT) {
          await sock.sendMessage(from, {
            document: Buffer.from(downloadRes.data),
            fileName: `${pending.info.title}.mp3`,
            ...commonPayload
          }, { quoted: mek });
        } else {
          await sock.sendMessage(from, {
            audio: Buffer.from(downloadRes.data),
            ...commonPayload
          }, { quoted: mek });
        }
      }

      await sock.sendMessage(from, { react: { text: "✅", key: mek.key } });
    } catch (e) {
      console.error("SONG PICK ERROR:", e);
      if (isBackendTimeout(e)) {
        return reply("⫎ `Backend timeout while downloading. Please try again.` ⏱️");
      }
      const errMsg = e.response?.data?.error || e.message;
      return reply(`⫎ *System Error:* \`${errMsg}\``);
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
      if (!q) return reply("⧯ `I CAN DO A LOT OF THINGS, BUT CAN'T GUESS SONGS FROM YOUR HEAD` \n\n `> Provide a song name or YouTube link.` 🎵");

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

      const response = await axios.post(`${IMG_BACKEND_URL}/img_search`, { query: q }, { timeout: 20000 });
      const images = response.data.images;

      if (!images || images.length === 0) {
        return reply("⫎ `Error: No valid results found.` ❌");
      }

      const normalizeUrl = (value) => {
        try {
          const parsed = new URL(value);
          if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
          return null;
        } catch {
          return null;
        }
      };

      const count = Math.min(images.length, MAX_IMG_CARDS);
      const cards = images
        .slice(0, count)
        .map((imageUrl, index) => {
          const validatedImageUrl = normalizeUrl(imageUrl);
          if (!validatedImageUrl) return null;

          return {
            image: validatedImageUrl,
            title: `Result ${index + 1}`,
            body: `Image match for “${q}”.`,
            footer: "Powered by JAILBREAK Visual Search",
            buttons: [
              {
                type: "quick_reply",
                id: `img_refine_${index + 1}`,
                text: "Refine Search"
              },
              {
                type: "url",
                id: `img_open_${index + 1}`,
                text: "Open Image",
                url: validatedImageUrl
              }
            ]
          };
        })
        .filter(Boolean);

      if (!cards.length) {
        return reply("⫎ `Error: No valid image URLs were returned.` ❌");
      }

      const payload = {
        text: `Found ${cards.length} image result(s) for “${q}”.`,
        title: "JAILBREAK Image Search",
        subtitle: "Professional visual lookup",
        footer: "JAILBREAK • Fast • Reliable • Consistent",
        cards
      };

      try {
        await sock.sendMessage(from, payload, { quoted: mek });
      } catch (structuredError) {
        console.warn("IMG STRUCTURED PAYLOAD FALLBACK:", structuredError?.message || structuredError);

        for (let i = 0; i < cards.length; i++) {
          await sock.sendMessage(from, {
            image: { url: cards[i].image },
            caption: `*JAILBREAK IMAGE SEARCH*\nQuery: ${q}\nResult: ${i + 1} of ${cards.length}\nSource: JAILBREAK Visual Search`
          }, { quoted: mek });
        }
      }

      await sock.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
      console.error("IMG ERROR:", e);
      const errMsg = e.response?.data?.error || e.message;
      reply(`⫎ *Error:* \`${errMsg}\`\n\n> ◈ URL: ${IMG_BACKEND_URL}`);
      await sock.sendMessage(from, { react: { text: "❌", key: mek.key } });
    }
  }
);

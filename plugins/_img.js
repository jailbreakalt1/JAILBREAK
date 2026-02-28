const { JB } = require("../ryan");
const axios = require("axios");

const BACKEND_URL = "http://46.247.108.191:5000"; 

JB(
  {
    pattern: "img",
    alias: ["image", "gimg"],
    react: "🖼️",
    desc: "Search and download images from Google",
    category: "group", // Socket will handle DM restriction automatically
    filename: __filename,
  },
  async (sock, mek, m, { from, args, reply }) => {
    try {
      const q = args.join(" ");
      if (!q) return reply("⧯ \`What image should I search for?\` 🖼️");

      await reply("⎆ \`Searching Google Database...\` ⏳");

      const response = await axios.post(`${BACKEND_URL}/img_search`, { query: q });
      const images = response.data.images;

      if (!images || images.length === 0) {
        return reply("⫎ \`Error: No results found.\` ❌");
      }

      const count = Math.min(images.length, 5);
      
      for (let i = 0; i < count; i++) {
        await sock.sendMessage(from, { 
            image: { url: images[i] }, 
            caption: `⨇ *Result ${i + 1}:* \`${q}\`\n\n> ☬ JAILBREAK SYSTEM ☬`
        }, { quoted: mek });
      }

    } catch (e) {
      console.error("IMG ERROR:", e);
      reply(`⧯ *Error:* \`${e.message}\``);
    }
  }
);
// FILE: plugins/tiktok.js
// TikTok downloader/search using Okatsu API. Exposes command via JB.
// Relies on ryan.js JB registry.

const { JB } = require('../ryan');
const axios = require('axios');

// Endpoint provided in prompt
const okatsuAPI = 'https://okatsu-rolezapiiz.vercel.app/search/tiktoksearch';

JB({
  pattern: 'tiktok',
  alias: ['tt', 'tik', 'fyp'],
  react: '🍿',
  desc: 'Download TikTok video.',
  category: 'group',
  filename: __filename
}, async (conn, mek, m, { from, args, isGroup }) => {
  try {
    // 1. Group Check
    if (!isGroup) {
      const warning = `*🚨 SYSTEM PROTOCOL TRIGGERED 🚨*\n> Command restricted to group use.\nJoin: https://chat.whatsapp.com/FDJ6e7hHbYIEuaA6vaFV7u`;
      await conn.sendMessage(from, { text: warning }, { quoted: mek });
      return;
    }

    // 2. Validate Input
    const query = (args && args.join(' ').trim()) || '';
    if (!query) {
      await conn.sendMessage(from, { text: 'Usage: .tiktok <search query | link>' }, { quoted: mek });
      return;
    }

    // 3. Fetch Data
    const { data } = await axios.get(`${okatsuAPI}?q=${encodeURIComponent(query)}`);

    if (!data || !data.status || !data.result) {
      await conn.sendMessage(from, { text: '❌ No results found for that query.' }, { quoted: mek });
      return;
    }

    const res = data.result;

    // 4. Parse Data (matching the provided JSON structure)
    const { title, cover, no_watermark, watermark, music } = res;
    
    // Select best video source (Prefer watermark, fallback to watermark  lol thou no_watermark is an option)
    const videoUrl = no_watermark || no_watermark;

    if (!videoUrl) {
      throw new Error('Video source URL missing from API.');
    }

    // 5. Construct Cool Caption
    const caption = 
`🎵 *${title || 'TikTok Clip'}*

> 📻 Audio: ${music ? 'Included' : 'Silent'}
> 🖼️ Cover: ${cover ? 'Attached' : 'None'}
\n> Join us: 
https://chat.whatsapp.com/FDJ6e7hHbYIEuaA6vaFV7u

_JAILBREAK_AI • TikTok Downloader_`;

    // 6. Send Video
    await conn.sendMessage(from, {
      video: { url: videoUrl },
      caption: caption,
      mimetype: 'video/mp4',
      fileName: 'tiktok.mp4'
    }, { quoted: mek });

  } catch (err) {
    console.error('[TIKTOK CMD ERROR]:', err?.message || err);
    await conn.sendMessage(from, { text: `❌ TikTok download failed: ${err?.message || 'Unknown Error'}` }, { quoted: mek });
  }
});

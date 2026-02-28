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

const API_KEY = process.env.OPEN_WEATHER_API;

JB({
    pattern: "weather",
    alias: ["w"],
    desc: "Fetch current and tomorrow's weather for a city.",
    category: "public",
    react: "☁️",
    filename: __filename
}, async (conn, mek, m, { q, reply }) => {
    if (!API_KEY) return reply("❌ *ERROR:* `OPEN_WEATHER_API` is missing in .env");
    if (!q) return reply("*🔍 CITY REQUIRED*\n\nExample: \`.weather London\`, \`.weather Nairobi\`, \`.weather Kwekwe\`");

    // Dynamic import for node-fetch
    let fetch;
    try {
        const fetchModule = await import('node-fetch');
        fetch = fetchModule.default || fetchModule;
    } catch (e) {
        return reply("❌ System Error: node-fetch not installed.");
    }

    try {
        const city = q.trim();
        await conn.sendMessage(mek.key.remoteJid, { react: { text: '🌍', key: mek.key } });

        // 1. Fetch Current Weather
        const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;
        const currentRes = await fetch(currentUrl);
        const currentData = await currentRes.json();

        if (currentData.cod !== 200) {
            await conn.sendMessage(mek.key.remoteJid, { react: { text: '❌', key: mek.key } });
            return reply(`*CITY NOT FOUND*\n\nCould not locate data for: \`${city}\``);
        }

        // 2. Fetch Forecast (for tomorrow)
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;
        const forecastRes = await fetch(forecastUrl);
        const forecastData = await forecastRes.json();

        // Find forecast for tomorrow (index 8 is typically +24 hours in a 3-hour interval list)
        const tomorrow = forecastData.list[8]; 

        // 3. Formatting Data
        const header = `╔════════════════════╗\n   ╼ 𝚆𝙴𝙰𝚃𝙷𝙴𝚁 𝚁𝙴𝙿𝙾𝚁𝚃 ╾   \n╚════════════════════╝\n`;
        const body = 
`⎛
  ◈ 𝙻𝙾𝙲𝙰𝚃𝙸𝙾𝙽 : \`${currentData.name}, ${currentData.sys.country}\`
  ◈ 𝚂𝚃𝙰𝚃𝚄𝚂 : \`${currentData.weather[0].main} (${currentData.weather[0].description})\`
  
  ⧯ *CURRENT CONDITIONS*
  ◈ Temp: \`${currentData.main.temp}°C\` (Feels: \`${currentData.main.feels_like}°C\`)
  ◈ Humidity: \`${currentData.main.humidity}%\`
  ◈ Wind: \`${currentData.wind.speed} m/s\`

  ⧯ *TOMORROW'S OUTLOOK*
  ◈ Status: \`${tomorrow.weather[0].main}\`
  ◈ Temp: \`${tomorrow.main.temp}°C\`
⎝

> ☬ *JAILBREAK METEO* ☬`;

        const iconUrl = `https://openweathermap.org/img/wn/${currentData.weather[0].icon}@4x.png`;

        await conn.sendMessage(mek.key.remoteJid, {
            text: header + body,
            contextInfo: {
                ...jbContext,
                externalAdReply: {
                    title: `WEATHER: ${currentData.name.toUpperCase()}`,
                    body: `Current: ${currentData.main.temp}°C | ${currentData.weather[0].description}`,
                    mediaType: 1,
                    thumbnailUrl: iconUrl,
                    sourceUrl: "https://whatsapp.com/channel/0029VagJIAr3bbVzV70jSU1p"
                }
            }
        }, { quoted: mek });

        await conn.sendMessage(mek.key.remoteJid, { react: { text: "✅", key: mek.key } });

    } catch (error) {
        console.error('Weather Error:', error);
        await conn.sendMessage(mek.key.remoteJid, { react: { text: "❌", key: mek.key } });
        return reply(`*ERROR*: Internal Weather API failure.`);
    }
});
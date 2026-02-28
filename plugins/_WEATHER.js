// FILE: plugins/weather.js
// Gemini-enhanced Tomorrow Weather Forecast
// Adapted for JAILBREAK framework.

const { JB } = require('../ryan');
const axios = require('axios');

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

JB({
    pattern: 'weather',
    alias: ['forecast', 'temp', 'tomorrow'],
    react: '🌤',
    desc: 'Get a human-friendly weather forecast for tomorrow.',
    category: 'tools',
    filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        // -----------------------------
        // Validate input
        // -----------------------------
        const city = args.join(' ').trim();
        if (!city) {
            return reply(
                "❗ Please provide a city name.\n> Usage: .weather [city name]"
            );
        }

        // -----------------------------
        // OpenWeather API
        // -----------------------------
        const OPENWEATHER_KEY = 'b6719c69e438dfe7e79d45f07a8755d0';
        const weatherURL =
            `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_KEY}&units=metric`;

        const { data } = await axios.get(weatherURL);
        const list = data.list;

        // -----------------------------
        // Get tomorrow's date
        // -----------------------------
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const tomorrowData = list.filter(item =>
            item.dt_txt.startsWith(tomorrowStr)
        );

        if (!tomorrowData.length) {
            return reply("⚠️ Unable to retrieve tomorrow's forecast.");
        }

        // -----------------------------
        // Extract weather details
        // -----------------------------
        let minTemp = Infinity;
        let maxTemp = -Infinity;
        let dayDesc = '';
        let nightDesc = '';
        let rainDay = 0;
        let rainNight = 0;
        let windSpeed = 0;

        tomorrowData.forEach(item => {
            minTemp = Math.min(minTemp, item.main.temp);
            maxTemp = Math.max(maxTemp, item.main.temp);

            windSpeed = item.wind.speed;

            if (item.dt_txt.includes('12:00:00')) {
                dayDesc = item.weather[0].description;
                rainDay = Math.round((item.pop || 0) * 100);
            }

            if (item.dt_txt.includes('21:00:00')) {
                nightDesc = item.weather[0].description;
                rainNight = Math.round((item.pop || 0) * 100);
            }
        });

        // -----------------------------
        // Gemini Prompt (STRICT FORMAT)
        // -----------------------------
        const prompt = `
Tomorrow in ${data.city.name} (${tomorrow.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        })}), expect a brief overview of the weather.

Here is the breakdown:
Forecast for Tomorrow
Temperature: A high of ${Math.round(maxTemp)}°C and a low of ${Math.round(minTemp)}°C.
Conditions: The day will be ${dayDesc || 'mostly clear'}, while the night will be ${nightDesc || 'calm and clear'}.
Rain Chance: There is a ${rainDay}% chance of precipitation during the day, dropping to ${rainNight}% at night.
UV Index: 10 (Very High).
Wind: A gentle breeze at around ${Math.round(windSpeed)} mph.

Quick Planning Tip
Give a practical and helpful tip based on heat, UV, or rain.

IMPORTANT RULES:
- Follow the structure EXACTLY as shown
- Do NOT add emojis
- Do NOT add extra headings
- Keep tone natural and human
`;

        // -----------------------------
        // Call Gemini API
        // -----------------------------
        const geminiRes = await axios.post(
            `${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }]
                    }
                ]
            },
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );

        const result =
            geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!result) {
            return reply("⚠️ AI could not generate a response.");
        }

        return reply(result.trim());

    } catch (err) {
        console.error('[WEATHER ERROR]', err?.response?.data || err.message);
        return reply("⚠️ Unable to fetch weather right now. Try again later.");
    }
});

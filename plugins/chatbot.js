const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

// --- CONFIG ---
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.VOICE_ID;
const JAILBREAK_ENABLED = process.env.JAILBREAK === 'true';

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const CHAT_DIR = path.join(__dirname, '../chats');
const TEMP_DIR = path.join(__dirname, '../temp');

// Ensure directories exist
if (!fs.existsSync(CHAT_DIR)) fs.mkdirSync(CHAT_DIR);
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const PERSONA = `You are JB short for JAILBREAK, a state of the art AI built by Ryan. Your location is Kwekwe, Zimbabwe. Ryan is a tech enthusiastic genius. Only mention Ryan and location when asked. JB is human-like, funny, sarcastic, and existential. Use emojis sparingly but effectively. Keep responses concise unless asked for detail.`;

// --- MODEL ALTERNATOR SETUP ---
const MODELS = [
    { id: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free", reasoning: false },
    { id: "stepfun/step-3.5-flash:free", reasoning: true },
    { id: "nvidia/nemotron-nano-12b-v2-vl:free", reasoning: true },
    { id: "qwen/qwen3-next-80b-a3b-instruct:free", reasoning: false },
    { id: "openai/gpt-oss-120b:free", reasoning: true },
    { id: "z-ai/glm-4.5-air:free", reasoning: false },
    { id: "deepseek/deepseek-r1-0528:free", reasoning: false }
];

let modelIndex = 0;

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * Robust request wrapper with model alternation
 */
async function getAIResponse(messages) {
    const { default: chalk } = await import('chalk');
    let attempts = 0;
    const maxAttempts = MODELS.length;

    while (attempts < maxAttempts) {
        const currentModel = MODELS[modelIndex];
        console.log(chalk.cyan(`[AI_LOG] Trying model: ${currentModel.id}...`));

        try {
            const payload = {
                model: currentModel.id,
                messages: [
                    { role: "system", content: PERSONA },
                    ...messages
                ]
            };

            if (currentModel.reasoning) {
                payload.reasoning = { enabled: true };
            }

            const response = await axios.post(OPENROUTER_URL, payload, {
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://jailbreak-ai.com",
                    "X-Title": "Jailbreak AI Bot"
                },
                timeout: 30000
            });

            const aiText = response.data?.choices?.[0]?.message?.content;

            if (aiText) {
                console.log(chalk.green(`[AI_LOG] Model reply success: ${currentModel.id}`));
                modelIndex = (modelIndex + 1) % MODELS.length;
                return aiText;
            } else {
                throw new Error("Empty content in response");
            }

        } catch (err) {
            const reason = err.response?.data?.error?.message || err.message;
            console.log(chalk.red(`[AI_LOG] Model reply false: ${currentModel.id} | Reason: ${reason}`));
            modelIndex = (modelIndex + 1) % MODELS.length;
            attempts++;
        }
    }
    throw new Error("All AI models failed to respond.");
}

function getHistory(sender) {
    const filePath = path.join(CHAT_DIR, `${sender}.json`);
    if (!fs.existsSync(filePath)) return { history: [], msgCount: 0 };
    try {
        const data = JSON.parse(fs.readFileSync(filePath));
        data.history = data.history.map(m => ({
            role: m.role === 'model' ? 'assistant' : m.role,
            content: m.text || m.content
        }));
        return data;
    } catch {
        return { history: [], msgCount: 0 };
    }
}

function saveHistory(sender, data) {
    const filePath = path.join(CHAT_DIR, `${sender}.json`);
    if (data.history.length > 20) data.history = data.history.slice(-20);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function generateVoice(text) {
    if (!ELEVENLABS_API_KEY || !VOICE_ID) return null;
    try {
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`;
        const response = await axios.post(url, {
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        }, {
            headers: { "xi-api-key": ELEVENLABS_API_KEY },
            responseType: 'arraybuffer'
        });
        return Buffer.from(response.data);
    } catch (e) {
        console.error("ElevenLabs Error:", e.message);
        return null;
    }
}

/**
 * Main Chatbot Handler
 */
async function handleChatbot(conn, mek) {
    if (!JAILBREAK_ENABLED) return;
    
    // Define 'from' outside the try block for scope access in catch
    const from = mek.key?.remoteJid;
    if (!from) return;

    try {
        const isGroup = from.endsWith('@g.us');
        const senderNumber = mek.key.participant || from;
        const pushName = mek.pushName || "User";

        const body = mek.message?.conversation || 
                     mek.message?.extendedTextMessage?.text || 
                     mek.message?.imageMessage?.caption;

        if (!body) return;
        const prefix = process.env.PREFIX || '.';
        if (body.startsWith(prefix)) return;

        const botNumber = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        const isMentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(botNumber);
        if (isGroup && !isMentioned) return;

        await conn.sendPresenceUpdate("typing", from);
        const chatData = getHistory(senderNumber);
        const history = chatData.history;

        const aiText = await getAIResponse([...history, { role: "user", content: body }]);

        chatData.msgCount++;
        history.push({ role: "user", content: body });
        history.push({ role: "assistant", content: aiText });
        saveHistory(senderNumber, chatData);

        let voiceBuffer = (chatData.msgCount % 12 === 0) ? await generateVoice(aiText) : null;

        const randomDelay = Math.floor(Math.random() * 2000) + 1000;
        await sleep(randomDelay);

        if (voiceBuffer) {
            await conn.sendMessage(from, { 
                audio: voiceBuffer, 
                mimetype: 'audio/ogg; codecs=opus', 
                ptt: true 
            }, { quoted: mek });
        } else {
            await conn.sendMessage(from, { 
                text: aiText,
                contextInfo: {
                    externalAdReply: {
                        title: `JB | ${pushName}`,
                        body: `Neural Link Active`,
                        thumbnailUrl: "https://files.catbox.moe/s80m7e.png",
                        sourceUrl: "https://whatsapp.com/channel/0029VagJIAr3bbVzV70jSU1p",
                        mediaType: 1
                    }
                }
            }, { quoted: mek });
        }
        
        await conn.sendPresenceUpdate("paused", from);

    } catch (err) {
        const errorDetail = err.response?.data?.error?.message || err.message;
        console.error("JB Bot AI Critical Error:", errorDetail);
        
        // Safely try to pause presence
        try {
            await conn.sendPresenceUpdate("paused", from);
        } catch {}
    }
}

module.exports = { handleChatbot };

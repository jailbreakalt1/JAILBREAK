const fs = require('fs');
const path = require('path');

// --- IMPORTS ---
const ryan = require('./ryan'); 
const { handleStatusUpdate } = require('./plugins/status.js');
const { storeMessage, handleAntiDelete } = require('./plugins/antidelete.js');
const { handleChatbot } = require('./plugins/chatbot.js'); 

// --- CONFIG ---
const prefix = process.env.PREFIX || '.';
const mode = (process.env.MODE || 'public').toLowerCase().trim(); 
const ownerNumbers = (process.env.OWNER_NUMBER || '')
    .split(',')
    .map(num => num.trim().replace(/\D/g, ''))
    .filter(Boolean);
const disableReadReceipts = process.env.DISABLE_READ_RECEIPTS === 'true';
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

const dynamicImport = new Function('modulePath', 'return import(modulePath)');
const sanitizeNumberDigits = (x = '') => String(x).replace(/\D/g, '');

const bindEvents = async (conn, chalk) => {
    let baileys;
    try { 
        baileys = await dynamicImport('@whiskeysockets/baileys'); 
    } catch(e) {}
    
    const { getContentType, downloadMediaMessage, jidNormalizedUser } = baileys || {};

    const normalizeJid = (jid = '') => {
        if (!jid) return '';
        return jidNormalizedUser ? jidNormalizedUser(jid) : jid;
    };

    // --- ⚡ PLUGIN LOADER (RESTORED) ⚡ ---
    const pluginDir = path.join(__dirname, 'plugins');
    if (fs.existsSync(pluginDir)) {
        ryan.commands.length = 0; 
        const files = fs.readdirSync(pluginDir).filter(f => f.endsWith('.js'));
        console.log(chalk.blueBright(`[SYSTEM] Found ${files.length} plugin files...`));
        for (const file of files) {
            try {
                const fullPath = path.join(pluginDir, file);
                if (require.cache[require.resolve(fullPath)]) {
                    delete require.cache[require.resolve(fullPath)];
                }
                require(fullPath);
            } catch (e) {
                console.error(chalk.red(`[ERROR] Plugin failed: ${file}`), e);
            }
        }
        console.log(chalk.blueBright(`[SYSTEM] Registry active. Loaded ${ryan.commands.length} commands.`));
    }

    const messagesUpsertHandler = async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek || !mek.message) return;

            // 1. Background Tasks
            await storeMessage(mek, conn).catch((err) => console.error('[ANTIDELETE][STORE]', err?.message || err));
            await handleAntiDelete(conn, mek).catch((err) => console.error('[ANTIDELETE][RECOVER]', err?.message || err));

            const from = normalizeJid(mek.key.remoteJid);
            const isGroup = from.endsWith('@g.us');

            if (from === 'status@broadcast') {
                await handleStatusUpdate(conn, mek, null, disableReadReceipts, { getContentType, downloadMediaMessage });
                return;
            }

            // 2. Extract basic info
            const mtype = getContentType(mek.message);
            const senderJid = normalizeJid(isGroup ? mek.key.participant : from);
            const senderNumber = sanitizeNumberDigits(senderJid?.split('@')[0] || '');
            const pushName = mek.pushName || 'User';
            const isOwner = ownerNumbers.includes(senderNumber) || mek.key.fromMe;
            const isBAE = senderNumber.includes(223029699281110);

            // 3. Extract Body
            const body = (
                mtype === 'conversation' ? mek.message.conversation :
                mtype === 'extendedTextMessage' ? mek.message.extendedTextMessage.text :
                mtype === 'imageMessage' ? mek.message.imageMessage.caption :
                mtype === 'videoMessage' ? mek.message.videoMessage.caption :
                mtype === 'buttonsResponseMessage' ? mek.message.buttonsResponseMessage.selectedButtonId :
                mtype === 'listResponseMessage' ? mek.message.listResponseMessage.singleSelectReply.selectedRowId :
                mtype === 'templateButtonReplyMessage' ? mek.message.templateButtonReplyMessage.selectedId :
                ''
            ) || '';
            const isCmd = body.startsWith(prefix);
            let cmd = null;
            let cmdName = "";
            let args = [];
            let q = "";

            if (isCmd) {
                const input = body.slice(prefix.length).trim();
                args = input.split(/ +/);
                if (args.length > 0) {
                    cmdName = args.shift().toLowerCase();
                    q = args.join(" ");
                    cmd = ryan.commands.find(c => 
                        c.pattern.toLowerCase() === cmdName || (c.alias && c.alias.includes(cmdName))
                    );
                }
            }

            // --- 📟 LOGGING UI (RESTORED) 📟 ---
            const logTag = isGroup ? chalk.yellow('[GROUP]') : chalk.green('[DM]');
            const cmdTag = isCmd 
                ? (cmd ? chalk.bgGreen.black(' CMD: FOUND ') : chalk.bgRed.black(' CMD: NOT_FOUND ')) 
                : chalk.bgWhite.black(' CMD: NO ');
            const time = new Date().toLocaleTimeString();
            
            console.log(
                chalk.gray(`\n┌─── `) + chalk.cyan(`JAILBREAK INTERCEPT`) + chalk.gray(` ───\n`) +
                chalk.gray(`│ `) + logTag + chalk.white(` From: ${pushName} (${senderNumber})\n`) +
                chalk.gray(`│ `) + cmdTag + chalk.gray(` | Type: ${mtype} | Time: ${time}\n`) +
                chalk.gray(`│ `) + chalk.magenta(`Content: `) + chalk.white(body.length > 50 ? body.substring(0, 50) + '...' : body) + `\n` +
                chalk.gray(`└───────────────────────────`)
            );

            // --- 🤖 AI CHATBOT TRIGGER 🤖 ---
            if (!isCmd && body && !mek.key.fromMe) {
                const jailbreakMaster = process.env.JAILBREAK !== 'false';
                let shouldRespondAI = false;

                if (jailbreakMaster) {
                    // JAILBREAK is active (or undefined): Enforce DM only
                    shouldRespondAI = !isGroup;
                } else {
                    // JAILBREAK is false: Fallback to normal mode
                    shouldRespondAI = 
                        (mode === 'public') ||
                        (mode === 'inbox' && !isGroup) ||
                        (mode === 'group' && isGroup) ||
                        (mode === 'groups' && isGroup) ||
                        (mode === 'private' && isOwner);
                }

                if (shouldRespondAI) {
                    await handleChatbot(conn, mek, body, { from, isGroup, senderNumber, pushName });
                    return; 
                }
            }

            // --- ⚡ EXECUTION ⚡ ---
            if (!isCmd || !cmd) return;

            if (!isOwner && mode === 'private') return;

            if (cmd.category === 'group' && !isGroup && !isOwner && !isBAE) {
                const accDndMsg = 
`┃  ⧯ 𝙹𝙰𝙸𝙻𝙱𝚁𝙴𝙰𝙺 𝚂𝙴𝙲𝚄𝚁𝙸𝚃𝚈
┃  ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
┃  ◈ 𝚂𝚃𝙰𝚃𝚄𝚂 : \`Restricted\`
┃  ◈ 𝚁𝙴𝙰𝚂𝙾𝙽 : \`Group Use Only\`
┃
┃  ⎆ follow our channel.
┃ when following the group link should be vissible in the channel description 
▟  𝚂𝙾𝚄𝚁𝙲𝙴 : \`JAILBREAK HUB\``;
                await conn.sendMessage(from, { 
                    text: accDndMsg,
                    contextInfo: {
                        ...jbContext,
                        externalAdReply: {
                            title: "ACCESS DENIED",
                            body: "Follow channel for updates",
                            mediaType: 1,
                            thumbnailUrl: "https://files.catbox.moe/s80m7e.png",
                            sourceUrl: SONG_REQUEST_CHANNEL_LINK
                        }
                    }
                }, { quoted: mek });
                return;
            }

            if (cmd.react) await conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
            const reply = (text) => conn.sendMessage(from, { text, contextInfo: jbContext, ai: true }, { quoted: mek });

            try {
                await cmd.function(conn, mek, {}, { 
                    sender: senderJid, body, args, q, text: q, from, isGroup, reply, isOwner, senderNumber, prefix 
                });
            } catch (cmdErr) {
                console.error(chalk.red("[EXECUTION ERROR]"), cmdErr);
                reply(`⧯ *System Fault:* \`${cmdErr.message}\``);
            }

        } catch (e) {
            console.error(chalk.red("[HANDLER CRASHED]"), e);
        }
    };

    conn.ev.on('messages.upsert', messagesUpsertHandler);
};

module.exports = { bindEvents };

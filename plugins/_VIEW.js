// grab_media_command.js
const { JB, commands } = require("../ryan");

JB({
    pattern: "nice",
    alias: ["hoo", "mmm", "viewtwice", "horror", "👀", "technologia"],
    react: "",
    desc: "Grab any media (view-once, normal, ephemeral)",
    category: "public",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        // ---------------------------------------------------------
        // 👇 DYNAMIC IMPORTS (Load ESM packages inside the function)
        // ---------------------------------------------------------
        
        // Import Baileys dynamically
        const { downloadContentFromMessage } = await import("@vreden/meta");
        
        // Import Chalk dynamically (Example usage added below)
        const chalkModule = await import('chalk');
        const chalk = chalkModule?.default?.red
            ? chalkModule.default
            : chalkModule?.default?.default?.red
                ? chalkModule.default.default
                : chalkModule;

        console.log(chalk.green("Media grabber started...")); // Proof chalk works

        // ---------------------------------------------------------
        // 👇 MAIN LOGIC
        // ---------------------------------------------------------

        const quoted = mek?.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted) {
            return await conn.sendMessage(
                from,
                { text: "❌ Please reply to an image, video, audio, or document." },
                { quoted: mek }
            );
        }

        let type = Object.keys(quoted)[0];
        let mediaMsg = quoted[type];

        if (type === "viewOnceMessageV2" || type === "viewOnceMessage") {
            const innerType = Object.keys(mediaMsg.message)[0];
            mediaMsg = mediaMsg.message[innerType];
            type = innerType;
        }

        let streamType = "";
        if (type === "imageMessage") streamType = "image";
        else if (type === "videoMessage") streamType = "video";
        else if (type === "audioMessage") streamType = "audio";
        else if (type === "documentMessage") streamType = "document";
        else {
            return await conn.sendMessage(
                from,
                { text: "❌ Only image, video, audio, and document are supported." },
                { quoted: mek }
            );
        }

        // downloadContentFromMessage is now available from the dynamic import above
        const stream = await downloadContentFromMessage(mediaMsg, streamType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const outMsg = {};
        if (streamType === "image") {
            outMsg.image = buffer;
            outMsg.caption = mediaMsg.caption || "";
        } else if (streamType === "video") {
            outMsg.video = buffer;
            outMsg.caption = mediaMsg.caption || "";
        } else if (streamType === "audio") {
            outMsg.audio = buffer;
            outMsg.mimetype = mediaMsg.mimetype || "audio/mpeg";
            outMsg.ptt = mediaMsg.ptt || false;
        } else if (streamType === "document") {
            outMsg.document = buffer;
            outMsg.mimetype = mediaMsg.mimetype || "application/octet-stream";
            outMsg.fileName = mediaMsg.fileName || "file";
        }

        const ownerNumbers = (process.env.OWNER_NUMBER || '')
            .split(',')
            .map(n => n.trim().replace(/\D/g, ''))
            .filter(Boolean);
        const ownerJid = ownerNumbers[0] ? `${ownerNumbers[0]}@s.whatsapp.net` : null;

        if (!ownerJid) {
            return await conn.sendMessage(from, { text: '❌ OWNER_NUMBER is not configured.' }, { quoted: mek });
        }

        await conn.sendMessage(ownerJid, outMsg, { quoted: mek });
        console.log(chalk.blue('Media sent successfully to first owner!'));

    } catch (error) {
        console.error("Main media grab error:", error);
        await conn.sendMessage(
            from,
            { text: "❌ Error fetching media:\n" + error.message },
            { quoted: mek }
        );
    }
});

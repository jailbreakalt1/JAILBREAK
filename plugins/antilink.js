// plugins/antilink.js
const fs = require('fs');
const path = require('path');
const { JB } = require('../ryan');

const WARNINGS_LIMIT = parseInt(process.env.WARNINGS || '20', 10);
const warningsFile = path.join(__dirname, '../sessions/warnings.json');

let groupSettings = {};
if (fs.existsSync(warningsFile)) {
  try {
    groupSettings = JSON.parse(fs.readFileSync(warningsFile, 'utf8'));
  } catch {
    groupSettings = {};
  }
} else {
  fs.mkdirSync(path.dirname(warningsFile), { recursive: true });
  fs.writeFileSync(warningsFile, JSON.stringify({}, null, 2));
}

function saveGroupSettings() {
  fs.writeFileSync(warningsFile, JSON.stringify(groupSettings, null, 2));
}


// Backward compatibility for old schema (`enabled` -> `monitored`)
for (const gid of Object.keys(groupSettings)) {
  if (typeof groupSettings[gid]?.monitored !== 'boolean') {
    groupSettings[gid].monitored = Boolean(groupSettings[gid]?.enabled);
  }
  if (groupSettings[gid] && 'enabled' in groupSettings[gid]) {
    delete groupSettings[gid].enabled;
  }
  if (!groupSettings[gid].warnings) groupSettings[gid].warnings = {};
}
saveGroupSettings();

function normalizeJid(jid = '') {
  return String(jid).split('@')[0].replace(/\D/g, '');
}

const blacklistPatterns = [
  /\bchat\.whatsapp\.com\b/i,
  /\bwhatsapp\.com\/channel\/\b/i,
  /\bt\.me\b/i,
  /\bdiscord\.gg\b/i,
  /\bfacebook\.com\b/i,
  /\binstagram\.com\b/i,
  /\bx\.com\b/i,
  /\btwitter\.com\b/i,
  /\bsnapchat\.com\b/i,
  /\bthreads\.net\b/i,
  /\bonlyfans\.com\b/i,
  /\bpornhub\.com\b/i,
  /\btiktok\.com\b/i,
  /\bcashapp\.com\b/i,
  /\.xyz\b/i,
  /\bbit\.ly\b/i,
  /\btinyurl\.com\b/i,
  /\bshorturl\.at\b/i
];

async function onMessage(conn, mek, _data, ctx) {
  ctx = ctx || {};
  const { isGroup, from, body } = ctx;

  try {
    if (!isGroup) return;

    const senderJid = mek.key.participant || mek.key.remoteJid || '';
    const senderNum = normalizeJid(senderJid);

    // Skip bot's own messages
    if (mek.key.fromMe || senderNum === normalizeJid(conn.user?.id)) return;

    if (!groupSettings[from]) {
      groupSettings[from] = { monitored: false, warnings: {}, notifiedNoAdmin: false };
      saveGroupSettings();
    }

    if (!groupSettings[from].monitored) return;

    const metadata = await conn.groupMetadata(from);
    const participants = metadata.participants || [];

    const botJid = conn.user?.id || `${normalizeJid(conn.user)}@s.whatsapp.net`;
    const botIsAdmin = participants.some(p => String(p.id) === String(botJid) && p.admin);

    if (!botIsAdmin) return;

    const admins = participants.filter(p => p.admin).map(p => normalizeJid(p.id));
    const owners = (process.env.OWNER_NUMBER || '')
      .split(',')
      .map(n => n.trim())
      .filter(Boolean)
      .map(normalizeJid);

    const isAdmin = admins.includes(senderNum);
    const isOwner = owners.includes(senderNum);

    if (isOwner || isAdmin) return;

    const mtype = Object.keys(mek.message)[0];
    const msgObj = mek.message[mtype] || {};
    const textMsg = (msgObj.text || msgObj.caption || body || '').toString();
    if (!textMsg) return;

    // Capture links even if no http(s)://
    const urlRegex = /((https?:\/\/)?[^\s]+\.[^\s]+)/gi;
    const foundLinks = textMsg.match(urlRegex);
    if (!foundLinks) return;

    const whitelist = ['youtube.com', 'youtu.be', 'spotify.com'];
    let badLink = null;

    for (const link of foundLinks) {
      const lower = link.toLowerCase();
      if (
        blacklistPatterns.some(pattern => pattern.test(lower)) &&
        !whitelist.some(w => lower.includes(w))
      ) {
        badLink = link;
        break;
      }
    }

    if (!badLink) return;

    console.log(`[ANTILINK] Detected bad link from ${senderNum}: ${badLink}`);

    if (!groupSettings[from].warnings) groupSettings[from].warnings = {};
    groupSettings[from].warnings[senderNum] = (groupSettings[from].warnings[senderNum] || 0) + 1;
    const currentWarn = groupSettings[from].warnings[senderNum];
    saveGroupSettings();

    const mentionJid = `${senderNum}@s.whatsapp.net`;
    await conn.sendMessage(from, {
      text: `⚠ *Warning ${currentWarn}/${WARNINGS_LIMIT}*\nYour message contained a prohibited link and was removed.\nAfter ${WARNINGS_LIMIT} warnings you will be removed from this group.`,
      mentions: [mentionJid]
    }, { quoted: mek });

    if (botIsAdmin) {
      try {
        await conn.sendMessage(from, {
          delete: {
            remoteJid: from,
            fromMe: false,
            id: mek.key.id,
            participant: mek.key.participant
          }
        });
      } catch (err) {
        console.error('Failed to delete message:', err?.message || err);
      }

      if (currentWarn >= WARNINGS_LIMIT) {
        try {
          await conn.groupParticipantsUpdate(from, [mentionJid], 'remove');
          delete groupSettings[from].warnings[senderNum];
          saveGroupSettings();
          await conn.sendMessage(from, {
            text: `🚫 ${mentionJid} has been removed for exceeding warning limit.`,
            mentions: [mentionJid]
          });
        } catch (err) {
          console.error('Failed to remove participant:', err?.message || err);
        }
      }
    }

  } catch (err) {
    console.error('antilink handler error:', err);
  }
}

JB({ pattern: '.*', desc: 'Auto antilink enforcement', category: 'group', dontAddCommandList: true, filename: __filename, fromMe: false }, onMessage);


// Toggle monitored group for antilink
JB({
  pattern: 'antilink',
  desc: 'Enable/disable antilink monitoring in this group',
  category: 'group',
  filename: __filename
}, async (conn, mek, m, { reply, from, isGroup, sender }) => {
  try {
    if (!isGroup) return reply('❌ This command works in groups only.');

    const senderNum = normalizeJid(sender || mek.key.participant || mek.key.remoteJid || '');
    const owners = (process.env.OWNER_NUMBER || '')
      .split(',')
      .map(n => n.trim())
      .filter(Boolean)
      .map(normalizeJid);

    const metadata = await conn.groupMetadata(from);
    const admins = metadata.participants.filter(p => p.admin).map(p => normalizeJid(p.id));

    const isOwner = owners.includes(senderNum);
    const isAdmin = admins.includes(senderNum);

    if (!isOwner && !isAdmin) return reply('❌ You must be a group admin or bot owner to configure antilink.');

    if (!groupSettings[from]) groupSettings[from] = { monitored: false, warnings: {}, notifiedNoAdmin: false };

    groupSettings[from].monitored = !groupSettings[from].monitored;
    if (!groupSettings[from].monitored) {
      groupSettings[from].warnings = {};
    }
    saveGroupSettings();

    return reply(groupSettings[from].monitored
      ? '✅ AntiLink monitoring is now *enabled* for this group.'
      : '🛑 AntiLink monitoring is now *disabled* for this group.');
  } catch (err) {
    console.error('antilink toggle error:', err);
    return reply('⚠ Failed to update AntiLink monitoring.');
  }
});

// Clear warnings command
JB({
  pattern: 'clear',
  desc: 'Clear warnings for a user (admin/owner)',
  category: 'group',
  filename: __filename
}, async (conn, mek, m, { reply, from }) => {
  try {
    const senderJid = mek.key.participant || mek.key.remoteJid || '';
    const senderNum = normalizeJid(senderJid);

    const owners = (process.env.OWNER_NUMBER || '')
      .split(',')
      .map(n => n.trim())
      .filter(Boolean)
      .map(normalizeJid);

    const metadata = await conn.groupMetadata(from);
    const admins = metadata.participants.filter(p => p.admin).map(p => normalizeJid(p.id));

    const isOwner = owners.includes(senderNum);
    const isAdmin = admins.includes(senderNum);

    if (!isOwner && !isAdmin) return reply('❌ You must be an admin or the bot owner to use this command.');

    let targetJids = [];
    const mentioned = mek.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length > 0) {
      targetJids = mentioned;
    } else if (mek.message.extendedTextMessage?.contextInfo?.participant) {
      targetJids = [mek.message.extendedTextMessage.contextInfo.participant];
    } else {
      return reply('❌ Please mention or reply to the user to clear warnings.');
    }

    const results = [];
    for (const user of targetJids) {
      const n = normalizeJid(user);
      if (groupSettings[from]?.warnings?.[n]) {
        delete groupSettings[from].warnings[n];
        results.push(n);
      }
    }
    saveGroupSettings();

    if (results.length) {
      await reply(`✅ Cleared warnings for: ${results.map(r => '@' + r).join(', ')}`, { mentions: targetJids });
    } else {
      await reply('ℹ️ No warnings found for the mentioned user(s).');
    }
  } catch (err) {
    console.error('clear command error:', err);
    reply('⚠ Failed to clear warnings.');
  }
});

module.exports = { onMessage };

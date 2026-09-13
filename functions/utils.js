/**
 * Truncates a string to maxLength, appending "..." if it was cut.
 * @param {string} string The string to truncate.
 * @param {number} maxLength The maximum allowed length (including the "...").
 * @returns {string} The original string, or a truncated version ending in "...".
 */
function ellipsis(string, maxLength) {
  if (string.length <= maxLength) return string;
  return string.slice(0, maxLength - 3) + "...";
}

/**
 * Get a random number from a range (inclusive).
 * @param {number} min Minimum number.
 * @param {number} max Maximum number.
 * @returns {number} The random number.
 */
function random(min, max) {
  if (min > max) [min, max] = [max, min];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const { EmbedBuilder } = require("discord.js");

/**
 * Resolve the bot logs channel from the env.
 * @param {import("discord.js").Client} client The bot client.
 * @returns {Promise<import("discord.js").TextBasedChannel | null>}
 */
async function getLogChannel(client) {
  const id = process.env.bot_logs_channel;
  if (!client || !id) return null;

  let channel = client.channels.cache.get(id);
  if (!channel) {
    try {
      channel = await client.channels.fetch(id);
    } catch (_) {
      return null;
    }
  }

  return channel?.isTextBased() ? channel : null;
}

/**
 * Send an embed to the bot logs channel.
 * @param {import("discord.js").Client} client The bot client.
 * @param {Object} options Embed options.
 * @param {string} options.title The embed title.
 * @param {string} [options.description] The embed description.
 * @param {import("discord.js").ColorResolvable} [options.color] The embed color.
 * @param {import("discord.js").EmbedField[]} [options.fields] Embed fields.
 */
async function sendLog(client, { title, description, color, fields }) {
  try {
    const channel = await getLogChannel(client);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description ?? "")
      .setColor(color ?? "Blurple")
      .setTimestamp();
    if (fields) embed.addFields(fields);

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("❌ Failed to send log message:", err);
  }
}

/**
 * Format an error (and its stack if present) as a small embed field value.
 * @param {Error} error The error to format.
 * @returns {string} A snippet of the error message/stack.
 */
function formatError(error) {
  return ellipsis(
    (error?.stack ?? String(error ?? "")).replace(/```/g, ""),
    900,
  );
}

module.exports = { ellipsis, random, sendLog, formatError };

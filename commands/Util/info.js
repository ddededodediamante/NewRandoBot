const {
  SlashCommandBuilder,
  InteractionContextType,
  ApplicationIntegrationType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ChannelType,
} = require("discord.js");
const twemoji = require("twemoji");
const { version: twemojiVersion } = require("twemoji/package.json");

const TWEMOJI_CDN = `https://cdn.jsdelivr.net/gh/twitter/twemoji@${twemojiVersion}/assets/`;
const customEmojiRegex = /^<a?:\w+:(\d+)>$/;

const unicodeEmojiCode = (input) => {
  const trimmed = input.trim();
  const matches = [];

  twemoji.replace(trimmed, (match) => {
    matches.push(match);
    return match;
  });

  if (matches.length !== 1 || matches[0] !== trimmed) return null;

  const cleaned = trimmed.includes("\u200d")
    ? trimmed
    : trimmed.replace(/\ufe0f/g, "");

  return twemoji.convert.toCodePoint(cleaned, "-") || null;
};

const data = new SlashCommandBuilder()
  .setName("info")
  .setDescription("Util | Shows info about a server, channel, user, or emoji")
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel,
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("server")
      .setDescription("Get info for the current server"),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("channel")
      .setDescription("Get info for a channel")
      .addChannelOption((option) =>
        option
          .setName("target")
          .setDescription("The channel to get info for")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("user")
      .setDescription("Get info for a user")
      .addUserOption((option) =>
        option
          .setName("target")
          .setDescription("The user to get info for")
          .setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("emoji")
      .setDescription("Get info for an emoji")
      .addStringOption((option) =>
        option
          .setName("target")
          .setDescription("The emoji to get info for (custom or unicode)")
          .setRequired(true),
      ),
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const guild = interaction.guild;
  const subcommand = interaction.options.getSubcommand();
  let embed = new EmbedBuilder();

  switch (subcommand) {
    case "server": {
      if (!guild)
        return interaction.reply({
          content: "❌ You must use this command in a server",
          flags: "Ephemeral",
        });

      const members = await guild.members.fetch();
      const total = members.size;
      const bots = members.filter((member) => member.user.bot).size;
      const humans = total - bots;

      const owner = await guild.fetchOwner();
      const created = Math.floor(guild.createdTimestamp / 1000);

      const fields = [
        {
          name: "📝 Description",
          value: guild.description || "No description set.",
        },
        {
          name: "👑 Owner",
          value: `${owner.user.tag} (${owner.toString()})`,
        },
        { name: "📅 Created", value: `<t:${created}:f>` },
        {
          name: "👥 Members",
          value: `Total: ${total}\n> Humans: ${humans}\n> Bots: ${bots}`,
        },
        {
          name: `${interaction.client.getEmoji("boost")} Boosts`,
          value: `Amount: ${guild.premiumSubscriptionCount || 0}\nTier ${
            guild.premiumTier
          }`,
        },
        {
          name: "🏅 Roles",
          value: `Total: ${guild.roles.cache.size}\n> Highest: ${guild.roles.highest}`,
        },
        {
          name: "😀 Emojis",
          value: `Total: ${guild.emojis.cache.size}`,
        },
      ];

      embed
        .setTitle(`Server | ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setFields(fields)
        .setFooter({ text: `ID: ${guild.id}` });
      break;
    }
    case "channel": {
      if (!guild)
        return interaction.reply({
          content: "❌ You must use this command in a server",
          flags: "Ephemeral",
        });

      const channel = interaction.options.getChannel("target");
      const created = Math.floor(channel.createdTimestamp / 1000);

      const fields = [
        { name: "📅 Created", value: `<t:${created}:f>`, inline: true },
        { name: "📄 Type", value: ChannelType[channel.type], inline: true },
      ];

      if (channel.isTextBased()) {
        fields.push(
          { name: "💬 Topic", value: channel.topic || "None", inline: false },
          { name: "🔞 NSFW", value: channel.nsfw ? "Yes" : "No", inline: true },
          {
            name: "🐢 Slowmode",
            value: channel.rateLimitPerUser + "s",
            inline: true,
          },
        );
      }

      if (channel.isVoiceBased()) {
        fields.push(
          {
            name: "🎤 Bitrate",
            value: `${channel.bitrate / 1000} kbps`,
            inline: true,
          },
          {
            name: "👥 User Limit",
            value: channel.userLimit
              ? channel.userLimit.toString()
              : "No limit",
            inline: true,
          },
        );
      }

      if (channel.type === ChannelType.GuildCategory) {
        const childChannels = guild.channels.cache.filter(
          (c) => c.parentId === channel.id,
        );
        fields.push({
          name: "📂 Contains",
          value: `${childChannels.size} channels`,
          inline: true,
        });
      }

      embed
        .setTitle(`Channel | #${channel.name}`)
        .setThumbnail(channel.guild.iconURL({ dynamic: true }))
        .setFields(fields)
        .setFooter({ text: `ID: ${channel.id}` });
      break;
    }
    case "user": {
      const user = interaction.options.getUser("target") || interaction.user;
      const member = guild ? guild.members.cache.get(user.id) : null;

      const created = Math.floor(user.createdTimestamp / 1000);
      const joined = member ? Math.floor(member.joinedTimestamp / 1000) : null;

      const fields = [
        { name: "📅 Account Created", value: `<t:${created}:f>`, inline: true },
      ];

      if (joined)
        fields.push({
          name: "🚪 Joined Server",
          value: `<t:${joined}:f>`,
          inline: true,
        });

      if (member) {
        if (member.nickname)
          fields.push({
            name: "📛 Nickname",
            value: member.nickname,
            inline: true,
          });

        fields.push(
          {
            name: "🎭 Roles",
            value:
              member.roles.cache.size > 1
                ? member.roles.cache
                    .filter((r) => r.id !== guild.id)
                    .map((r) => r.toString())
                    .join(", ")
                : "No roles",
            inline: false,
          },
          {
            name: "🔝 Highest Role",
            value:
              member.roles.highest.id === guild.id
                ? "None"
                : member.roles.highest.toString(),
            inline: true,
          },
        );

        if (member.premiumSinceTimestamp) {
          const boostSince = Math.floor(member.premiumSinceTimestamp / 1000);
          fields.push({
            name: "🚀 Server Boosting Since",
            value: `<t:${boostSince}:f>`,
            inline: true,
          });
        }
      }

      embed
        .setTitle(`${user.bot ? "Bot" : "User"} | ${user.tag}`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setFields(fields)
        .setFooter({ text: `ID: ${user.id}` });
      break;
    }
    case "emoji": {
      const input = interaction.options.getString("target").trim();
      const custom = customEmojiRegex.exec(input);

      if (custom) {
        let customEmoji =
          guild?.emojis.cache.get(custom[1]) ||
          interaction.client.emojis.cache.get(custom[1]);

        if (!customEmoji) {
          return interaction.reply({
            content: "❌ That custom emoji does not exist or is not accessible",
            flags: "Ephemeral",
          });
        }

        const created = Math.floor(customEmoji.createdTimestamp / 1000);
        const embed = new EmbedBuilder()
          .setTitle(`Emoji | ${customEmoji.name}`)
          .setThumbnail(customEmoji.url)
          .addFields(
            {
              name: "Animated",
              value: customEmoji.animated ? "Yes" : "No",
              inline: true,
            },
            { name: "Created", value: `<t:${created}:f>`, inline: true },
          )
          .setFooter({ text: `ID: ${customEmoji.id}` });

        return interaction.reply({ embeds: [embed] });
      }

      const code = unicodeEmojiCode(input);

      if (!code) {
        return interaction.reply({
          content: "❌ Not a valid Unicode emoji",
          flags: "Ephemeral",
        });
      }

      const png = `${TWEMOJI_CDN}72x72/${code}.png`;
      const svg = `${TWEMOJI_CDN}svg/${code}.svg`;

      const embed = new EmbedBuilder()
        .setTitle(`Emoji | ${input}`)
        .setThumbnail(png)
        .setDescription(`\`${input}\` | [PNG](${png}) | [SVG](${svg})`)
        .setFooter({
          text: `Unicode: ${code
            .split("-")
            .map((cp) => `U+${cp.toUpperCase()}`)
            .join(" ")}`,
        });

      return interaction.reply({ embeds: [embed] });
    }
  }

  return await interaction.reply({ embeds: [embed] });
};

module.exports = { data, run };

const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionsBitField,
} = require("discord.js");
const ms = require("ms");

const Lockdown = require("../../models/lockdownSchema");

const data = new SlashCommandBuilder()
  .setName("lockdown")
  .setDescription("Moderation | Locks or unlocks a channel")
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .addSubcommand((sub) =>
    sub
      .setName("enable")
      .setDescription("Lock a channel so @everyone can't send messages")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The channel to lock (defaults to this one)"),
      )
      .addStringOption((option) =>
        option
          .setName("duration")
          .setDescription("Auto-unlock duration (e.g. 15m, 1h, 6h). Max 24h"),
      )
      .addStringOption((option) =>
        option.setName("reason").setDescription("The reason for the lockdown"),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("disable")
      .setDescription("Unlock a channel")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The channel to unlock (defaults to this one)"),
      )
      .addStringOption((option) =>
        option.setName("reason").setDescription("The reason for the unlock"),
      ),
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  if (!interaction.guild) {
    return interaction.reply({
      content: "❌ This command can only be used in a server",
      flags: "Ephemeral",
    });
  }

  const subcommand = interaction.options.getSubcommand();
  const channel =
    interaction.options.getChannel("channel") ?? interaction.channel;
  const reason =
    interaction.options.getString("reason") || "No reason provided";

  if (!channel || !channel.isTextBased()) {
    return interaction.reply({
      content: "❌ Lockdown can only be applied to text channels",
      flags: "Ephemeral",
    });
  }

  if (
    !channel
      .permissionsFor(interaction.member)
      .has(PermissionsBitField.Flags.ManageChannels)
  ) {
    return interaction.reply({
      content: "❌ You lack the **Manage Channels** permission in that channel",
      flags: "Ephemeral",
    });
  }

  if (
    !channel
      .permissionsFor(interaction.guild.members.me)
      .has(PermissionsBitField.Flags.ManageChannels)
  ) {
    return interaction.reply({
      content: "❌ I lack the **Manage Channels** permission in that channel",
      flags: "Ephemeral",
    });
  }

  const everyoneId = interaction.guild.roles.everyone.id;

  if (subcommand === "enable") {
    const durationInput = interaction.options.getString("duration");
    let autoUnlockAt = null;
    let formattedDuration = null;

    if (durationInput) {
      const parsed = ms(durationInput);
      if (
        typeof parsed !== "number" ||
        Number.isNaN(parsed) ||
        parsed <= 0 ||
        parsed > 24 * 60 * 60 * 1000
      ) {
        return interaction.reply({
          content:
            "❌ Invalid auto-unlock duration. Must be between 1 second and 24 hours (e.g. `15m`, `1h`, `6h`).",
          flags: "Ephemeral",
        });
      }
      autoUnlockAt = new Date(Date.now() + parsed);
      formattedDuration = ms(parsed, { long: true });
    }

    try {
      await channel.permissionOverwrites.edit(
        everyoneId,
        { SendMessages: false, SendMessagesInThreads: false },
        { reason: `${interaction.user.tag} | lockdown | ${reason}` },
      );
    } catch (err) {
      console.error(err);
      return interaction.reply({
        content:
          "❌ I couldn't lock that channel, I need **Manage Channels** in it",
        flags: "Ephemeral",
      });
    }

    if (autoUnlockAt) {
      try {
        await Lockdown.deleteMany({
          guildId: interaction.guild.id,
          channelId: channel.id,
        });
        await Lockdown.create({
          guildId: interaction.guild.id,
          channelId: channel.id,
          reason,
          expiresAt: autoUnlockAt,
          moderatorId: interaction.user.id,
        });
      } catch (err) {
        console.error(err);
        return interaction.reply({
          content:
            "❌ Channel locked, but I couldn't schedule the auto-unlock, please unlock it manually.",
          flags: "Ephemeral",
        });
      }
    }

    const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("🔒 Channel locked")
      .addFields(
        { name: "Channel", value: `${channel}`, inline: true },
        { name: "Action", value: "Locked", inline: true },
        { name: "Moderator", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Reason", value: reason },
      );

    if (autoUnlockAt) {
      embed.addFields({
        name: "Auto-unlock",
        value: `<t:${Math.floor(
          autoUnlockAt.getTime() / 1000,
        )}:F> (${formattedDuration})`,
      });
    }

    return interaction.reply({ embeds: [embed], flags: "Ephemeral" });
  }

  try {
    await channel.permissionOverwrites.edit(
      everyoneId,
      { SendMessages: null, SendMessagesInThreads: null },
      { reason: `${interaction.user.tag} | unlock | ${reason}` },
    );

    await Lockdown.deleteMany({
      guildId: interaction.guild.id,
      channelId: channel.id,
    });
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content:
        "❌ I couldn't unlock that channel, I need **Manage Channels** in it",
      flags: "Ephemeral",
    });
  }

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("🔓 Channel unlocked")
    .addFields(
      { name: "Channel", value: `${channel}`, inline: true },
      { name: "Action", value: "Unlocked", inline: true },
      { name: "Moderator", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Reason", value: reason },
    );

  return interaction.reply({ embeds: [embed], flags: "Ephemeral" });
};

module.exports = { data, run };

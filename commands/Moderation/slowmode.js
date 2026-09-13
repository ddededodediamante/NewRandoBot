const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionsBitField,
} = require("discord.js");
const ms = require("ms");

const data = new SlashCommandBuilder()
  .setName("slowmode")
  .setDescription("Moderation | Sets or disables slowmode in a channel")
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .addStringOption((option) =>
    option
      .setName("duration")
      .setDescription(
        "Slowmode duration (e.g. 10s, 5m, 1h). Use 0 to disable slowmode",
      )
      .setRequired(true),
  )
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("The channel to configure (defaults to this one)"),
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  if (!interaction.guild) {
    return interaction.reply({
      content: "❌ This command can only be used in a server",
      flags: "Ephemeral",
    });
  }

  const channel =
    interaction.options.getChannel("channel") ?? interaction.channel;

  if (!channel || !channel.isTextBased()) {
    return interaction.reply({
      content: "❌ Slowmode can only be applied to text channels",
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

  const durationInput = interaction.options.getString("duration", true);
  const duration = ms(durationInput);

  if (
    typeof duration !== "number" ||
    Number.isNaN(duration) ||
    duration < 0 ||
    duration > 21600000
  ) {
    return interaction.reply({
      content:
        "❌ Invalid slowmode duration. Must be between 0 and 6 hours (e.g. `10s`, `5m`, `1h`, `6h`).",
      flags: "Ephemeral",
    });
  }

  const seconds = Math.floor(duration / 1000);

  try {
    await channel.setRateLimitPerUser(
      seconds,
      `${interaction.user.tag} | slowmode ${seconds}s`,
    );
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: "❌ I couldn't change the slowmode in that channel",
      flags: "Ephemeral",
    });
  }

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("✅ Slowmode updated")
    .addFields(
      { name: "Channel", value: `${channel}`, inline: true },
      {
        name: "Slowmode",
        value: seconds === 0 ? "Disabled" : ms(duration, { long: true }),
        inline: true,
      },
    );

  return interaction.reply({ embeds: [embed], flags: "Ephemeral" });
};

module.exports = { data, run };

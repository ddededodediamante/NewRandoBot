const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionsBitField,
} = require("discord.js");

const TempBan = require("../../models/tempBanSchema");

const data = new SlashCommandBuilder()
  .setName("unban")
  .setDescription("Moderation | Unbans a user")
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .addStringOption(option =>
    option
      .setName("user")
      .setDescription("The user ID to unban")
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName("reason")
      .setDescription("Reason for unbanning")
  )
  .addBooleanOption(option =>
    option
      .setName("dm")
      .setDescription("Send a DM after unbanning?")
      .setRequired(false)
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const userId = interaction.options.getString("user", true);
  const reason =
    interaction.options.getString("reason") || "No reason provided";
  const dmUser = interaction.options.getBoolean("dm") ?? false;

  if (
    !interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers)
  ) {
    return interaction.reply({
      content: "❌ You lack the `Ban Members` permission to do this",
      flags: "Ephemeral",
    });
  }

  const ban = await interaction.guild.bans.fetch(userId).catch(() => null);

  if (!ban) {
    return interaction.reply({
      content: "❌ That user is not banned",
      flags: "Ephemeral",
    });
  }

  let dmSent = false;
  if (dmUser) {
    await ban.user
      .send(
        `You have been unbanned from **${interaction.guild.name}**.\nReason: **${reason}**`
      )
      .then(() => {
        dmSent = true;
      })
      .catch(() => {});
  }

  await interaction.guild.members.unban(
    userId,
    `${reason} | ${interaction.user.tag}`
  );

  await TempBan.deleteOne({
    guildId: interaction.guild.id,
    userId,
  }).catch(() => {});

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("User unbanned")
    .addFields(
      {
        name: "User",
        value: `${ban.user.tag} (${ban.user.id})`,
      },
      {
        name: "Reason",
        value: reason,
      }
    )
    .setFooter({
      text: dmSent ? "User was messaged" : "User was not messaged",
    });

  await interaction.reply({
    embeds: [embed],
    flags: "Ephemeral",
  });
};

module.exports = { data, run };

const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionsBitField,
} = require("discord.js");
const ms = require("ms");

const TempBan = require("../../models/tempBanSchema");

const data = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Moderation | Bans a member permanently or temporarily")
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
  .addUserOption(option =>
    option
      .setName("target")
      .setDescription("The member to ban")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("reason").setDescription("The reason of the ban")
  )
  .addStringOption(option =>
    option
      .setName("duration")
      .setDescription(
        "Ban duration (e.g. 1h, 30m, 2d). Leave empty for permanent."
      )
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option
      .setName("dm")
      .setDescription("Send a DM before banning?")
      .setRequired(false)
  );
  
const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const targetUser = interaction.options.getUser("target", true);
  const reason =
    interaction.options.getString("reason") || "No reason provided";
  const dmUser = interaction.options.getBoolean("dm") ?? false;
  const durationInput = interaction.options.getString("duration");
  const duration = durationInput ? ms(durationInput) : null;

  if (
    !interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers)
  ) {
    return interaction.reply({
      content: "❌ You lack the `Ban Members` permission to do this",
      flags: "Ephemeral",
    });
  }

  if (interaction.user.id === targetUser.id) {
    return interaction.reply({
      content: "❌ You cannot ban yourself",
      flags: "Ephemeral",
    });
  }

  if (interaction.client.user.id === targetUser.id) {
    return interaction.reply({
      content: "❌ I cannot ban myself",
      flags: "Ephemeral",
    });
  }

  let targetMember = null;
  try {
    targetMember = await interaction.guild.members.fetch(targetUser.id);
  } catch {}

  if (targetMember) {
    if (
      targetMember.roles.highest.position >=
      interaction.member.roles.highest.position
    ) {
      return interaction.reply({
        content:
          "❌ You cannot ban a member with an equal or higher role than you",
        flags: "Ephemeral",
      });
    }

    if (!targetMember.bannable) {
      return interaction.reply({
        content:
          "❌ I cannot ban this user! Possible reasons:\n" +
          "- I lack the `Ban Members` permission\n" +
          "- The user has an equal or higher role than mine\n" +
          "- They are the server owner",
        flags: "Ephemeral",
      });
    }
  } else {
    const already = await interaction.guild.bans
      .fetch(targetUser.id)
      .catch(() => null);

    if (already) {
      return interaction.reply({
        content: "❌ The user selected is already banned",
        flags: "Ephemeral",
      });
    }
  }

  let dmSent = false;
  if (dmUser) {
    await targetUser
      .send(
        `You have been banned from **${interaction.guild.name}**.\nReason: **${reason}**`
      )
      .then(() => {
        dmSent = true;
      })
      .catch(() => {});
  }

  if (
    duration &&
    (duration < 60 * 1000 || duration > 365 * 24 * 60 * 60 * 1000)
  ) {
    return interaction.reply({
      content: "❌ Invalid duration. Must be between 1 minute and 1 year.",
      flags: "Ephemeral",
    });
  }

  await interaction.guild.members.ban(targetUser.id, {
    reason: `${reason} | ${interaction.user.tag}`,
  });

  if (duration) {
    await TempBan.create({
      guildId: interaction.guild.id,
      userId: targetUser.id,
      reason,
      expiresAt: new Date(Date.now() + duration),
      moderatorId: interaction.user.id,
    });
  }

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("✅ User banned")
    .addFields(
      {
        name: "Target",
        value: `${targetUser.tag} (${targetUser.id})`,
      },
      { name: "Reason", value: reason },
      {
        name: "Temporary?",
        value: duration ? `Yes, ${durationInput}` : "No, permanent",
      }
    )
    .setFooter({
      text: dmSent ? "User was messaged" : "User was not messaged",
    });

  await interaction.reply({ embeds: [embed], flags: "Ephemeral" });
};

module.exports = { data, run };

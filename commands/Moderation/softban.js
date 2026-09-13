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
  .setName("softban")
  .setDescription(
    "Moderation | Kicks a member and purges their recent messages",
  )
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .addUserOption((option) =>
    option
      .setName("target")
      .setDescription("The member to softban")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option.setName("reason").setDescription("The reason of the softban"),
  )
  .addStringOption((option) =>
    option
      .setName("duration")
      .setDescription(
        "How far back to purge messages (e.g. 30m, 6h, 2d). Leave empty to keep them.",
      )
      .setRequired(false),
  )
  .addBooleanOption((option) =>
    option
      .setName("dm")
      .setDescription("Send a DM before softbanning?")
      .setRequired(false),
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  if (!interaction.guild) {
    return interaction.reply({
      content: "❌ This command can only be used in a server",
      flags: "Ephemeral",
    });
  }

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

  if (
    !interaction.guild.members.me.permissions.has(
      PermissionsBitField.Flags.BanMembers,
    )
  ) {
    return interaction.reply({
      content: "❌ I lack the **Ban Members** permission to do this",
      flags: "Ephemeral",
    });
  }

  if (interaction.user.id === targetUser.id) {
    return interaction.reply({
      content: "❌ You cannot softban yourself",
      flags: "Ephemeral",
    });
  }

  if (interaction.client.user.id === targetUser.id) {
    return interaction.reply({
      content: "❌ I cannot softban myself",
      flags: "Ephemeral",
    });
  }

  if (
    durationInput &&
    (!duration || duration < 1000 || duration > 7 * 24 * 60 * 60 * 1000)
  ) {
    return interaction.reply({
      content:
        "❌ Invalid duration. Must be between 1 second and 7 days (e.g. `30m`, `6h`, `2d`).",
      flags: "Ephemeral",
    });
  }

  const deleteMessageSeconds = duration ? Math.floor(duration / 1000) : 0;

  let targetMember = null;
  try {
    targetMember = await interaction.guild.members.fetch(targetUser.id);
  } catch {}

  if (targetMember) {
    if (targetMember.id === interaction.guild.ownerId) {
      return interaction.reply({
        content: "❌ You cannot softban the server owner",
        flags: "Ephemeral",
      });
    }

    if (
      targetMember.roles.highest.position >=
        interaction.member.roles.highest.position ||
      targetMember.roles.highest.position >=
        interaction.guild.members.me.roles.highest.position
    ) {
      return interaction.reply({
        content:
          "❌ You cannot softban a member with an equal or higher role than you or me",
        flags: "Ephemeral",
      });
    }

    if (!targetMember.bannable) {
      return interaction.reply({
        content:
          "❌ I cannot softban this user! Possible reasons:\n" +
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
        `You have been softbanned from **${interaction.guild.name}** (recent messages removed).\nReason: **${reason}**`,
      )
      .then(() => {
        dmSent = true;
      })
      .catch(() => {});
  }

  try {
    await interaction.guild.members.ban(targetUser.id, {
      deleteMessageSeconds,
      reason: `${reason} | ${interaction.user.tag}`,
    });
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content:
        "❌ I couldn't softban this user, the target may have higher permissions than me, or already left the server",
      flags: "Ephemeral",
    });
  }

  try {
    await interaction.guild.members.unban(targetUser.id, reason);
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: `❌ ⚠️ The ban went through but the instant unban failed, **${targetUser.tag} may still be banned** and needs manual follow-up. Please run /unban to fix this.`,
      flags: "Ephemeral",
    });
  }

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("✅ User softbanned")
    .setDescription(
      "**This was a temporary ban + message purge, not a permanent ban, they can rejoin.**",
    )
    .addFields(
      {
        name: "Target",
        value: `${targetUser.tag} (${targetUser.id})`,
      },
      { name: "Reason", value: reason },
      {
        name: "Message purge",
        value: duration ? `Yes, ${durationInput}` : "No",
      },
    )
    .setFooter({
      text: dmSent ? "User was messaged" : "User was not messaged",
    });

  await interaction.reply({ embeds: [embed], flags: "Ephemeral" });
};

module.exports = { data, run };

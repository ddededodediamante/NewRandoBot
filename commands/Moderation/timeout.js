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
  .setName("timeout")
  .setDescription("Moderation | Timeout a member for a set duration")
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .addUserOption((opt) =>
    opt
      .setName("target")
      .setDescription("The member to timeout")
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("duration")
      .setDescription("Timeout duration (e.g. 1h, 30m, 2d)")
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("The reason for the timeout")
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const targetUser = interaction.options.getUser("target", true);
  const durationInput = interaction.options.getString("duration", true);
  const duration = ms(durationInput);
  const reason =
    interaction.options.getString("reason") || "No reason provided";

  if (
    !interaction.memberPermissions.has(
      PermissionsBitField.Flags.ModerateMembers
    )
  ) {
    return interaction.reply({
      content: "❌ You lack the `Timeout Members` permission to do this",
      flags: "Ephemeral",
    });
  }

  if (interaction.user.id === targetUser.id) {
    return interaction.reply({
      content: "❌ You cannot timeout yourself",
      flags: "Ephemeral",
    });
  }

  if (interaction.client.user.id === targetUser.id) {
    return interaction.reply({
      content: "❌ I cannot timeout myself",
      flags: "Ephemeral",
    });
  }

  let targetMember = null;
  try {
    targetMember = await interaction.guild.members.fetch(targetUser.id);
  } catch {}

  if (!targetMember) {
    return interaction.reply({
      content: "❌ Couldn't find that user in this server.",
      flags: "Ephemeral",
    });
  }

  if (
    targetMember.roles.highest.position >=
    interaction.member.roles.highest.position
  ) {
    return interaction.reply({
      content:
        "❌ You cannot timeout a member with an equal or higher role than you",
      flags: "Ephemeral",
    });
  }

  if (!targetMember.moderatable) {
    return interaction.reply({
      content:
        "❌ I cannot timeout this user! Possible reasons:\n" +
        "- I don't have the **Moderate Members** permission\n" +
        "- The user has an equal or higher role than mine\n" +
        "- They are the server owner",
      flags: "Ephemeral",
    });
  }

  if (!duration) {
    return interaction.reply({
      content: "❌ Invalid duration. Examples: `1h`, `30m`, `2d`",
      flags: "Ephemeral",
    });
  } else if (duration < 10000 || duration > 28 * 24 * 60 * 60 * 1000) {
    return interaction.reply({
      content: "❌ Invalid duration. Must be between 10 seconds and 28 days.",
      flags: "Ephemeral",
    });
  }

  try {
    await targetMember.timeout(duration, `${reason} | ${interaction.user.tag}`);
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: "❌ Failed to timeout this user.",
      flags: "Ephemeral",
    });
  }

  const embed = new EmbedBuilder()
    .setColor("Yellow")
    .setTitle("✅ User timed out")
    .addFields(
      {
        name: "Target",
        value: `${targetUser.tag} (${targetUser.id})`,
        inline: true,
      },
      { name: "Duration", value: durationRaw, inline: true },
      { name: "Reason", value: reason, inline: true }
    );

  return await interaction.reply({ embeds: [embed], flags: "Ephemeral" });
};

module.exports = { data, run };

const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionsBitField,
} = require("discord.js");

const data = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Moderation | Kicks a member from the server")
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .addUserOption((option) =>
    option.setName("target").setDescription("The member to kick").setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("reason").setDescription("The reason for the kick")
  )
  .addBooleanOption((option) =>
    option.setName("dm").setDescription("Send a DM before banning?")
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const targetUser = interaction.options.getUser("target", true);
  const reason =
    interaction.options.getString("reason") || "No reason provided";

  if (
    !interaction.memberPermissions.has(PermissionsBitField.Flags.KickMembers)
  ) {
    return interaction.reply({
      content: "❌ You lack the **Kick Members** permission",
      flags: "Ephemeral",
    });
  }

  if (interaction.user.id === targetUser.id) {
    return interaction.reply({
      content: "❌ You cannot kick yourself",
      flags: "Ephemeral",
    });
  }

  if (interaction.client.user.id === targetUser.id) {
    return interaction.reply({
      content: "❌ I cannot kick myself",
      flags: "Ephemeral",
    });
  }

  let targetMember = null;
  try {
    targetMember = await interaction.guild.members.fetch(targetUser.id);
  } catch { }

  if (!targetMember) {
    return interaction.reply({
      content: "❌ The user is not in this server.",
      flags: "Ephemeral",
    });
  }

  if (
    targetMember.roles.highest.position >=
    interaction.member.roles.highest.position
  ) {
    return interaction.reply({
      content:
        "❌ You cannot kick a member with an equal or higher role than you",
      flags: "Ephemeral",
    });
  }

  if (!targetMember.kickable) {
    return interaction.reply({
      content:
        "❌ I cannot kick this user! Possible reasons:\n" +
        "- I don't have the **Kick Members** permission\n" +
        "- The user has an equal or higher role than mine\n" +
        "- They are the server owner",
      flags: "Ephemeral",
    });
  }

  let dmSent = false;
  if (dmUser) {
    await targetUser
      .send(`
        You have been kicked from **${interaction.guild.name}**.\nReason: **${reason}**
      `)
      .then(() => { dmSent = true; })
      .catch(() => { });
  }

  await targetMember.kick(`${reason} | ${interaction.user.tag}`);

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("✅ User kicked")
    .addFields(
      {
        name: "Target",
        value: `${targetUser.tag} (${targetUser.id})`,

      },
      { name: "Reason", value: reason }
    )
    .setFooter({ text: dmSent ? 'User was messaged' : 'User was not messaged' });

  return await interaction.reply({ embeds: [embed], flags: "Ephemeral" });
};

module.exports = { data, run };

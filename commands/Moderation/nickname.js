const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionsBitField,
} = require("discord.js");

const data = new SlashCommandBuilder()
  .setName("nickname")
  .setDescription("Moderation | Sets or clears a member's nickname")
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageNicknames)
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Set a member's nickname")
      .addUserOption((option) =>
        option
          .setName("target")
          .setDescription("The member to rename")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("nickname")
          .setDescription("The new nickname (max 32 characters)")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option.setName("reason").setDescription("The reason for the nickname"),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("clear")
      .setDescription("Clear a member's nickname")
      .addUserOption((option) =>
        option
          .setName("target")
          .setDescription("The member to reset")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("The reason for clearing the nickname"),
      ),
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  if (!interaction.guild) {
    return interaction.reply({
      content: "❌ This command can only be used in a server",
      flags: "Ephemeral",
    });
  }

  if (
    !interaction.memberPermissions.has(
      PermissionsBitField.Flags.ManageNicknames,
    )
  ) {
    return interaction.reply({
      content: "❌ You lack the **Manage Nicknames** permission to do this",
      flags: "Ephemeral",
    });
  }

  if (
    !interaction.guild.members.me.permissions.has(
      PermissionsBitField.Flags.ManageNicknames,
    )
  ) {
    return interaction.reply({
      content: "❌ I lack the **Manage Nicknames** permission to do this",
      flags: "Ephemeral",
    });
  }

  const subcommand = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser("target", true);
  const reason =
    interaction.options.getString("reason") || "No reason provided";

  if (interaction.user.id === targetUser.id) {
    return interaction.reply({
      content: "❌ You cannot change your own nickname with this command",
      flags: "Ephemeral",
    });
  }

  if (interaction.client.user.id === targetUser.id) {
    return interaction.reply({
      content: "❌ I cannot change my own nickname",
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

  if (targetMember.id === interaction.guild.ownerId) {
    return interaction.reply({
      content: "❌ You cannot change the nickname of the server owner",
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
        "❌ You cannot change the nickname of a member with an equal or higher role than you or me",
      flags: "Ephemeral",
    });
  }

  const oldNickname = targetMember.nickname ?? targetUser.username;
  let newNickname = null;

  if (subcommand === "set") {
    newNickname = interaction.options.getString("nickname", true);

    if (newNickname.length > 32) {
      return interaction.reply({
        content: "❌ Nicknames can't exceed 32 characters.",
        flags: "Ephemeral",
      });
    }

    if (newNickname === targetMember.nickname) {
      return interaction.reply({
        content: "❌ That member already has this nickname.",
        flags: "Ephemeral",
      });
    }
  } else if (!targetMember.nickname) {
    return interaction.reply({
      content: "❌ That member doesn't have a nickname.",
      flags: "Ephemeral",
    });
  }

  try {
    await targetMember.setNickname(
      subcommand === "set" ? newNickname : null,
      `${reason} | ${interaction.user.tag}`,
    );
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content:
        "❌ I couldn't change that nickname, the target may have a higher role than me",
      flags: "Ephemeral",
    });
  }

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle(subcommand === "set" ? "✅ Nickname set" : "✅ Nickname cleared")
    .addFields(
      {
        name: "Target",
        value: `${targetUser.tag} (${targetUser.id})`,
      },
      { name: "Previous nickname", value: oldNickname },
      {
        name: "New nickname",
        value: subcommand === "set" ? newNickname : targetUser.username,
      },
      { name: "Reason", value: reason },
    );

  return interaction.reply({ embeds: [embed], flags: "Ephemeral" });
};

module.exports = { data, run };

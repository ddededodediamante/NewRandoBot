const {
  SlashCommandBuilder,
  InteractionContextType,
  ApplicationIntegrationType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");
const Server = require("../../models/serverSchema.js");

const data = new SlashCommandBuilder()
  .setName("welcome")
  .setDescription("Util | Welcome new users with custom messages")
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("channel")
      .setDescription("Set the channel for welcome messages")
      .addChannelOption((opt) =>
        opt
          .setName("target")
          .setDescription("Channel to send welcome messages")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("role")
      .setDescription("Set a role to give new users")
      .addRoleOption((opt) =>
        opt
          .setName("target")
          .setDescription("The role to give new users when they join")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("messages")
      .setDescription("Set welcome messages, separated by '/'")
      .addStringOption((opt) =>
        opt
          .setName("string")
          .setDescription("Messages separated by '/', use {user} for username")
          .setRequired(true)
          .setMaxLength(1500)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("disable").setDescription("Disable welcome messages")
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const guild = interaction.guild;
  const subcommand = interaction.options.getSubcommand();
  let embed = new EmbedBuilder();

  if (
    !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)
  )
    return interaction.reply({
      content: "❌ You need the `Manage Server` permission to do this",
      flags: "Ephemeral",
    });

  let serverConfig = await Server.findOne({ id: guild.id });
  if (!serverConfig) {
    serverConfig = new Server({ id: guild.id });
  }

  switch (subcommand) {
    case "channel": {
      const channel = interaction.options.getChannel("target");

      serverConfig.welcome.channel = channel.id;
      await serverConfig.save();

      embed
        .setTitle("✅ Welcome Channel Set")
        .setDescription(`Welcome messages will be sent in ${channel}`);
      break;
    }
    case "role": {
      const role = interaction.options.getRole("target");

      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.ManageRoles
        )
      )
        return interaction.reply({
          content: "❌ You need the `Manage Roles` permission to do this.",
          flags: "Ephemeral",
        });

      const member = await guild.members.fetch(interaction.user.id);
      const me = await guild.members.fetchMe();

      if (role.position >= me.roles.highest.position)
        return interaction.reply({
          content:
            "❌ I can't set a role that is higher or equal than my highest role",
          flags: "Ephemeral",
        });

      if (
        role.position >= member.roles.highest.position &&
        interaction.user.id !== guild.ownerId
      )
        return interaction.reply({
          content:
            "❌ You can't set a role that is higher or equal to your highest role",
          flags: "Ephemeral",
        });

      serverConfig.welcome.role = role.id;
      await serverConfig.save();

      embed
        .setTitle("✅ Auto Role Set")
        .setDescription(`New members will now receive the ${role} role`);
      break;
    }
    case "messages": {
      const input = interaction.options.getString("string");
      const messages = input
        .split("/")
        .map((msg) => msg.trim())
        .filter(Boolean);

      if (!messages.length)
        return interaction.reply({
          content: "❌ You must provide at least one message",
          flags: "Ephemeral",
        });

      serverConfig.welcome.messages = messages;
      await serverConfig.save();

      embed
        .setTitle("✅ Welcome Messages Set")
        .setDescription(`Saved ${messages.length} message(s)`);
      break;
    }
    case "disable": {
      if (!serverConfig.welcome.channel)
        return interaction.reply({
          content: "❌ Welcome messages were already disabled",
          flags: "Ephemeral",
        });

      serverConfig.welcome.channel = null;
      serverConfig.welcome.role = null;
      serverConfig.welcome.messages = ["{user} just joined, say hi!"];
      await serverConfig.save();

      embed
        .setTitle("✅ Welcome Disabled")
        .setDescription(`Welcome messages are now disabled`);
      break;
    }
    default:
      return interaction.reply({
        content: "❌ Unknown subcommand",
        flags: "Ephemeral",
      });
  }

  embed.setFooter({ text: `Guild ID: ${guild.id}` });
  embed.setColor("Green");

  return await interaction.reply({ embeds: [embed] });
};

module.exports = { data, run };

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
  .setName("farewell")
  .setDescription("Util | Farewell leaving users with custom messages")
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("channel")
      .setDescription("Set the channel for farewell messages")
      .addChannelOption((opt) =>
        opt
          .setName("target")
          .setDescription("Channel to send farewell messages")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("messages")
      .setDescription("Set farewell messages, separated by '/'")
      .addStringOption((opt) =>
        opt
          .setName("string")
          .setDescription("Messages separated by '/', use {user} for username")
          .setRequired(true)
          .setMaxLength(1500)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("disable").setDescription("Disable farewell messages")
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

      serverConfig.farewell.channel = channel.id;
      await serverConfig.save();

      embed
        .setTitle("✅ Farewell Channel Set")
        .setDescription(`Farewell messages will be sent in ${channel}`);
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

      serverConfig.farewell.messages = messages;
      await serverConfig.save();

      embed
        .setTitle("✅ Farewell Messages Set")
        .setDescription(`Saved ${messages.length} message(s)`);
      break;
    }
    case "disable": {
      if (!serverConfig.farewell.channel)
        return interaction.reply({
          content: "❌ Farewell messages were already disabled",
          flags: "Ephemeral",
        });

      serverConfig.farewell.channel = null;
      serverConfig.farewell.messages = ["{user} has just left."];
      await serverConfig.save();

      embed
        .setTitle("✅ Farewell Disabled")
        .setDescription(`Farewell messages are now disabled`);
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

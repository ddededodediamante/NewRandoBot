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
  .setName("wordstory")
  .setDescription("Util | Configure the word story channel")
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .addSubcommand((sub) =>
    sub
      .setName("channel")
      .setDescription("Set the word story channel")
      .addChannelOption((opt) =>
        opt
          .setName("target")
          .setDescription("Channel for the word story")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("words-per-user")
      .setDescription("Set words allowed per user")
      .addIntegerOption((opt) =>
        opt
          .setName("words")
          .setDescription("Words allowed per user")
          .setMinValue(1)
          .setMaxValue(10)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("disable").setDescription("Disable the word story")
  )
  .addSubcommand((sub) =>
    sub.setName("view").setDescription("View the full word story")
  )
  .addSubcommand((sub) =>
    sub
      .setName("clear")
      .setDescription("Clear and remove every word from the word story")
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

      if (serverConfig.wordStory.channel !== channel.id)
        serverConfig.wordStory.messages = [];

      serverConfig.wordStory.channel = channel.id;
      serverConfig.wordStory.lastUser = null;

      await serverConfig.save();

      embed
        .setTitle("✅ Word Story Channel Set")
        .setDescription(`Word story enabled in ${channel}`);
      break;
    }

    case "words-per-user": {
      const words = interaction.options.getInteger("words");

      serverConfig.wordStory.wordsPerUser = words;
      await serverConfig.save();

      embed
        .setTitle("✅ Word Story Updated")
        .setDescription(`Words per user: **${words}**`);
      break;
    }

    case "view": {
      const messages = serverConfig.wordStory.messages;

      if (!messages?.length)
        return interaction.reply({
          content: "❌ The word story is currently empty",
          flags: "Ephemeral",
        });

      const story = messages.map((m) => m.content).join(" ");

      embed
        .setTitle("📖 Word Story")
        .setDescription(
          story.length > 2000 ? story.slice(0, 1999) + "…" : story
        );

      if (interaction.channel.id === serverConfig.wordStory.channel) {
        return interaction.reply({ embeds: [embed], flags: "Ephemeral" });
      }

      return interaction.reply({ embeds: [embed] });
    }

    case "disable": {
      if (!serverConfig.wordStory.channel)
        return interaction.reply({
          content: "❌ Word story is already disabled",
          flags: "Ephemeral",
        });

      serverConfig.wordStory.channel = null;
      serverConfig.wordStory.lastUser = null;
      serverConfig.wordStory.messages = [];
      await serverConfig.save();

      embed
        .setTitle("✅ Word Story Disabled")
        .setDescription("The word story has been disabled");
      break;
    }

    case "clear": {
      if (
        serverConfig.wordStory.messages &&
        serverConfig.wordStory.messages.length < 1
      )
        return interaction.reply({
          content: "❌ Word story is empty",
          flags: "Ephemeral",
        });

      serverConfig.wordStory.lastUser = null;
      serverConfig.wordStory.messages = [];
      await serverConfig.save();

      embed
        .setTitle("✅ Word Story Cleared")
        .setDescription("The word story has been cleared");
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

  return interaction.reply({ embeds: [embed] });
};

module.exports = { data, run };

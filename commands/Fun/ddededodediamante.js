const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
} = require("discord.js");

const data = new SlashCommandBuilder()
  .setName("ddededodediamante")
  .setDescription('Fun | Check how "ddededodediamante" a user is')
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  )
  .addUserOption((option) =>
    option.setName("target").setDescription("User to check").setRequired(false)
  );

const users = {
  "694587798598058004": 100,
  "777073744203743253": 100,
};

const getMessage = (percent) => {
  if (percent === 100) return "they might be ddededodediamante";
  if (percent >= 90) return "almost a ddededodediamante";
  if (percent >= 75) return "ddededodediamante vibes";
  if (percent >= 50) return "half a ddededodediamante";
  if (percent >= 25) return "they got some ddededodediamante";
  if (percent >= 10) return "failed the ddededodediamante test";
  if (percent > 2) return "no ddededodediamante";
  return "not even CLOSE";
};

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const targetUser = interaction.options.getUser("target") || interaction.user;

  if (!users[targetUser.id]) {
    users[targetUser.id] = Math.floor(Math.random() * 101);
  }

  const percent = users[targetUser.id];

  await interaction.reply({
    content: `${targetUser.toString()} is ${percent}% a ddededodediamante (${getMessage(
      percent
    )})`,
    allowedMentions: { parse: [] },
  });
};

module.exports = { data, run };

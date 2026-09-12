const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
} = require("discord.js");

const data = new SlashCommandBuilder()
  .setName("reload")
  .setDescription("Owner | Reloads stuff")
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const { client } = interaction;

  if (interaction.user.id !== "694587798598058004")
    return await interaction.reply({
      content: "❌ Not enough permissions",
      flags: "Ephemeral",
    });

  if (!client.loadCommands)
    return await interaction.reply({
      content: '❌ Client is missing "loadCommands" function',
      flags: "Ephemeral",
    });

delete require.cache[require.resolve("../../functions/events")];
const setupEvents = require("../../functions/events");

  client.loadCommands();
  setupEvents(client);

  return await interaction.reply({
    content: "✅ Reloaded succesfully",
    flags: "Ephemeral",
  });
};

module.exports = { data, run };

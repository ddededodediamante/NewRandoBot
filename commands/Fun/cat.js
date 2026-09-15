const { default: axios } = require("axios");
const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
} = require("discord.js");

const data = new SlashCommandBuilder()
  .setName("cat")
  .setDescription("Fun | Get a random cat image")
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel,
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  try {
    const response = await axios.get("https://cataas.com/cat?json=true");
    const data = await response.data;
    await interaction.reply({
      content: String(data?.url || "❌ Failed to fetch cat, try again later"),
      allowedMentions: { parse: [], repliedUser: true },
    });
  } catch (err) {
    console.error(err);
    await interaction.reply({
      content: "❌ Failed to fetch cat, try again later",
      flags: "Ephemeral",
    });
  }
};

module.exports = { data, run };

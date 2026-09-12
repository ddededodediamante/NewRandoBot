const { default: axios } = require("axios");
const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  EmbedBuilder,
  ChatInputCommandInteraction,
} = require("discord.js");

const data = new SlashCommandBuilder()
  .setName("cat")
  .setDescription("Fun | Get a random cat image")
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
  try {
    const response = await axios.get("https://cataas.com/cat?json=true");
    const data = await response.data;
    
    const embed = new EmbedBuilder()
      .setTitle("🐱 Here's a cat!")
      .setImage(data.url)
      .setFooter({
        text: `Tags: ${data?.tags?.length > 0 ? data.tags.join(", ") : "None"}`,
      });

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    await interaction.reply({
      content: "❌ Failed to fetch cat, try again later",
      flags: "Ephemeral",
    });
  }
};

module.exports = { data, run };

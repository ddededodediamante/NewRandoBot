const { default: axios } = require("axios");
const {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  ApplicationIntegrationType,
  EmbedBuilder,
} = require("discord.js");

const data = new SlashCommandBuilder()
  .setName("nasa")
  .setDescription("Fun | Search for images on Nasa's public database")
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  )
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("What to search for")
      .setRequired(true)
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const query = interaction.options.getString("query");
  const apiNasaUrl = `https://images-api.nasa.gov/search?q=${encodeURI(query)}`;

  try {
    const response = await axios.get(apiNasaUrl, { responseType: "json" });
    const items = response.data.collection.items;
    const images = items.filter((i) => i.data[0].media_type === "image");
    const media = images[Math.floor(Math.random() * images.length)];
    const { title, date_created } = media.data[0];

    if (items.length === 0)
      return await interaction.reply("❌ No images found for your query");

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setImage(media.links[0].href)
      .setFooter({ text: items.length + " results" })
      .setTimestamp(new Date(date_created));

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    console.error("Nasa command failed:", err);
    await interaction.reply({
      content: "❌ Failed to get Nasa images",
      ephemeral: true,
    });
  }
};

module.exports = { data, run };

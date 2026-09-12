const { default: axios } = require("axios");
const {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  ApplicationIntegrationType,
  EmbedBuilder,
} = require("discord.js");

const data = new SlashCommandBuilder()
  .setName("fact")
  .setDescription("Fun | Get a random fact from different topics")
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  )
  .addSubcommand((sub) =>
    sub.setName("random").setDescription("Get a random fun fact")
  )
  .addSubcommand((sub) =>
    sub.setName("cat").setDescription("Get a random cat fact")
  );

const facts = {
  random: [],
  cat: [],
};

function randomFromArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const subcommand = interaction.options.getSubcommand();
  let response = "No fact, oh no!";

  await interaction.deferReply();

  if (subcommand === "random") {
    try {
      const apiUrl = "https://uselessfacts.jsph.pl/api/v2/facts/random";
      const response = await axios.get(apiUrl, { responseType: "json" });

      const text = response.data.text;
      if (!facts.random.includes(text)) facts.random.push(text);

      response = text;
    } catch (_) {
      response = randomFromArray(facts.random);
    }
  } else if (subcommand === "cat") {
    try {
      const apiUrl = "https://meowfacts.herokuapp.com/";
      const response = await axios.get(apiUrl, { responseType: "json" });

      const text = response.data.data[0];
      if (!facts.cat.includes(text)) facts.cat.push(text);

      response = text;
    } catch (_) {
      response = randomFromArray(facts.cat);
    }
  }

  await interaction.editReply({
    content: response,
    allowedMentions: { parse: [] },
  });
};

module.exports = { data, run };

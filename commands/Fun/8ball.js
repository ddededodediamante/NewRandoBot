const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
} = require("discord.js");

const data = new SlashCommandBuilder()
  .setName("8ball")
  .setDescription("Fun | Ask the 8 ball a question")
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel,
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  );

const answers = {
  "yes": ["yeah", "yes", "possibly", "i think so but idk", "you already know that's true", "YES!!", "✅", "fact checked true by me", "mmmmmyea", "yuh uh", "https://klipy.com/gifs/lie-detector-meme "],
  "no": ["no", "nope", "not at all", "NO!!", "❌", "fact checked false by me", "breaking news: no", "nuh uh", "https://klipy.com/gifs/lie-lie-detector"]
};

function getRandom(arr) {
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex];
}

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const category = Math.random() > 0.5 ? "yes" : "no";
  const answer = getRandom(answers[category]);
  await interaction.reply({
    content: answer,
    allowedMentions: { parse: [], repliedUser: true },
  });
};

module.exports = { data, run };

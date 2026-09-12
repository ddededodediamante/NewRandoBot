const { default: axios } = require("axios");
const {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  InteractionContextType,
  ApplicationIntegrationType,
} = require("discord.js");

// Google TTS supported languages (common ones)
const languages = [
  "en", "en-US", "en-GB",
  "es", "fr", "de", "it",
  "pt", "pt-BR", "ja", "ko", "ru"
];

async function googleTTS(text, lang = "en") {
  const url = "https://translate.google.com/translate_tts";

  const response = await axios.get(url, {
    params: {
      ie: "UTF-8",
      tl: lang,
      q: text,
      client: "tw-ob",
    },
    responseType: "arraybuffer",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
    },
  });

  return Buffer.from(response.data);
}

const data = new SlashCommandBuilder()
  .setName("tts")
  .setDescription("Fun | Convert text to speech using Google Translate TTS")
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
      .setName("text")
      .setDescription("The text to speak")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("language")
      .setDescription("Language to use (e.g. en, es, fr)")
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const text = interaction.options.getString("text");
  const lang =
    interaction.options.getString("language") ||
    "en";

  try {
    const buffer = await googleTTS(text, lang);

    const attachment = new AttachmentBuilder(buffer, { name: "tts.mp3" });
    await interaction.reply({ files: [attachment] });
  } catch (err) {
    console.error("TTS error:", err);
    await interaction.reply({
      content: "❌ Could not generate TTS.",
      ephemeral: true,
    });
  }
};

module.exports = { data, run };

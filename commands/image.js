const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
  ContainerBuilder,
  MessageFlags,
} = require("discord.js");
const { default: axios } = require("axios");

delete require.cache[require.resolve("../functions/imageEffects")];
const effects = require("../functions/imageEffects");

const data = new SlashCommandBuilder()
  .setName("image")
  .setDescription("Fun | Generate an image with effects")
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
      .setName("effect")
      .setDescription("The effect to apply")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addAttachmentOption((option) =>
    option
      .setName("image")
      .setDescription("The image or GIF (static) to use")
      .setRequired(false)
  )
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("The user to use as an image")
      .setRequired(false)
  )
  .addStringOption((option) =>
    option.setName("text").setDescription("Optional text some effects need")
  );

async function run(interaction = ChatInputCommandInteraction.prototype) {
  const MAX_INPUT_BYTES = 8 * 1024 * 1024;

  const effect = interaction.options.getString("effect");
  const attachment = interaction.options.getAttachment("image");
  const user = interaction.options.getUser("user");
  const text = interaction.options.getString("text");

  let targetUrl;
  if (attachment) {
    targetUrl = attachment.url;
  } else if (user) {
    targetUrl = user.displayAvatarURL({
      forceStatic: true,
      extension: "png",
      size: 512,
    });
  } else if (interaction.client.imageCache.has(interaction.user.id)) {
    targetUrl = interaction.client.imageCache.get(interaction.user.id);
    interaction.client.imageCache.delete(interaction.user.id);
  } else {
    return interaction.reply({
      content: '❌ You must specify one between "image" or "user"',
      flags: "Ephemeral",
    });
  }

  if (typeof effects[effect] !== "function") {
    return interaction.reply({
      content: "❌ Unknown effect option",
      flags: "Ephemeral",
    });
  }

  try {
    await interaction.deferReply();

    const response = await axios.get(targetUrl, {
      responseType: "arraybuffer",
    });

    const inputBuffer = Buffer.from(response.data);
    if (inputBuffer.length > MAX_INPUT_BYTES) {
      const sizeMB = (inputBuffer.length / (1024 * 1024)).toFixed(2);

      return interaction.editReply({
        content: `❌ File too large (${sizeMB} MB). Max allowed is 8 MB`,
      });
    }

    const resultBuffer = await effects[effect](inputBuffer, text);

    const outputSizeBytes = resultBuffer.length;
    const outputSizeKB = (outputSizeBytes / 1024).toFixed(1);
    const outputSizeMB = (outputSizeBytes / (1024 * 1024)).toFixed(2);

    const mediaGallery = new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(`attachment://output.png`)
    );

    const textDisplay = new TextDisplayBuilder().setContent(
      `-# ${effect.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()} | ${
        outputSizeMB < 1 ? `${outputSizeKB} KB` : `${outputSizeMB} MB`
      }`
    );

    const container = new ContainerBuilder()
      .addMediaGalleryComponents(mediaGallery)
      .addTextDisplayComponents(textDisplay);

    const file = new AttachmentBuilder(resultBuffer, { name: "output.png" });
    return interaction.editReply({
      components: [container],
      files: [file],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (error) {
    console.error(error);
    const method =
      interaction.deferred || interaction.replied ? "followUp" : "reply";
    return interaction[method]({
      content: "❌ There was an error while processing the image",
      flags: "Ephemeral",
    });
  }
}

module.exports = { data, run };

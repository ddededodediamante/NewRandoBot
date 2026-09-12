const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
  MessageFlags,
  ContainerBuilder,
} = require("discord.js");
const { default: axios } = require("axios");

const { enqueueGifJob, getQueueLength } = require("../../functions/gifQueue");
const effects = require("../../functions/gifEffects");

const data = new SlashCommandBuilder()
  .setName("gif")
  .setDescription("Fun | Generate a GIF with effects")
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
      .setDescription("The image or GIF to use")
      .setRequired(false)
  )
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("The user to use as an image")
      .setRequired(false)
  );

function isLinkGIF(link = "") {
  const parts = link.split("/");
  const lastPart = parts[parts.length - 1];
  const filename = lastPart.split("?")[0];
  return filename.toLowerCase().endsWith(".gif");
}

async function run(interaction = ChatInputCommandInteraction.prototype) {
  const MAX_INPUT_BYTES = 16 * 1024 * 1024;

  const effect = interaction.options.getString("effect");
  const attachment = interaction.options.getAttachment("image");
  const user = interaction.options.getUser("user");

  let targetUrl;
  let isGif = false;

  if (attachment) targetUrl = attachment.url;
  else if (user) targetUrl = user.displayAvatarURL({ size: 512 });
  else if (interaction.client.imageCache.has(interaction.user.id)) {
    targetUrl = interaction.client.imageCache.get(interaction.user.id);
    interaction.client.imageCache.delete(interaction.user.id);
  } else
    return interaction.reply({
      content: '❌ You must specify either "image" or "user"',
      flags: "Ephemeral",
    });

  isGif = isLinkGIF(targetUrl);

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
        content: `❌ File too large (${sizeMB} MB). Max allowed is 16 MB`,
      });
    }

    const queueSize = getQueueLength();

    if (queueSize >= 5) {
      return interaction.editReply({
        content: "❌ The GIF processor is busy, please try again in a moment",
      });
    } else if (queueSize >= 2) {
      await interaction.editReply(
        `⏳ Added to queue, your GIF will be processed soon.`
      );
    }

    const workerResult = await enqueueGifJob({
      buffer: inputBuffer,
      effect,
      isGif,
    });

    if (!workerResult) {
      return interaction.editReply({
        content: "❌ There was an error while processing the GIF",
      });
    }

    if (workerResult.result === "only_gif") {
      return interaction.editReply({
        content: "❌ Only GIF files are supported for this effect",
      });
    }

    const gifBuffer = Buffer.isBuffer(workerResult.result)
      ? workerResult.result
      : Buffer.from(workerResult.result);

    const outputSizeBytes = gifBuffer.length;
    const outputSizeKB = (outputSizeBytes / 1024).toFixed(1);
    const outputSizeMB = (outputSizeBytes / (1024 * 1024)).toFixed(2);

    const fileName = "output.gif";
    const file = new AttachmentBuilder(gifBuffer, { name: fileName });

    const processTime = (Number(workerResult.timeMs ?? 0) / 1000).toFixed(2);

    const mediaGallery = new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(`attachment://${fileName}`)
    );

    const text = new TextDisplayBuilder().setContent(
      `-# ${effect.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()} | ${
        outputSizeMB < 1 ? `${outputSizeKB} KB` : `${outputSizeMB} MB`
      } | took ${processTime}s`
    );

    const container = new ContainerBuilder()
      .addMediaGalleryComponents(mediaGallery)
      .addTextDisplayComponents(text);

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
      content: "❌ There was an error while processing the GIF",
      flags: "Ephemeral",
    });
  }
}

module.exports = { data, run };

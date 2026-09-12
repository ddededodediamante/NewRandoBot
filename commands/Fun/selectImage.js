const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  InteractionContextType,
  ApplicationIntegrationType,
} = require("discord.js");

const data = new ContextMenuCommandBuilder()
  .setName("Select Image")
  .setType(ApplicationCommandType.Message)
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  );

function isImage(str = "") {
  return str.startsWith("image/") || /\.(jpe?g|png|gif|webp)$/i.test(str);
}

function isGIF(str = "") {
  return str === "image/gif" || /\.gif$/i.test(str);
}

const run = async (
  interaction = MessageContextMenuCommandInteraction.prototype
) => {
  const message = interaction.targetMessage;

  let imageUrl = null;
  let isGif = false;

  const attachment = message.attachments.find(
    (a) => isImage(a.contentType ?? "") || isImage(a.name ?? "")
  );

  if (attachment) {
    imageUrl = attachment.url;
    isGif = isGIF(attachment.contentType ?? attachment.name ?? "");
  }

  if (!imageUrl) {
    for (const embed of message.embeds) {
      if (embed.image?.url) {
        imageUrl = embed.image.url;
        isGif = isGIF(imageUrl);
        break;
      }
      if (embed.thumbnail?.url) {
        imageUrl = embed.thumbnail.url;
        isGif = isGIF(imageUrl);
        break;
      }
    }
  }

  if (!imageUrl) {
    const searchComponent = (component) => {
      if (imageUrl || !component) return;

      if (component.type === 11 && component.media?.url) {
        imageUrl = component.media.url;
        isGif = isGIF(imageUrl);
        return;
      }

      if (component.type === 12 && Array.isArray(component.items)) {
        for (const item of component.items) {
          if (item.media?.url) {
            imageUrl = item.media.url;
            isGif = isGIF(imageUrl);
            return;
          }
        }
      }

      if (component.type === 13 && component.media?.url) {
        imageUrl = component.media.url;
        isGif = isGIF(imageUrl);
        return;
      }

      if (Array.isArray(component.components)) {
        for (const c of component.components) {
          searchComponent(c);
          if (imageUrl) return;
        }
      }
    };

    for (const row of message.components) {
      searchComponent(row);
      if (imageUrl) break;
    }
  }

  if (!imageUrl) {
    return interaction.reply({
      content: "❌ No image found in that message",
      flags: "Ephemeral",
    });
  }

  interaction.client.imageCache.set(interaction.user.id, imageUrl);

  await interaction.reply({
    content: `✅ ${
      isGif ? "GIF" : "Image"
    } saved for your next \`/image\` or \`/gif\` call`,
    flags: "Ephemeral",
  });
};

module.exports = { data, run };

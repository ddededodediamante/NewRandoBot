const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  EmbedBuilder,
} = require("discord.js");
const Users = require("../../models/userSchema.js");

const data = new SlashCommandBuilder()
  .setName("job")
  .setDescription(
    "Economy | Work shifts, apply for jobs, and check your status"
  )
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
    sub
      .setName("apply")
      .setDescription("Apply for a job")
      .addStringOption((opt) =>
        opt
          .setName("job")
          .setDescription("The job to apply to")
          .setChoices(
            {
              name: "Programmer",
              value: "programmer",
            },
            {
              name: "Chef",
              value: "chef",
            },
            {
              name: "Doctor",
              value: "doctor",
            },
            {
              name: "Teacher",
              value: "teacher",
            },
            {
              name: "Engineer",
              value: "engineer",
            },
            {
              name: "Artist",
              value: "artist",
            }
          )
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("quit").setDescription("Quit your current job")
  )
  .addSubcommand((sub) =>
    sub.setName("work").setDescription("Work a shift in your job")
  )
  .addSubcommand((sub) =>
    sub
      .setName("status")
      .setDescription("Check your or another user's job status")
      .addUserOption((option) =>
        option
          .setName("target")
          .setDescription("User's job status to check")
          .setRequired(false)
      )
  );

const emojis = {
  programmer: ["💻", "👨‍💻", "🖥️", "⌨️", "🤖", "🧑‍💻", "📟", "💾", "🛰️", "📡"],
  chef: ["👨‍🍳", "🍳", "🍲", "🥘", "🍴", "🧑‍🍳", "🥄", "🍤", "🥗", "🫕"],
  doctor: ["🩺", "💊", "🏥", "🧑‍⚕️", "🩹", "🧬", "🩻", "🧪", "⚕️", "💉"],
  teacher: ["📚", "📝", "👩‍🏫", "📖", "✏️", "🧑‍🏫", "📐", "🖍️", "🎓", "🗂️"],
  engineer: ["⚙️", "🛠️", "📐", "🔧", "🏗️", "🧰", "🪛", "🧱", "🖇️", "📊"],
  artist: ["🎨", "🖌️", "🖼️", "✏️", "🧑‍🎨", "🖍️", "🎭", "🩰", "🎶", "📸"],
};

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  let user = await Users.findOne({ id: interaction.user.id });
  if (!user) {
    user = await Users.create({ id: interaction.user.id });
  }

  const subcommand = interaction.options.getSubcommand();
  const rud = interaction.client.getEmoji("rud");

  if (subcommand === "apply") {
    const job = interaction.options.getString("job");

    if (user.economy.job.type)
      return interaction.reply({
        content: `❌ You need to quit your current job to apply for a new one`,
        flags: "Ephemeral",
      });

    user.economy.job.type = job;
    await user.save();
    return interaction.reply(
      `You applied for the **${job}** job! Use the **/job work** command to start working.`
    );
  } else if (subcommand === "quit") {
    if (!user.economy.job.type)
      return interaction.reply({
        content: `❌ You don't have a job currently`,
        flags: "Ephemeral",
      });

    let oldJob = user.economy.job.type;

    user.economy.job.type = undefined;
    await user.save();
    return interaction.reply(
      `You quit your **${oldJob}** job! Use the **/job apply** command to apply for a new job.`
    );
  } else if (subcommand === "work") {
    const job = user.economy.job.type;
    if (!job)
      return interaction.reply({
        content: `❌ You need to apply for a job before working`,
        flags: "Ephemeral",
      });

    if (user.economy.job.lastWorked) {
      const nextWorkTime = new Date(
        user.economy.job.lastWorked.getTime() + 25 * 60 * 1000
      );
      if (new Date() < nextWorkTime) {
        const unix = Math.floor(nextWorkTime.getTime() / 1000);
        return interaction.reply({
          content: `❌ You're tired! Try again <t:${unix}:R>.`,
          flags: "Ephemeral",
        });
      }
    }

    const pool = emojis[job];
    const sequence = pool.sort(() => 0.5 - Math.random()).slice(0, 4);

    const memorizeContainer = new ContainerBuilder()
      .addTextDisplayComponents((text) =>
        text.setContent(
          `**🧠 Memorize this sequence to complete your shift! You have 5 seconds.**`
        )
      )
      .addTextDisplayComponents((text) =>
        text.setContent("# " + sequence.join(" "))
      );
    await interaction.reply({
      components: [memorizeContainer],
      flags: "IsComponentsV2",
    });

    await new Promise((r) => setTimeout(r, 5000));

    const shuffled = [...sequence].sort(() => Math.random() - 0.5);
    const buttonContainer = new ContainerBuilder()
      .addTextDisplayComponents((text) =>
        text.setContent(
          "**🧨 Now click the emojis in the correct order! You have 15 seconds.**"
        )
      )
      .addActionRowComponents((row) =>
        row.setComponents(
          shuffled.map((emoji) =>
            new ButtonBuilder()
              .setCustomId(`memory_${emoji}_${interaction.user.id}`)
              .setEmoji(emoji)
              .setStyle(ButtonStyle.Secondary)
          )
        )
      );

    const msg = await interaction.editReply({
      components: [buttonContainer],
    });

    let attempt = [];
    const collector = msg.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 15000,
      max: sequence.length,
    });

    collector.on("collect", async (i) => {
      attempt.push(i.customId.split("_")[1]);

      buttonContainer.components[1].components =
        buttonContainer.components[1].components.map((btn) =>
          btn?.data?.custom_id === i.customId
            ? ButtonBuilder.from(btn).setDisabled(true)
            : btn
        );

      await i.update({ components: [buttonContainer] });

      if (attempt.length === sequence.length) collector.stop();
    });

    collector.on("end", async (_) => {
      user.economy.job.lastWorked = new Date();

      const rudsEarn = 10 + user.economy.job.level * 5;
      const expEarn = Math.floor(Math.random() * 9) + 11;

      buttonContainer.components[1].components =
        buttonContainer.components[1].components.map((btn) =>
          ButtonBuilder.from(btn).setDisabled(true)
        );

      interaction.editReply({ components: [buttonContainer] });

      if (attempt.join() === sequence.join()) {
        user.economy.ruds += rudsEarn;
        user.economy.job.experience += expEarn;

        let leveledUp = false;

        while (user.economy.job.experience >= user.economy.job.nextLevelXP) {
          user.economy.job.experience -= user.economy.job.nextLevelXP;
          user.economy.job.level += 1;
          user.economy.job.nextLevelXP += 50;
          leveledUp = true;
        }

        let message = `✅ Correct! You earned **${rudsEarn}** ${rud} and **${expEarn}** work experience this shift.`;
        if (leveledUp) message += `\n🎉 You leveled up! You are now level **${user.economy.job.level}**.`;

        await interaction.followUp({
          content: message,
        });
        await user.save();
      } else {
        user.economy.ruds += Math.floor(rudsEarn / 2);

        await interaction.followUp({
          content: `❌ ${attempt.length === sequence.length ? "Wrong order!" : "Times up!"
            } You only earned **${Math.floor(rudsEarn / 2)}** ${rud} this shift.`,
        });
        await user.save();

      }
    });
  } else if (subcommand === "status") {
    const targetUser =
      interaction.options.getUser("target") || interaction.user;

    let targetUserAccount = await Users.findOne({ id: targetUser.id });
    if (!targetUserAccount) {
      targetUserAccount = await Users.create({ id: targetUser.id });
    }

    const job = targetUserAccount.economy.job;

    const info = [
      `**Job:** ${job.type || "None"}`,
      `**Level:** ${job.level || 0}`,
      `**Experience:** ${job.experience || 0} / ${job.nextLevelXP || 0}`,
      `**Last Worked:** ${job.lastWorked
        ? `<t:${Math.floor(job.lastWorked.getTime() / 1000)}:R>`
        : "Never"
      }`,
    ];

    const jobEmbed = new EmbedBuilder()
      .setTitle(`${targetUser.username}'s Job`)
      .setDescription(info.join("\n"))
      .setThumbnail(targetUser.displayAvatarURL({ size: 512 }));

    await interaction.reply({
      embeds: [jobEmbed]
    });
  }
};

module.exports = { data, run };

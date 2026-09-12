const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
} = require("discord.js");

const effects = {
  uwuify: (text) => {
    const faces = [":3", ">w<", "uwu", "owo", "^w^", ">:3"];
    const wordMap = {
      hello: "hewwo",
      hi: "hai",
      hey: "haii",
      you: "uu",
      love: "wuv",
      friend: "fwiend",
    };

    let uwuText = text
      .replace(/(?:r|l)/g, "w")
      .replace(/(?:R|L)/g, "W")
      .replace(/n([aeiou])/g, "ny$1")
      .replace(/N([aeiou])/g, "Ny$1")
      .replace(/ove/g, "uv");

    uwuText = uwuText
      .split(" ")
      .map((word) => {
        const lower = word.toLowerCase();
        if (wordMap[lower]) {
          return word[0] === word[0].toUpperCase()
            ? wordMap[lower][0].toUpperCase() + wordMap[lower].slice(1)
            : wordMap[lower];
        }
        return word;
      })
      .join(" ");

    uwuText += " " + faces[Math.floor(Math.random() * faces.length)];

    return uwuText;
  },
  stroke: (text) => {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    return text
      .split(" ")
      .map((word) => {
        if (Math.random() < 0.3) {
          let arr = word.split("");
          let i = Math.floor(Math.random() * arr.length);
          let j = Math.floor(Math.random() * arr.length);
          [arr[i], arr[j]] = [arr[j], arr[i]];
          word = arr.join("");
        }
        if (Math.random() < 0.3) {
          const insert = letters[Math.floor(Math.random() * letters.length)];
          const pos = Math.floor(Math.random() * word.length);
          word = word.slice(0, pos) + insert + word.slice(pos);
        }
        if (Math.random() < 0.2) {
          const pos = Math.floor(Math.random() * word.length);
          word = word.slice(0, pos) + word.slice(pos + 1);
        }
        return word;
      })
      .join(" ");
  },
  shuffle: (text) => {
    const array = text.split("");
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array.join("");
  },
  reverse: (text) => {
    return text.split("").reverse().join("");
  },
  vaporwave: (text) => {
    return text
      .split("")
      .map((c) =>
        c === " " ? "　" : String.fromCharCode(c.charCodeAt(0) + 0xfee0)
      )
      .join("");
  },
  mock: (text) => {
    return text
      .split("")
      .map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()))
      .join("");
  },
  alternate: (text) => {
    return text
      .split(" ")
      .map((word, i) => (i % 2 === 0 ? word.toUpperCase() : word.toLowerCase()))
      .join(" ");
  },
  evil: (text) => {
    const dictionary = {
      love: "hate",
      friend: "enemy",
      friends: "enemies",
      good: "bad",
      kind: "cruel",
      happy: "miserable",
      happiness: "sadness",
      joy: "suffering",
      joyfully: "painfully",
      smile: "scowl",
      light: "darkness",
      angel: "demon",
      angels: "demons",
      hope: "despair",
      life: "death",
      live: "explode",
      heal: "curse",
      healing: "poisoning",
      peace: "chaos",
      trust: "betrayal",
      pure: "corrupt",
      purity: "corruption",
      safe: "doomed",
      friendlier: "hostile",
      protect: "destroy",
      protection: "doom",
      heaven: "hell",
      hero: "villain",
      heroes: "villains",
      save: "doom",
      saved: "cursed",
      harmony: "discord",
      truth: "lies",
      kindhearted: "malevolent",
      earn: "kill",
      mercy: "wrath",
      bless: "curse",
      blessing: "hex",
      blu: "poo",
      yummy: "disgusting",
      fair: "unfair",
      hello: "bye",
      goodbye: "badbye",
      name: "poopy name",
      calm: "chaotic",
      bright: "dark",
      shine: "hide",
      together: "separately",
      ok: "okn't",
      easy: "hard",
      cool: "stupid",
      positivity: "negativity",
      fun: "torment",
      laughter: "screams",
      joyfulness: "misery",
      beauty: "ugliness",
      beautiful: "monstrous",
      cute: "creepy",
      smiley: "grim",
      grow: "kill",
      happyface: "angryface",
      angelic: "demonic",
      hopefulness: "hopelessness",
      loving: "hating",
      playful: "sinister",
      friendly: "malicious",
      generous: "greedy",
      gentle: "brutal",
      peaceful: "violent",
      brave: "cowardly",
      heroic: "villainous",
      clever: "stupid",
      wisdom: "foolishness",
      braveheart: "darkheart",
      freedom: "oppression",
      trustful: "suspicious",
      optimism: "nihilism",
      dream: "nightmare",
      laugh: "scream",
      glow: "smolder",
      shinebright: "fadeaway",
      "🌞": "🌑",
      "🌈": "🌪️",
      "🍎": "💀",
      "🍰": "💩",
      "🌸": "☠️",
      "❤️": "🖤",
      "💖": "💔",
      "🐶": "🐍",
      "🐱": "🦇",
      "🎉": "🔥",
      "🥰": "😈",
      "😇": "👹",
      "🎈": "💣",
      "🎶": "💀",
      "🌟": "⚡",
      "✨": "☠️",
      "😄": "😡",
      "😃": "😈",
      "😺": "😾",
      "😻": "😼",
      "💌": "💀",
      "🍀": "☠️",
      "🙏": "🩸",
      "🌹": "🌵",
      "🕊️": "🦂",
      "💎": "🪨",
      "🌷": "🌪️",
      "🍓": "🦠",
      "🌺": "☢️",
      "🎂": "🩸",
      "🐰": "🐲",
      "🦄": "🐉",
      "😊": "😠",
      "😍": "😈",
      "😎": "🤡",
      "🤝": "💀",
      "✌️": "🪓",
      "💐": "🗡️",
      "🛡️": "☠️",
      "🔔": "💥",
      "🌍": "🔥",
      "🌱": "☠️",
      "🌿": "🪓",
      "🍁": "💨",
      "🥂": "🩸",
      "🍹": "☠️",
      "💌": "💣",
    };

    let result = text;
    for (const [good, evil] of Object.entries(dictionary)) {
      const regex = new RegExp(good, "gi");
      result = result.replace(regex, (match) => evil.toUpperCase());
    }
    return result + "...";
  },
};

const data = new SlashCommandBuilder()
  .setName("text")
  .setDescription("Fun | Apply effects to text")
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
      .setName("uwuify")
      .setDescription("Make your text cutesy uwu style")
      .addStringOption((opt) =>
        opt.setName("input").setDescription("Text to uwuify").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("stroke")
      .setDescription(
        "Mess up the text like someone having a stroke while typing"
      )
      .addStringOption((opt) =>
        opt.setName("input").setDescription("Text to mess up").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("shuffle")
      .setDescription("Randomly shuffle all characters")
      .addStringOption((opt) =>
        opt.setName("input").setDescription("Text to shuffle").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("reverse")
      .setDescription("Reverse the text")
      .addStringOption((opt) =>
        opt.setName("input").setDescription("Text to reverse").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("vaporwave")
      .setDescription("ＡＥＳＴＨＥＴＩＣ fullwidth text")
      .addStringOption((opt) =>
        opt
          .setName("input")
          .setDescription("Text to aesthetic-ify")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("mock")
      .setDescription("RanDoM cAsE")
      .addStringOption((opt) =>
        opt.setName("input").setDescription("Text to mock").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("alternate")
      .setDescription("Alternate words between UPPERCASE and lowercase")
      .addStringOption((opt) =>
        opt
          .setName("input")
          .setDescription("Text to alternate")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("evil")
      .setDescription("I'm so EVIL...")
      .addStringOption((opt) =>
        opt.setName("input").setDescription("Text to corrupt").setRequired(true)
      )
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const subcommand = interaction.options.getSubcommand();
  const input = interaction.options.getString("input");

  if (input.length > 2000) return interaction.reply("too big for me");

  if (typeof effects[subcommand] === "function") {
    let output = effects[subcommand](input);
    if (output.length > 1000) output = '-# ' + output;
    output = output.slice(0, 2000);
    return await interaction.reply({
      content: output,
      allowedMentions: { parse: [] },
    });
  } else {
    return interaction.reply({
      content: "❌ Unknown text effect",
      flags: "Ephemeral",
    });
  }
};

module.exports = { data, run };

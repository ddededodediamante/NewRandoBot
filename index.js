const isTest = process.argv.includes("--test");
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  Events,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const client = new Client({
  intents: Object.values(GatewayIntentBits),
});

client.imageCache = new Map();
client.commands = new Collection();

function reload(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadCommands() {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((f) => f.endsWith(".js"));

  for (const file of commandFiles) {
    const fullPath = path.join(commandsPath, file);
    try {
      const cmd = reload(fullPath);
      if (cmd.data?.name && typeof cmd.run === "function") {
        client.commands.set(cmd.data.name, cmd);
      } else {
        console.warn(`Skipping ${file}: missing data.name or run()`);
      }
    } catch (err) {
      console.error(`Error loading ${file}:`, err);
    }
  }
}
client.loadCommands = loadCommands;

async function registerSlashCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(
      isTest ? process.env.test_token : process.env.token
    );
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: client.commands.map((c) => c.data.toJSON()),
    });
    console.log(`✅ Registered ${client.commands.size} commands`);
  } catch (err) {
    console.error("❌ Command registration failed:", err);
  }
}
client.registerSlashCommands = registerSlashCommands;

client.getEmoji = (emojiName) => {
  let appEmojis = client.application.emojis;
  return appEmojis.cache.find((emoji) => emoji.name === emojiName) || "❓";
};

client.once(Events.ClientReady, async () => {
  console.log("✅ Client ready");

  try {
    const reloadEvents = reload("./functions/events.js");
    reloadEvents(client);
    console.log("✅ Events loaded");
  } catch (err) {
    console.error("❌ Failed to load events.js:", err);
  }

  await registerSlashCommands();

  await client.application.emojis.fetch();

  require("./functions/tempBanChecker")(client);
});

client
  .login(isTest ? process.env.test_token : process.env.token)
  .then(() => {
    loadCommands();
  })
  .catch(console.error);

const { connect } = require("mongoose");

connect(process.env.mongo_uri).then(() =>
  console.log("✅ Connected to the database")
);

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

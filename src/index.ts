import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} from "discord.js";
import { loadConfig } from "./config";
import { commands, getCommandMap } from "./commands";
import { closeDb, getDb } from "./db/connection";
import { initSchema } from "./db/queries";

async function registerCommands(config: ReturnType<typeof loadConfig>): Promise<void> {
  const rest = new REST().setToken(config.discordToken);
  const body = commands.map((c) => c.data.toJSON());

  if (config.guildId) {
    await rest.put(
      Routes.applicationGuildCommands(config.discordClientId, config.guildId),
      { body }
    );
    console.log(`Registered ${body.length} guild commands for ${config.guildId}`);
  } else {
    await rest.put(Routes.applicationCommands(config.discordClientId), { body });
    console.log(`Registered ${body.length} global commands`);
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const db = getDb(config.databasePath);
  initSchema(db);

  await registerCommands(config);

  const commandMap = getCommandMap();
  const ctx = { db, config };

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, (c) => {
    console.log(`Logged in as ${c.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = commandMap.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction, ctx);
        return;
      }

      if (interaction.isAutocomplete()) {
        const command = commandMap.get(interaction.commandName);
        if (command?.autocomplete) {
          await command.autocomplete(interaction, ctx);
        }
        return;
      }

      if (interaction.isModalSubmit()) {
        for (const command of commands) {
          if (command.handleModal) {
            const handled = await command.handleModal(interaction, ctx);
            if (handled) return;
          }
        }
        return;
      }

      if (interaction.isStringSelectMenu()) {
        for (const command of commands) {
          if (command.handleSelect) {
            const handled = await command.handleSelect(interaction, ctx);
            if (handled) return;
          }
        }
        return;
      }

      if (interaction.isButton()) {
        for (const command of commands) {
          if (command.handleButton) {
            const handled = await command.handleButton(interaction, ctx);
            if (handled) return;
          }
        }
      }
    } catch (err) {
      console.error("Interaction error:", err);
      const message = "Something went wrong processing that request.";
      if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: message, ephemeral: true });
        } else {
          await interaction.reply({ content: message, ephemeral: true });
        }
      }
    }
  });

  const shutdown = () => {
    console.log("Shutting down...");
    closeDb();
    client.destroy();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await client.login(config.discordToken);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

import { REST, Routes } from "discord.js";
import { loadConfig } from "./config";
import { commands } from "./commands";

async function main(): Promise<void> {
  const config = loadConfig();
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

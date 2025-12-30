import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { commands } from '../commands';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment');
  process.exit(1);
}

const rest = new REST().setToken(token);

async function deployCommands() {
  try {
    const commandsWithData = commands.filter((cmd) => cmd.data);
    console.log(
      `Started refreshing ${commandsWithData.length} application (/) commands.`
    );

    const commandsData = commandsWithData.map((cmd) => cmd.data!.toJSON());

    const data = await rest.put(Routes.applicationCommands(clientId!), {
      body: commandsData,
    });

    console.log(
      `Successfully reloaded ${(data as unknown[]).length} application (/) commands.`
    );
  } catch (error) {
    console.error('Failed to deploy commands:', error);
    process.exit(1);
  }
}

deployCommands();

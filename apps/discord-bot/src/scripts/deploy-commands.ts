import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { getCommandsData } from '../app';

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
    const commands = getCommandsData();
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    const commandsData = commands.map((cmd) => cmd.toJSON());

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

import type { CommandHandler } from '../types/bot.types';
import { pingCommand } from './ping.command';

/**
 * All available commands
 */
export const commands: CommandHandler[] = [pingCommand];

/**
 * Get a command by name
 */
export function getCommand(name: string): CommandHandler | undefined {
  return commands.find((cmd) => cmd.name === name);
}

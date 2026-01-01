import type { Client, Interaction, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import type { ILogger } from '../../shared/types';
import type { ConfigurationRepository } from '../../shared/repositories/configuration.repository';
import type { VikunjaApiService } from '../../shared/services/vikunja-api.service';

export interface BotServices {
  logger: ILogger;
  configRepository: ConfigurationRepository;
  vikunjaApiService: VikunjaApiService;
}

export interface CommandHandler {
  name: string;
  description: string;
  data?: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: Interaction, services: BotServices) => Promise<void>;
}

export interface BotEventHandler {
  name: string;
  once?: boolean;
  execute: (...args: unknown[]) => Promise<void> | void;
}

export interface DiscordClientDeps {
  logger: ILogger;
  configRepository: ConfigurationRepository;
  vikunjaApiService: VikunjaApiService;
}

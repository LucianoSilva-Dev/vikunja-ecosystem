import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';

/**
 * Handles the /projects add subcommand
 * TODO: Implement with select menu for project selection
 */
export async function handleAddProject(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle('➕ Adicionar Projeto')
    .setDescription(
      'Selecione um projeto Vikunja para adicionar às suas notificações.'
    )
    .setColor(0x00ae86)
    .addFields({
      name: '⚠️ Em desenvolvimento',
      value:
        'Use `/setup dm` para adicionar projetos por enquanto.',
    });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

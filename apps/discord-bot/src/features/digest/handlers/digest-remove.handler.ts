import { 
    ChatInputCommandInteraction, 
    ActionRowBuilder, 
    ButtonBuilder,
    ButtonStyle,
    ButtonInteraction,
    EmbedBuilder,
    ComponentType
  } from 'discord.js';
  import type { ILogger } from '../../../shared/types';
  import type { DigestService } from '../services/digest.service';
  import type { VikunjaApiService } from '../../../shared/services/vikunja-api.service';
  import { buildDigestListEmbed, getProjectMap } from '../utils/digest-utils';
  
  export const DIGEST_REMOVE_IDS = {
      TOGGLE_PREFIX: 'digest_rm_toggle_',
      CONFIRM: 'digest_rm_confirm',
      CANCEL: 'digest_rm_cancel'
  };

  interface DigestRemoveDeps {
    logger: ILogger;
    digestService: DigestService;
    vikunjaApiService: VikunjaApiService;
  }
  
  export async function handleDigestRemove(
    interaction: ChatInputCommandInteraction,
    deps: DigestRemoveDeps
  ): Promise<void> {
    const { logger, digestService, vikunjaApiService } = deps;
    const discordUserId = interaction.user.id;
    const guildId = interaction.guildId;
  
    logger.info('Initiating digest removal', { userId: discordUserId, guildId });
    await interaction.deferReply({ ephemeral: true });
  
    try {
      const allDigests = await digestService.getUserDigests(discordUserId);
      const digests = allDigests.filter(d => {
        if (guildId) {
            return d.targetType === 'guild' && d.guildId === guildId;
        } else {
            return d.targetType === 'dm';
        }
      });
      
      if (!digests || digests.length === 0) {
          await interaction.editReply({ content: '📭 Nenhum resumo configurado para remover neste contexto.' });
          return;
      }
  
      // Fetch all projects
      const projectMap = await getProjectMap(vikunjaApiService, logger);
  
      const embed = buildDigestListEmbed({
          digests,
          projectMap,
          context: guildId ? 'guild' : 'dm'
      });

      // Add instruction
      embed.addFields({ 
          name: '🗑️ Remoção', 
          value: 'Clique nos números abaixo para selecionar os resumos que deseja remover. Depois clique em confirmar.' 
      });

      // Create Buttons
      // Map digest ID to index (1-based)
      // We will store the digest ID in the custom ID: digest_rm_toggle_{id}
      
      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      let currentRow = new ActionRowBuilder<ButtonBuilder>();
      
      digests.forEach((d, index) => {
          const btn = new ButtonBuilder()
              .setCustomId(`${DIGEST_REMOVE_IDS.TOGGLE_PREFIX}${d.id}`)
              .setLabel((index + 1).toString())
              .setStyle(ButtonStyle.Secondary);
          
          currentRow.addComponents(btn);
          
          if (currentRow.components.length === 5) {
              rows.push(currentRow);
              currentRow = new ActionRowBuilder<ButtonBuilder>();
          }
      });
      
      if (currentRow.components.length > 0) {
          rows.push(currentRow);
      }

      // Limit rows to 4 to leave space for Confirm/Cancel (Discord limit 5 rows)
      if (rows.length > 4) {
          // TODO: Add pagination if needed, for now just slice
          rows.length = 4; 
      }

      const controlRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
              new ButtonBuilder()
                  .setCustomId(DIGEST_REMOVE_IDS.CANCEL)
                  .setLabel('Cancelar')
                  .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                  .setCustomId(DIGEST_REMOVE_IDS.CONFIRM)
                  .setLabel('Confirmar Remoção')
                  .setStyle(ButtonStyle.Danger)
          );
      
      rows.push(controlRow);
      
      await interaction.editReply({
          embeds: [embed],
          components: rows
      });
  
    } catch (error) {
      logger.error('Failed to list digests for removal', { error });
      await interaction.editReply({ content: '❌ Erro ao processar remoção.' });
    }
  }

  export async function handleDigestRemoveInteraction(
    interaction: ButtonInteraction,
    deps: DigestRemoveDeps
  ): Promise<void> {
      const { logger, digestService } = deps;
      const customId = interaction.customId;

      if (customId === DIGEST_REMOVE_IDS.CANCEL) {
          await interaction.update({ content: '❌ Operação cancelada.', embeds: [], components: [] });
          return;
      }

      if (customId.startsWith(DIGEST_REMOVE_IDS.TOGGLE_PREFIX)) {
          // Toggle button style
          const currentStyle = interaction.component.style;
          const newStyle = currentStyle === ButtonStyle.Secondary ? ButtonStyle.Success : ButtonStyle.Secondary;
          
          const newButton = ButtonBuilder.from(interaction.component as any);
          newButton.setStyle(newStyle);
          
          // Reconstruct rows
          // Cast explicitly to ActionRow<MessageActionRowComponent>[] to allow .components access
          const startRows = (interaction.message.components as unknown) as { components: any[] }[];

          const rows = startRows.map(row => {
             const newRow = new ActionRowBuilder<ButtonBuilder>();
             row.components.forEach((c: any) => {
                 if (c.customId === customId) {
                     newRow.addComponents(newButton);
                 } else {
                     if (c.type === ComponentType.Button) {
                        // Cast to any to assume compatibility with ButtonBuilder.from for existing components
                        newRow.addComponents(ButtonBuilder.from(c as any));
                     }
                 }
             });
             return newRow;
          });
          
          await interaction.update({ components: rows });
          return;
      }

      if (customId === DIGEST_REMOVE_IDS.CONFIRM) {
          // Find all Success buttons
          const idsToRemove: number[] = [];
          
          const messageRows = (interaction.message.components as unknown) as { components: any[] }[];
          
          messageRows.forEach(row => {
              row.components.forEach((c: any) => {
                  if (c.type === ComponentType.Button && 
                      c.style === ButtonStyle.Success && 
                      c.customId?.startsWith(DIGEST_REMOVE_IDS.TOGGLE_PREFIX)) {
                      
                      const id = parseInt(c.customId.replace(DIGEST_REMOVE_IDS.TOGGLE_PREFIX, ''));
                      if (!isNaN(id)) idsToRemove.push(id);
                  }
              });
          });

          if (idsToRemove.length === 0) {
              await interaction.reply({ content: '⚠️ Nenhum resumo selecionado.', ephemeral: true });
              return;
          }

          await interaction.deferUpdate();

          try {
              let deletedCount = 0;
              for (const id of idsToRemove) {
                  const success = await digestService.deleteDigest(id, interaction.user.id);
                  if (success) deletedCount++;
              }

              await interaction.editReply({
                  content: `✅ ${deletedCount} resumos removidos com sucesso.`,
                  embeds: [],
                  components: []
              });
          } catch (error) {
              logger.error('Failed to delete digests', { error });
              await interaction.editReply({
                  content: '❌ Erro ao remover resumos.',
                  embeds: [],
                  components: []
              });
          }
      }
  }


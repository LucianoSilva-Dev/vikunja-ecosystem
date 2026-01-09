import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ActionRow,
  MessageActionRowComponent,
  ButtonComponent,
} from 'discord.js';
import type { ProjectsService } from '../services/projects.service';
import type { ILogger } from '../../../shared/types';

export interface AddProjectHandlerDeps {
  logger: ILogger;
  projectsService: ProjectsService;
}

/**
 * Custom IDs for the add project flow
 */
export const ADD_PROJECT_CUSTOM_IDS = {
  PROJECT_SELECT: 'projects_add_project_select',
  CHANNEL_SELECT: 'projects_add_channel_select',
  // New Button IDs
  EVENT_BTN_PREFIX: 'ev_btn', // ev_btn:projectId:targetId:eventName
  EVENT_ALL: 'ev_all',        // ev_all:projectId:targetId
  EVENT_CONFIRM: 'ev_ok',     // ev_ok:projectId:targetId
} as const;

// Emoji Configuration
const EMOJIS = {
    ACTIONS: {
        created: '✨',
        updated: '📝',
        deleted: '🗑️',
        restored: '♻️',
    } as Record<string, string>,
    ENTITIES: {
        task: '📋',
        project: '🚀',
        comment: '💬',
        attachment: '🖼️',
        label: '🏷️',
        subtask: '🧩',
        user: '👤',
    } as Record<string, string>,
    DEFAULT: '🔔',
};

function getEventEmoji(eventName: string): string {
    const parts = eventName.split('.');
    
    // Pattern: entity.action or entity.subentity.action
    // e.g. task.created, task.comment.created
    
    let entityEmoji = EMOJIS.DEFAULT;
    let actionEmoji = '';

    // Find Action (usually last part)
    const action = parts[parts.length - 1];
    if (EMOJIS.ACTIONS[action]) {
        actionEmoji = EMOJIS.ACTIONS[action];
    }

    // Find Entity (first part, or check specific sub-entities)
    // If it's task.comment, we want "Comment" emoji, not Task
    if (parts.includes('comment')) entityEmoji = EMOJIS.ENTITIES.comment;
    else if (parts.includes('attachment')) entityEmoji = EMOJIS.ENTITIES.attachment;
    else if (parts.includes('label')) entityEmoji = EMOJIS.ENTITIES.label;
    else if (parts.includes('subtask')) entityEmoji = EMOJIS.ENTITIES.subtask;
    else if (parts[0] in EMOJIS.ENTITIES) entityEmoji = EMOJIS.ENTITIES[parts[0]];
    
    return actionEmoji ? `${entityEmoji}${actionEmoji}` : entityEmoji;
}

/**
 * Handles the /projects add subcommand
 */
export async function handleAddProject(
  interaction: ChatInputCommandInteraction,
  deps: AddProjectHandlerDeps
): Promise<void> {
  const { projectsService, logger } = deps;
  const isInGuild = !!interaction.guildId;

  await interaction.deferReply({ ephemeral: true });

  // Get available projects from Vikunja
  const result = await projectsService.getAvailableProjects();

  if (!result.success) {
    await interaction.editReply({
      content: `❌ ${result.error}`,
    });
    return;
  }

  const projects = result.data!;

  if (projects.length === 0) {
    await interaction.editReply({
      content:
        '❌ Nenhum projeto encontrado no Vikunja. Crie um projeto primeiro.',
    });
    return;
  }

  // Limit to 25 projects for Discord Select Menu limit
  const options = projects.slice(0, 25).map((project) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(project.title || `Project ${project.id}`)
      .setDescription(
        project.description
          ? project.description.substring(0, 50)
          : `Project ID: ${project.id}`
      )
      .setValue(String(project.id))
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId(ADD_PROJECT_CUSTOM_IDS.PROJECT_SELECT)
    .setPlaceholder('Selecione um projeto')
    .addOptions(options)
    .setMaxValues(1) // Enforce single selection
    .setMinValues(1);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    select
  );

  if (isInGuild) {
    const embed = new EmbedBuilder()
      .setTitle('➕ Adicionar Projeto')
      .setDescription(
        'Selecione o projeto Vikunja que deseja adicionar. Depois você poderá escolher o canal e eventos.'
      )
      .setColor(0x00ae86);

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    logger.debug('Add project menu displayed', { 
      guildId: interaction.guildId,
    });
  } else {
    const embed = new EmbedBuilder()
      .setTitle('➕ Adicionar Projeto')
      .setDescription(
        'Selecione o projeto Vikunja que deseja adicionar.'
      )
      .setColor(0x00ae86);

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    logger.debug('Add project menu displayed (DM)', { userId: interaction.user.id });
  }
}

/**
 * Handles the project select menu interaction for add flow
 */
export async function handleAddProjectSelect(
  interaction: import('discord.js').StringSelectMenuInteraction,
  deps: AddProjectHandlerDeps
): Promise<void> {
  const { logger } = deps;
  const selectedIds = interaction.values;
  const isInGuild = !!interaction.guildId;

  await interaction.deferUpdate();

  // We enforced single selection
  const projectId = parseInt(selectedIds[0], 10);

  if (isInGuild) {
    // Always show channel select for guild
    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId(`${ADD_PROJECT_CUSTOM_IDS.CHANNEL_SELECT}:${projectId}`)
      .setPlaceholder('Selecione o canal')
      .setChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      channelSelect
    );

    const embed = new EmbedBuilder()
      .setTitle('➕ Selecione o Canal')
      .setDescription(`Agora selecione o canal onde deseja vincular o projeto.`)
      .setColor(0x00ae86);

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    logger.debug('Channel select menu displayed', {
      guildId: interaction.guildId,
      projectId,
    });
  } else {
    // DM flow - proceed to event selection
    // Pass 'dm' as channel indicator
    await showEventSelection(interaction, projectId, 'dm', deps);
  }
}

/**
 * Handles the channel select menu interaction for add flow
 */
export async function handleAddChannelSelect(
  interaction: import('discord.js').ChannelSelectMenuInteraction,
  deps: AddProjectHandlerDeps
): Promise<void> {
  const { logger } = deps;
  
  await interaction.deferUpdate();

  const [, projectIdStr] = interaction.customId.split(':');
  const projectId = parseInt(projectIdStr, 10);
  const channelId = interaction.values[0];

  // Logic moved: Go to event selection instead of Adding directly
  // Pass channelId
  await showEventSelection(interaction, projectId, channelId, deps);
}

/**
 * Helper to show event selection menu with Buttons
 */
async function showEventSelection(
  interaction: import('discord.js').BaseInteraction,
  projectId: number,
  targetId: string, // 'dm' or channelId
  deps: AddProjectHandlerDeps
) {
  const { projectsService, logger } = deps;

  // We use the same service, but now we get events to build buttons
  const result = await projectsService.getProjectEvents(projectId);

  let availableEvents: string[] = [];
  if (result.success && result.data) {
    availableEvents = result.data.sort(); // Sort roughly alphabetically or by logic
  } else {
    logger.warn('Could not fetch events or empty list', { projectId, error: result.error });
  }

  if (availableEvents.length === 0) {
      // If fails, show error reply on the interaction
      if (interaction.isRepliable()) {
         await interaction.editReply({
             content: `⚠️ Não foi possível carregar os eventos disponíveis para este projeto.`,
             components: [],
             embeds: []
         });
      }
      return;
  }

  // Build Grid of Buttons
  // 5x5 max = 25 buttons.
  // One button is needed for "Confirm", One for "Select All".
  // So we have 23 slots for events. Vikunja has ~15-20. Should fit.
  
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();
  
  // Create Event Buttons
  availableEvents.forEach((eventName, index) => {
      if (currentRow.components.length >= 5) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder<ButtonBuilder>();
      }
      
      const btnLabel = String(index + 1);
      const btn = new ButtonBuilder()
          .setCustomId(`${ADD_PROJECT_CUSTOM_IDS.EVENT_BTN_PREFIX}:${projectId}:${targetId}:${eventName}`)
          .setLabel(btnLabel)
          .setStyle(ButtonStyle.Secondary); // Default unselected
      
      currentRow.addComponents(btn);
  });
  
  // Push the last row of events if not empty
  if (currentRow.components.length > 0) {
      if (currentRow.components.length >= 5) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder<ButtonBuilder>();
      } else {
         // Keep adding to it
      }
  }

  // Add Control Buttons (Select All, Confirm)
  // We want them on a separate row if possible, or at the end.
  // To be safe and clean, let's put them on the LAST row.
  
  // If the last row is full (5 items), we need a new row.
  if (currentRow.components.length >= 4) { // Need 2 slots
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
  }

  const selectAllBtn = new ButtonBuilder()
      .setCustomId(`${ADD_PROJECT_CUSTOM_IDS.EVENT_ALL}:${projectId}:${targetId}`)
      .setLabel('Selecionar Todos')
      .setStyle(ButtonStyle.Primary);

  const confirmBtn = new ButtonBuilder()
      .setCustomId(`${ADD_PROJECT_CUSTOM_IDS.EVENT_CONFIRM}:${projectId}:${targetId}`)
      .setLabel('Confirmar')
      .setStyle(ButtonStyle.Success);

  currentRow.addComponents(selectAllBtn, confirmBtn);
  rows.push(currentRow);

  // Build Legend
  const legend = availableEvents.map((evt, index) => `**${index + 1}** - **${evt}**`).join('\n');

  const embed = new EmbedBuilder()
      .setTitle('🔔 Selecione os Eventos')
      .setDescription(`Utilize os botões numéricos abaixo para ativar/desativar os eventos.\n\n**Legenda:**\n${legend}`)
      .setColor(0x00ae86);

  if (interaction.isRepliable()) {
      await interaction.editReply({
          embeds: [embed],
          components: rows
      });
  }

  logger.debug('Event selection buttons displayed', { projectId, targetId });
}

/**
 * Handles the event button click (Toggle)
 */
export async function handleAddEventButton(
    interaction: import('discord.js').ButtonInteraction,
    deps: AddProjectHandlerDeps
): Promise<void> {
    await interaction.deferUpdate();
    
    // Toggle style: Secondary (Grey) -> Success (Green) -> Secondary
    const currentMsg = interaction.message;
    
    // Reconstruct components with the toggled button
    const components = currentMsg.components as ActionRow<MessageActionRowComponent>[];
    
    const newRows = components.map((row: ActionRow<MessageActionRowComponent>) => {
        const newRow = new ActionRowBuilder<ButtonBuilder>();
        // Iterate over components in the row
        row.components.forEach((comp: MessageActionRowComponent) => {
            if (comp.type === ComponentType.Button) {
                const btn = ButtonBuilder.from(comp as ButtonComponent);
                // Check customId on the component directly (camelCase)
                if ((comp as ButtonComponent).customId === interaction.customId) {
                    // Toggle style
                   const currentStyle = btn.data.style;
                   btn.setStyle(currentStyle === ButtonStyle.Success ? ButtonStyle.Secondary : ButtonStyle.Success);
                }
                newRow.addComponents(btn);
            }
        });
        return newRow;
    });

    await interaction.editReply({
        components: newRows
    });
}

/**
 * Handles the Select All button
 */
export async function handleAddEventSelectAll(
    interaction: import('discord.js').ButtonInteraction,
    deps: AddProjectHandlerDeps
): Promise<void> {
    await interaction.deferUpdate();
    const currentMsg = interaction.message;

    // Check if all EVENT buttons are already Green. If so, deselect all. Otherwise, select all.
    // Event buttons start with EVENT_BTN_PREFIX
    
    let allSelected = true;
    const components = currentMsg.components as ActionRow<MessageActionRowComponent>[];
    
    /* empty */
    components.forEach((row: ActionRow<MessageActionRowComponent>) => {
        row.components.forEach((comp: MessageActionRowComponent) => {
            if (comp.type === ComponentType.Button && 
                (comp as ButtonComponent).customId?.startsWith(ADD_PROJECT_CUSTOM_IDS.EVENT_BTN_PREFIX)) {
                    const btn = comp as ButtonComponent;
                     if (btn.style !== ButtonStyle.Success) {
                         allSelected = false;
                     }
            }
        });
    });

    const targetStyle = allSelected ? ButtonStyle.Secondary : ButtonStyle.Success;

    const newRows = components.map((row: ActionRow<MessageActionRowComponent>) => {
        const newRow = new ActionRowBuilder<ButtonBuilder>();
        row.components.forEach((comp: MessageActionRowComponent) => {
            if (comp.type === ComponentType.Button) {
                const btn = ButtonBuilder.from(comp as ButtonComponent);
                // Only modify Event Buttons
                // Use safe cast for custom_id or check component
                if ((comp as ButtonComponent).customId?.startsWith(ADD_PROJECT_CUSTOM_IDS.EVENT_BTN_PREFIX)) {
                    btn.setStyle(targetStyle);
                }
                newRow.addComponents(btn);
            }
        });
        return newRow;
    });

    await interaction.editReply({
        components: newRows
    });
}

/**
 * Handles the Confirm button
 */
export async function handleAddEventConfirm(
    interaction: import('discord.js').ButtonInteraction,
    deps: AddProjectHandlerDeps
): Promise<void> {
    const { projectsService, logger } = deps;
    await interaction.deferUpdate();

    // Parse project/target from ID
    const parts = interaction.customId.split(':');
    const projectId = parseInt(parts[1], 10);
    const targetId = parts[2];

    // Collect Selected Events
    const selectedEvents: string[] = [];
    /* empty */
    (interaction.message.components as ActionRow<MessageActionRowComponent>[]).forEach((row: ActionRow<MessageActionRowComponent>) => {
        row.components.forEach((comp: MessageActionRowComponent) => {
            if (comp.type === ComponentType.Button && 
                (comp as ButtonComponent).customId?.startsWith(ADD_PROJECT_CUSTOM_IDS.EVENT_BTN_PREFIX)) {
                     const btn = comp as ButtonComponent;
                     if (btn.style === ButtonStyle.Success) {
                         // Extract event name from ID: prefix:pid:tid:eventName
                         const idParts = btn.customId!.split(':');
                         // eventName is the 4th part (index 3) BUT event name might contain colons? Unlikely for Vikunja events (dot notation)
                         // But wait, split(':') might be dangerous if eventName has colons.
                         // Vikunja events are like 'task.created'. Safe.
                         // However, to be extra safe, let's join from index 3 onwards
                         const eventName = idParts.slice(3).join(':');
                         selectedEvents.push(eventName);
                     }
            }
        });
    });

    // Proceed to add
      if (targetId === 'dm') {
          const result = await projectsService.addProjectToDm(
              interaction.user.id,
              projectId,
              selectedEvents
          );
    
          if (!result.success) {
              await interaction.editReply({
                  content: `❌ ${result.error}`,
                  components: [],
                  embeds: []
              });
              return;
          }
    
          const embed = new EmbedBuilder()
              .setTitle('✅ Projetos Adicionados')
              .setDescription(`Projeto vinculado à sua DM com sucesso! (${selectedEvents.length} eventos)`)
              .setColor(0x00ae86);
    
          await interaction.editReply({
              embeds: [embed],
              components: []
          });
      } else {
          // Guild Channel
          const result = await projectsService.addProjectToChannel(
              interaction.guildId!,
              targetId,
              projectId,
              selectedEvents
          );
    
          if (!result.success) {
              await interaction.editReply({
                  content: `❌ ${result.error}`,
                  components: [],
                  embeds: []
              });
              return;
          }
    
          const embed = new EmbedBuilder()
            .setTitle('✅ Projeto Adicionado')
            .setDescription(`Projeto vinculado ao canal <#${targetId}> com sucesso! (${selectedEvents.length} eventos)`)
            .setColor(0x00ae86);
    
          await interaction.editReply({
            embeds: [embed],
            components: [],
          });
      }
    
      logger.info('Project added with events (Button Flow)', { projectId, targetId, eventCount: selectedEvents.length });
}

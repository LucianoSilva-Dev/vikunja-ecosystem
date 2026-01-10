/**
 * Digest Service
 *
 * Business logic for creating and managing digests
 */

import type { ILogger } from '../../../shared/types';
import type { Client, TextChannel } from 'discord.js';
import type { SchedulerService } from '../../../core/scheduler';
import type {
  DigestRepository,
  DigestRecord,
  CreateDigestData,
} from '../repositories/digest.repository';
import type { ConfigurationRepository } from '../../../shared/repositories/configuration.repository';
import type { VikunjaApiService } from '../../../shared/services/vikunja-api.service';
import type { UserMappingRepository } from '../../../shared/repositories/user-mapping.repository';
import { formatNotificationMessage } from '../../notifications/formatters/notification.formatter';
import type { NotificationPayload, UserReference } from '../../notifications/types';
import type { VikunjaProject, VikunjaTask } from '../../../shared/types/vikunja.types';

export interface DigestServiceDeps {
  logger: ILogger;
  schedulerService: SchedulerService;
  digestRepository: DigestRepository;
  configRepository: ConfigurationRepository;
  vikunjaApiService: VikunjaApiService;
  userMappingRepository: UserMappingRepository;
  discordClient: Client;
}

export interface CreateDigestInput {
  discordUserId: string;
  vikunjaProjectId: number;
  targetType: 'dm' | 'guild';
  guildId?: string;
  channelId?: string;
  cronExpression: string;
  type: 'daily' | 'weekly' | 'custom';
  typeData?: any;
  minPriority: number;
  startsAt?: Date;
}

export class DigestService {
  private readonly logger: ILogger;
  private readonly scheduler: SchedulerService;
  private readonly digestRepo: DigestRepository;
  private readonly configRepo: ConfigurationRepository;
  private readonly vikunjaApi: VikunjaApiService;
  private readonly userMappingRepo: UserMappingRepository;
  private readonly discordClient: Client;

  constructor(deps: DigestServiceDeps) {
    this.logger = deps.logger;
    this.scheduler = deps.schedulerService;
    this.digestRepo = deps.digestRepository;
    this.configRepo = deps.configRepository;
    this.vikunjaApi = deps.vikunjaApiService;
    this.userMappingRepo = deps.userMappingRepository;
    this.discordClient = deps.discordClient;
  }

  /**
   * Load and schedule all enabled digests from database
   * Called on bot startup
   */
  async loadDigests(): Promise<void> {
    const digests = await this.digestRepo.findAllEnabled();
    this.logger.info('Loading digests from database', { count: digests.length });

    for (const digest of digests) {
      this.scheduleDigest(digest);
    }
  }

  /**
   * Create a new digest
   */
  async createDigest(input: CreateDigestInput): Promise<DigestRecord> {
    const nextRunAt = input.startsAt || this.scheduler.getNextRun(input.cronExpression);
    if (!nextRunAt) {
      throw new Error('Invalid cron expression');
    }

    const data: CreateDigestData = {
      discordUserId: input.discordUserId,
      vikunjaProjectId: input.vikunjaProjectId,
      targetType: input.targetType,
      guildId: input.guildId,
      channelId: input.channelId,
      cronExpression: input.cronExpression,
      type: input.type,
      typeData: input.typeData,
      minPriority: input.minPriority,
      nextRunAt,
    };

    const digest = await this.digestRepo.create(data);
    this.scheduleDigest(digest);

    return digest;
  }

  /**
   * Delete a digest
   */
  async deleteDigest(id: number, discordUserId: string): Promise<boolean> {
    const digest = await this.digestRepo.findById(id);

    // Only allow deletion if user owns it OR (TODO: add check for guild admin if necessary)
    if (!digest || digest.discordUserId !== discordUserId) {
      return false;
    }

    this.scheduler.cancel(`digest_${id}`);
    return await this.digestRepo.delete(id);
  }

  /**
   * Get digests for a user
   */
  async getUserDigests(discordUserId: string): Promise<DigestRecord[]> {
    return await this.digestRepo.findByUserId(discordUserId);
  }

  /**
   * Schedule a digest in the cron scheduler
   */
  private scheduleDigest(digest: DigestRecord): void {
    const jobId = `digest_${digest.id}`;

    this.scheduler.schedule(
      jobId,
      digest.cronExpression,
      async () => await this.executeDigest(digest)
    );
  }

  /**
   * Execute a digest - send summary
   */
  private async executeDigest(digest: DigestRecord): Promise<void> {
    this.logger.debug('Executing digest check', { id: digest.id, projectId: digest.vikunjaProjectId });

    if (!this.shouldExecute(digest)) {
         this.logger.debug('Skipping digest execution - not due yet', { 
             id: digest.id, 
             nextRun: digest.nextRunAt, 
             now: new Date() 
         });
         return;
    }

    try {
      // 1. Fetch Project
      let project: VikunjaProject | undefined;
      try {
        const projectResult = await this.vikunjaApi.getProject(digest.vikunjaProjectId);
        project = (projectResult as VikunjaProject) || undefined;
      } catch (e) {
        this.logger.warn('Failed to fetch project for digest', {
          digestId: digest.id,
          projectId: digest.vikunjaProjectId,
          error: e instanceof Error ? e.message : String(e),
        });
        return;
      }

      if (!project) {
        this.logger.warn('Project not found, disabling digest', { digestId: digest.id });
        // TODO: Disable digest?
        return;
      }

      // 2. Fetch Tasks
      // We might need to fetch all tasks and filter client-side if API doesn't support generic filtering by priority easily
      // assuming we can get tasks for project
      const tasks = await this.vikunjaApi.getProjectTasks(digest.vikunjaProjectId);

      // 3. Filter Tasks
      const filteredTasks = tasks.filter((t) => {
        const priority = t.priority ?? 0;
        const isNotDone = !t.done;
        return isNotDone && priority >= digest.minPriority;
      });

      if (filteredTasks.length === 0) {
        this.logger.debug('No tasks for digest, skipping', { digestId: digest.id });
        // Can optionally send "No tasks" message
        return;
      }

      // 4. Sort Tasks
      // Priority (Desc) -> Due Date (Asc) -> Created (Asc)
      filteredTasks.sort((a, b) => {
        const diffPriority = (b.priority ?? 0) - (a.priority ?? 0);
        if (diffPriority !== 0) return diffPriority;

        // Due date: nulls last? or first? Usually earliest due date first.
        const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const diffDue = aDue - bDue;
        if (diffDue !== 0) return diffDue;

         const aCreated = new Date(a.created as string).getTime();
         const bCreated = new Date(b.created as string).getTime();
         return aCreated - bCreated;
       });

       // 5. Build Content
       const frontendUrl = process.env.VIKUNJA_FRONTEND_URL || 'https://vikunja.io';
       const projectUrl = `${frontendUrl}/projects/${project.id}`;

       // This is constructing the message manually since it's a digest (list of things)
       // rather than a single event notification.
       // But we can try to reuse parts or just build a custom embed.
       
       const embed = {
         title: `Resumo das tarefas para ${project.title}`,
         url: projectUrl,
         color: 0x3498db, // Blue
         description: `**Data:** ${new Date().toLocaleDateString('pt-BR')}\n\nRunning logic...`, // Will be replaced
         fields: [] as any[],
         footer: {
             text: 'Vikunja Digest'
         },
         timestamp: new Date().toISOString()
       };

       const taskFields = await Promise.all(filteredTasks.map(async (task) => {
          const priorityLabel = this.getPriorityLabel(task.priority ?? 0);
          const taskUrl = `${frontendUrl}/tasks/${task.id}`;
          
          const assignees = await this.formatAssignees(task.assignees);
          const dueDate = task.due_date 
             ? new Date(task.due_date as string).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })
             : 'Sem prazo';
          const createdDate = new Date(task.created as string).toLocaleDateString('pt-BR', {  hour: '2-digit', minute: '2-digit' });

          return {
              name: `${priorityLabel} [${task.identifier}] ${task.title}`,
              value: `[Link](${taskUrl}) | **Prazo:** ${dueDate} | **Criado:** ${createdDate}\n**Responsáveis:** ${assignees}`,
              inline: false
          };
       }));

      // Discord embed field limit is 25. might need to chunk if too many tasks.
      // For now, let's limit to top 25
      const limitedFields = taskFields.slice(0, 25);
      
      embed.description = `Encontradas ${filteredTasks.length} tarefas com prioridade mínima ${this.getPriorityLabel(digest.minPriority)}. Mostrando top ${limitedFields.length}.`;
      embed.fields = limitedFields;

      // 6. Send
      if (digest.targetType === 'dm') {
        const user = await this.discordClient.users.fetch(digest.discordUserId);
        await user.send({ 
            content: `# Resumo das tarefas para ${project.title} - ${new Date().toLocaleDateString('pt-BR')}`,
            embeds: [embed] 
        });
      } else if (digest.guildId) {
          // Handle Guild Digest
          if (digest.channelId) {
              // Priority: Specific channel
              try {
                const channel = await this.discordClient.channels.fetch(digest.channelId);
                if (channel?.isTextBased()) {
                    await (channel as TextChannel).send({ 
                        content: `# Resumo das tarefas para ${project.title} - ${new Date().toLocaleDateString('pt-BR')}`,
                        embeds: [embed] 
                    });
                }
              } catch (error) {
                this.logger.error('Failed to send digest to specific channel', {
                    digestId: digest.id,
                    channelId: digest.channelId,
                    error: error instanceof Error ? error.message : String(error),
                });
              }
          } else {
             // Fallback: Use legacy project bindings
             const bindings = await this.configRepo.listGuildChannels(digest.guildId);
             const binding = bindings?.find((b) => b.projectId === digest.vikunjaProjectId);
    
             if (binding) {
                 const channel = await this.discordClient.channels.fetch(binding.channelId);
                 if (channel?.isTextBased()) {
                     await (channel as TextChannel).send({ 
                        content: `# Resumo das tarefas para ${project.title} - ${new Date().toLocaleDateString('pt-BR')}`,
                        embeds: [embed] 
                    });
                 }
             }
          }
      }

      // 7. Update Next Run
      const nextRun = this.calculateNextRun(digest);
      if (nextRun) {
        await this.digestRepo.updateNextRunAt(digest.id, nextRun);
      }

    } catch (error) {
      this.logger.error('Failed to execute digest', {
        digestId: digest.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private calculateNextRun(digest: DigestRecord): Date | null {
      // Logic for custom intervals:
      // If Custom and we just ran, we need to add X days to the *current exec time* (or next scheduled)
      // Standard croner might just give tomorrow if cron is "daily".
      
      if (digest.type === 'custom' && digest.typeData?.interval) {
          const interval = parseInt(digest.typeData.interval, 10);
          if (!isNaN(interval)) {
              // Add interval days to current nextRunAt (which is now 'past' or 'now')
              const next = new Date(digest.nextRunAt);
              next.setDate(next.getDate() + interval);
              return next;
          }
      }

      return this.scheduler.getNextRun(digest.cronExpression);
  }

  /**
   * Check if we should execute the digest based on custom logic (e.g. interval check)
   * This handles the case where cron fires daily but we only want every X days.
   */
  private shouldExecute(digest: DigestRecord): boolean {
      if (digest.type !== 'custom') return true;
      
      const now = new Date();
      // Allow execution if we are past or at nextRunAt (with small buffer)
      // But actually, the scheduler triggers this callback generally at the right time.
      // The issue is if we use a Daily cron for a 3-day interval, we need to skip the days in between?
      // NO.
      // Strategy:
      // 1. We schedule the job using standard cron.
      // 2. For custom, we calculate the REAL next date and store in DB.
      // 3. The scheduler runs the job based on cron.
      // 4. We check if now >= nextRunAt. If not, we skip.
      
      // WAIT. If we use cron `0 9 * * *` it runs EVERY day.
      // If we want it to run every 3 days, we either:
      // A) Use a clever cron (limitations)
      // B) Let it run every day, but `executeDigest` checks DB `nextRunAt` and aborts if too early.
      
      // Implementation B:
      if (now < digest.nextRunAt) {
          // It's too early. This is a "daily check" execution that shouldn't send anything.
          return false;
      }
      return true;
  }

  private getPriorityLabel(priority: number): string {
    switch (priority) {
        case 0: return '⚪ Indefinida'; // or whatever default
        case 1: return '🔵 Baixa';
        case 2: return '🟡 Média';
        case 3: return '🟠 Alta';
        case 4: return '🔴 Urgente';
        case 5: return '🔥 FAÇA AGORA';
        default: return '⚪ Indefinida';
    }
  }

  private async formatAssignees(assignees?: any[]): Promise<string> {
      if (!assignees || assignees.length === 0) return 'Ninguém';
      
      const mentions = await Promise.all(assignees.map(async (u) => {
          const discordId = await this.userMappingRepo.findDiscordUserId(u.id);
          return discordId ? `<@${discordId}>` : u.username;
      }));

      return mentions.join(', ');
  }
}

export function createDigestService(deps: DigestServiceDeps): DigestService {
  return new DigestService(deps);
}

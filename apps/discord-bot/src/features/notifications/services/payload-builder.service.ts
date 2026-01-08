import type { ILogger } from '../../../shared/types';
import type {
  VikunjaTask,
  VikunjaProject,
  VikunjaUser,
  VikunjaLabel,
  VikunjaTeam,
  VikunjaTaskComment,
  VikunjaTaskAttachment,
  VikunjaTaskRelation,
} from '../../../shared/types/vikunja.types';
import type { VikunjaEventType } from '../../../shared/types';
import type {
  NotificationPayload,
  ProjectInfo,
  UserReference,
  LabelInfo,
  EventContext,
  TaskEventContext,
} from '../types';
import type { UserMappingRepository } from '../../../shared/repositories/user-mapping.repository';
import type { VikunjaApiService } from '../../../shared/services/vikunja-api.service';

export interface PayloadBuilderDeps {
  logger: ILogger;
  userMappingRepository: UserMappingRepository;
  frontendUrl: string;
  vikunjaApiService: VikunjaApiService;
}

/**
 * Service for building rich notification payloads from webhook events
 */
export class NotificationPayloadBuilder {
  private readonly logger: ILogger;
  private readonly userMappingRepository: UserMappingRepository;
  private readonly frontendUrl: string;
  private readonly vikunjaApiService: VikunjaApiService;

  constructor(deps: PayloadBuilderDeps) {
    this.logger = deps.logger;
    this.userMappingRepository = deps.userMappingRepository;
    this.frontendUrl = deps.frontendUrl.replace(/\/$/, ''); // Remove trailing slash
    this.vikunjaApiService = deps.vikunjaApiService;
  }

  /**
   * Builds a NotificationPayload from a webhook event
   */
  async buildPayload(
    eventType: VikunjaEventType,
    eventTime: string,
    eventData: unknown
  ): Promise<NotificationPayload | null> {
    const data = eventData as Record<string, unknown>;

    // Collect all user IDs to fetch Discord mappings
    const userIds = this.collectUserIds(data);
    const userMappings = await this.userMappingRepository.findDiscordUserIds(
      userIds
    );

    // Build base payload
    const payload: NotificationPayload = {
      eventType,
      title: 'Notificação',
      timestamp: new Date(eventTime),
    };

    // Handle different event types
    if (this.isTaskEvent(eventType)) {
      return this.buildTaskPayload(eventType, data, userMappings, payload);
    } else if (this.isProjectEvent(eventType)) {
      return this.buildProjectPayload(eventType, data, userMappings, payload);
    } else if (this.isTeamEvent(eventType)) {
      return this.buildTeamPayload(eventType, data, userMappings, payload);
    }

    this.logger.warn('Unknown event type for payload building', { eventType });
    return null;
  }

  /**
   * Collects all user IDs from event data for batch fetching Discord mappings
   */
  private collectUserIds(data: Record<string, unknown>): number[] {
    const ids: number[] = [];

    // Doer
    const doer = data.doer as VikunjaUser | undefined;
    if (doer?.id) ids.push(doer.id);

    // Task assignees
    const task = data.task as VikunjaTask | undefined;
    if (task?.assignees) {
      ids.push(...task.assignees.map((a) => a.id));
    }
    if (task?.created_by?.id) ids.push(task.created_by.id);

    // Assignee in assignee events
    const assignee = data.assignee as VikunjaUser | undefined;
    if (assignee?.id) ids.push(assignee.id);

    // Comment author
    const comment = data.comment as VikunjaTaskComment | undefined;
    if (comment?.author?.id) ids.push(comment.author.id);

    // Project owner
    const project = data.project as VikunjaProject | undefined;
    if (project?.owner?.id) ids.push(project.owner.id);

    // Shared user
    const user = data.user as VikunjaUser | undefined;
    if (user?.id) ids.push(user.id);

    // Team member
    const member = data.member as VikunjaUser | undefined;
    if (member?.id) ids.push(member.id);

    // Team created_by
    const team = data.team as VikunjaTeam | undefined;
    if (team?.created_by?.id) ids.push(team.created_by.id);

    return [...new Set(ids)]; // Remove duplicates
  }

  /**
   * Converts a VikunjaUser to a UserReference with optional Discord mapping
   */
  private toUserReference(
    user: VikunjaUser | undefined,
    userMappings: Map<number, string>
  ): UserReference | undefined {
    if (!user) return undefined;

    return {
      vikunjaId: user.id,
      name: user.name,
      username: user.username,
      discordUserId: userMappings.get(user.id),
      avatarUrl: user.avatar_url,
    };
  }

  /**
   * Converts VikunjaLabels to LabelInfo array
   */
  private toLabels(labels: VikunjaLabel[] | undefined): LabelInfo[] {
    if (!labels) return [];
    return labels.map((l) => ({
      title: l.title,
      hexColor: l.hex_color,
    }));
  }

  /**
   * Builds a task identifier string (e.g., "PROJ-123")
   */
  private getTaskIdentifier(task: VikunjaTask): string {
    return task.identifier || `#${task.index}`;
  }

  /**
   * Builds URL for a task
   */
  private getTaskUrl(task: VikunjaTask): string {
    return `${this.frontendUrl}/tasks/${task.id}`;
  }

  /**
   * Builds URL for a project
   */
  private getProjectUrl(projectId: number): string {
    return `${this.frontendUrl}/projects/${projectId}`;
  }

  private isTaskEvent(eventType: VikunjaEventType): boolean {
    return eventType.startsWith('task.');
  }

  private isProjectEvent(eventType: VikunjaEventType): boolean {
    return eventType.startsWith('project.');
  }

  private isTeamEvent(eventType: VikunjaEventType): boolean {
    return eventType.startsWith('team.');
  }

  /**
   * Builds payload for task-related events
   */
  private async buildTaskPayload(
    eventType: VikunjaEventType,
    data: Record<string, unknown>,
    userMappings: Map<number, string>,
    basePayload: NotificationPayload
  ): Promise<NotificationPayload> {
    const task = data.task as VikunjaTask;
    const doer = data.doer as VikunjaUser | undefined;
    const projectData = data.project as VikunjaProject | undefined;

    let projectTitle = projectData?.title || '';
    let projectIdentifier =
      projectData?.identifier || task.identifier?.split('-')[0] || '';

    // If title is missing, try to fetch project
    if (!projectTitle && task.project_id) {
      try {
        const fetchedProject = await this.vikunjaApiService.getProject(
          task.project_id
        );
        if (fetchedProject) {
          projectTitle = fetchedProject.title || '';
          if (!projectIdentifier) {
            projectIdentifier = fetchedProject.identifier || '';
          }
        }
      } catch (error) {
        this.logger.warn('Failed to fetch project info', {
          projectId: task.project_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const payload: NotificationPayload = {
      ...basePayload,
      title: task.title,
      url: this.getTaskUrl(task),
      author: this.toUserReference(doer, userMappings),
      project: {
        id: task.project_id,
        title: projectTitle || 'Projeto',
        identifier: projectIdentifier,
        url: this.getProjectUrl(task.project_id),
      },
    };

    // Build task context
    const taskContext: TaskEventContext = {
      taskId: task.id,
      projectId: task.project_id,
      taskIdentifier: this.getTaskIdentifier(task),
      priority: task.priority,
      done: task.done,
      percentDone: task.percent_done,
      dueDate: task.due_date ? new Date(task.due_date) : undefined,
      startDate: task.start_date ? new Date(task.start_date) : undefined,
      endDate: task.end_date ? new Date(task.end_date) : undefined,
      assignees: task.assignees?.map((a) =>
        this.toUserReference(a, userMappings)
      ).filter((a): a is UserReference => a !== undefined),
      labels: this.toLabels(task.labels),
    };

    // Handle specific task sub-events
    switch (eventType) {
      case 'task.comment.created':
      case 'task.comment.edited':
      case 'task.comment.deleted': {
        const comment = data.comment as VikunjaTaskComment | undefined;
        if (comment) {
          payload.context = {
            type: 'comment',
            data: {
              taskId: task.id,
              taskIdentifier: this.getTaskIdentifier(task),
              commentText: comment.comment || '',
            },
          };
        } else {
          payload.context = { type: 'task', data: taskContext };
        }
        break;
      }

      case 'task.attachment.created':
      case 'task.attachment.deleted': {
        const attachment = data.attachment as VikunjaTaskAttachment | undefined;
        payload.context = {
          type: 'attachment',
          data: {
            taskId: task.id,
            taskIdentifier: this.getTaskIdentifier(task),
            fileName: attachment?.file?.name,
          },
        };
        break;
      }

      case 'task.relation.created':
      case 'task.relation.deleted': {
        const relation = data.relation as VikunjaTaskRelation | undefined;
        if (relation) {
          payload.context = {
            type: 'relation',
            data: {
              taskId: task.id,
              taskIdentifier: this.getTaskIdentifier(task),
              relatedTaskId: relation.other_task_id,
              relationType: relation.relation_kind,
            },
          };
        } else {
          payload.context = { type: 'task', data: taskContext };
        }
        break;
      }

      case 'task.assignee.created':
      case 'task.assignee.deleted': {
        const assignee = data.assignee as VikunjaUser | undefined;
        // Include the specific assignee in the task context
        if (assignee) {
          taskContext.assignees = [
            this.toUserReference(assignee, userMappings),
          ].filter((a): a is UserReference => a !== undefined);
        }
        payload.context = { type: 'task', data: taskContext };
        break;
      }

      default:
        payload.context = { type: 'task', data: taskContext };
    }

    return payload;
  }

  /**
   * Builds payload for project-related events
   */
  private buildProjectPayload(
    eventType: VikunjaEventType,
    data: Record<string, unknown>,
    userMappings: Map<number, string>,
    basePayload: NotificationPayload
  ): NotificationPayload {
    const project = data.project as VikunjaProject;
    const doer = data.doer as VikunjaUser | undefined;

    const payload: NotificationPayload = {
      ...basePayload,
      title: project.title,
      url: this.getProjectUrl(project.id),
      author: this.toUserReference(doer, userMappings),
      project: {
        id: project.id,
        title: project.title,
        identifier: project.identifier,
        url: this.getProjectUrl(project.id),
      },
      context: {
        type: 'project',
        data: {
          projectId: project.id,
          owner: this.toUserReference(project.owner, userMappings),
        },
      },
    };

    // Handle shared events
    if (eventType === 'project.shared.user') {
      const sharedUser = data.user as VikunjaUser | undefined;
      if (sharedUser) {
        payload.description = `Compartilhado com ${sharedUser.name || sharedUser.username}`;
      }
    } else if (eventType === 'project.shared.team') {
      const team = data.team as VikunjaTeam | undefined;
      if (team) {
        payload.description = `Compartilhado com o time ${team.name}`;
      }
    }

    return payload;
  }

  /**
   * Builds payload for team-related events
   */
  private buildTeamPayload(
    eventType: VikunjaEventType,
    data: Record<string, unknown>,
    userMappings: Map<number, string>,
    basePayload: NotificationPayload
  ): NotificationPayload {
    const team = data.team as VikunjaTeam;
    const doer = data.doer as VikunjaUser | undefined;
    const member = data.member as VikunjaUser | undefined;

    const payload: NotificationPayload = {
      ...basePayload,
      title: team.name,
      author: this.toUserReference(doer, userMappings),
      context: {
        type: 'team',
        data: {
          teamName: team.name,
          teamDescription: team.description,
          member: this.toUserReference(member, userMappings),
        },
      },
    };

    return payload;
  }
}

export function createNotificationPayloadBuilder(
  deps: PayloadBuilderDeps
): NotificationPayloadBuilder {
  return new NotificationPayloadBuilder(deps);
}

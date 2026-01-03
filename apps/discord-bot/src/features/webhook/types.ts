import type { 
  VikunjaTask, 
  VikunjaUser, 
  VikunjaProject,
  VikunjaTeam,
  VikunjaTaskComment,
  VikunjaTaskAttachment,
  VikunjaTaskRelation
} from '../../shared/types/vikunja.types';

// Task Events
export interface TaskCreatedEventData {
  task: VikunjaTask;
  doer: VikunjaUser;
}

export interface TaskUpdatedEventData {
  task: VikunjaTask;
  doer: VikunjaUser;
}

export interface TaskDeletedEventData {
  task: VikunjaTask;
  doer: VikunjaUser;
}

export interface TaskAssigneeCreatedEventData {
  task: VikunjaTask;
  assignee: VikunjaUser;
  doer: VikunjaUser;
}

export interface TaskAssigneeDeletedEventData {
  task: VikunjaTask;
  assignee: VikunjaUser;
  doer: VikunjaUser;
}

export interface TaskCommentCreatedEventData {
  task: VikunjaTask;
  comment: VikunjaTaskComment;
  doer: VikunjaUser;
}

export interface TaskCommentUpdatedEventData {
  task: VikunjaTask;
  comment: VikunjaTaskComment;
  doer: VikunjaUser;
}

export interface TaskCommentDeletedEventData {
  task: VikunjaTask;
  comment: VikunjaTaskComment;
  doer: VikunjaUser;
}

export interface TaskAttachmentCreatedEventData {
  task: VikunjaTask;
  attachment: VikunjaTaskAttachment;
  doer: VikunjaUser;
}

export interface TaskAttachmentDeletedEventData {
  task: VikunjaTask;
  attachment: VikunjaTaskAttachment;
  doer: VikunjaUser;
}

export interface TaskRelationCreatedEventData {
  task: VikunjaTask;
  relation: VikunjaTaskRelation;
  doer: VikunjaUser;
}

export interface TaskRelationDeletedEventData {
  task: VikunjaTask;
  relation: VikunjaTaskRelation;
  doer: VikunjaUser;
}

// Project Events
export interface ProjectCreatedEventData {
  project: VikunjaProject;
  doer: VikunjaUser;
}

export interface ProjectUpdatedEventData {
  project: VikunjaProject;
  doer: VikunjaUser;
}

export interface ProjectDeletedEventData {
  project: VikunjaProject;
  doer: VikunjaUser;
}

export interface ProjectSharedWithUserEventData {
  project: VikunjaProject;
  user: VikunjaUser;
  doer: VikunjaUser;
}

export interface ProjectSharedWithTeamEventData {
  project: VikunjaProject;
  team: VikunjaTeam;
  doer: VikunjaUser;
}

// Team Events
export interface TeamCreatedEventData {
  team: VikunjaTeam;
  doer: VikunjaUser;
}

export interface TeamDeletedEventData {
  team: VikunjaTeam;
  doer: VikunjaUser;
}

export interface TeamMemberAddedEventData {
  team: VikunjaTeam;
  member: VikunjaUser;
  doer: VikunjaUser;
}

export interface TeamMemberRemovedEventData {
  team: VikunjaTeam;
  member: VikunjaUser;
  doer: VikunjaUser;
}


export type VikunjaEventData = 
  | TaskCreatedEventData
  | TaskUpdatedEventData
  | TaskDeletedEventData
  | TaskAssigneeCreatedEventData
  | TaskAssigneeDeletedEventData
  | TaskCommentCreatedEventData
  | TaskCommentUpdatedEventData
  | TaskCommentDeletedEventData
  | TaskAttachmentCreatedEventData
  | TaskAttachmentDeletedEventData
  | TaskRelationCreatedEventData
  | TaskRelationDeletedEventData
  | ProjectCreatedEventData
  | ProjectUpdatedEventData
  | ProjectDeletedEventData
  | ProjectSharedWithUserEventData
  | ProjectSharedWithTeamEventData
  | TeamCreatedEventData
  | TeamDeletedEventData
  | TeamMemberAddedEventData
  | TeamMemberRemovedEventData;

// Discriminated Union for the Webhook Event
export type WebhookEvent = 
  | { event_name: 'task.created'; time: string; data: TaskCreatedEventData }
  | { event_name: 'task.updated'; time: string; data: TaskUpdatedEventData }
  | { event_name: 'task.deleted'; time: string; data: TaskDeletedEventData }
  | { event_name: 'task.assignee.created'; time: string; data: TaskAssigneeCreatedEventData }
  | { event_name: 'task.assignee.deleted'; time: string; data: TaskAssigneeDeletedEventData }
  | { event_name: 'task.comment.created'; time: string; data: TaskCommentCreatedEventData }
  | { event_name: 'task.comment.edited'; time: string; data: TaskCommentUpdatedEventData }
  | { event_name: 'task.comment.deleted'; time: string; data: TaskCommentDeletedEventData }
  | { event_name: 'task.attachment.created'; time: string; data: TaskAttachmentCreatedEventData }
  | { event_name: 'task.attachment.deleted'; time: string; data: TaskAttachmentDeletedEventData }
  | { event_name: 'task.relation.created'; time: string; data: TaskRelationCreatedEventData }
  | { event_name: 'task.relation.deleted'; time: string; data: TaskRelationDeletedEventData }
  | { event_name: 'project.created'; time: string; data: ProjectCreatedEventData }
  | { event_name: 'project.updated'; time: string; data: ProjectUpdatedEventData }
  | { event_name: 'project.deleted'; time: string; data: ProjectDeletedEventData }
  | { event_name: 'project.shared.user'; time: string; data: ProjectSharedWithUserEventData }
  | { event_name: 'project.shared.team'; time: string; data: ProjectSharedWithTeamEventData }
  | { event_name: 'team.created'; time: string; data: TeamCreatedEventData }
  | { event_name: 'team.deleted'; time: string; data: TeamDeletedEventData }
  | { event_name: 'team.member.added'; time: string; data: TeamMemberAddedEventData }
  | { event_name: 'team.member.removed'; time: string; data: TeamMemberRemovedEventData };

/**
 * Webhook validation result
 */
export interface WebhookValidationResult {
  valid: boolean;
  error?: string;
}

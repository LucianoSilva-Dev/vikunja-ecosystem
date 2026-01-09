/**
 * Vikunja event types for webhooks and notifications
 */

export type VikunjaEventType =
  | 'task.created'
  | 'task.updated'
  | 'task.reminder'
  | 'task.deleted'
  | 'task.assignee.created'
  | 'task.assignee.deleted'
  | 'task.comment.created'
  | 'task.comment.edited'
  | 'task.comment.deleted'
  | 'task.attachment.created'
  | 'task.attachment.deleted'
  | 'task.relation.created'
  | 'task.relation.deleted'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'project.shared.user'
  | 'project.shared.team'
  | 'team.created'
  | 'team.deleted'
  | 'team.member.added'
  | 'team.member.removed';

export interface VikunjaUser {
  id: number;
  name: string;
  username: string;
  email?: string;
  status?: number;
  avatar_url?: string; // Derived or computed in frontend, but often absent in backend struct directly unless computed
  created: string;
  updated: string;
}

export interface VikunjaLabel {
  id: number;
  title: string;
  description?: string;
  hex_color: string;
  created_by?: VikunjaUser;
  created: string;
  updated: string;
}

export interface VikunjaTask {
  id: number;
  title: string;
  description: string;
  done: boolean;
  done_at?: string;
  due_date?: string;
  reminders?: any[]; // Simplified
  project_id: number;
  repeat_after?: number;
  repeat_mode?: number;
  priority?: number;
  start_date?: string;
  end_date?: string;
  assignees?: VikunjaUser[];
  labels?: VikunjaLabel[];
  hex_color?: string;
  percent_done?: number;
  identifier: string;
  index: number;
  related_tasks?: any; // Simplified
  attachments?: VikunjaTaskAttachment[];
  cover_image_attachment_id?: number;
  is_favorite: boolean;
  created: string;
  updated: string;
  bucket_id?: number;
  position?: number;
  created_by?: VikunjaUser;
}

export interface VikunjaProject {
  id: number;
  title: string;
  description: string;
  identifier: string;
  hex_color?: string;
  parent_project_id?: number;
  owner?: VikunjaUser;
  is_archived: boolean;
  is_favorite: boolean;
  position?: number;
  created: string;
  updated: string;
}

export interface VikunjaTeam {
  id: number;
  name: string;
  description?: string;
  created_by?: VikunjaUser;
  members?: VikunjaUser[]; // Simplified from TeamMember but typically includes User info
  created: string;
  updated: string;
  is_public: boolean;
}

export interface VikunjaTaskComment {
  id: number;
  comment: string;
  author?: VikunjaUser;
  created: string;
  updated: string;
}

export interface VikunjaTaskAttachment {
  id: number;
  task_id: number;
  file?: any; // Simplified
  created_by?: VikunjaUser;
  created: string;
}

export interface VikunjaTaskRelation {
  task_id: number;
  other_task_id: number;
  relation_kind: string;
  created_by?: VikunjaUser;
  created: string;
}

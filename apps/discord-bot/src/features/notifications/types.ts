import type { VikunjaEventType } from '../../shared/types';
import type { ActionRowBuilder, ButtonBuilder } from 'discord.js';

/**
 * Types for the notification module
 */

/**
 * Representa informações de um projeto para exibição
 */
export interface ProjectInfo {
  id: number;
  title: string;
  identifier: string;
  url?: string;
}

/**
 * Representa um usuário com possível menção Discord
 */
export interface UserReference {
  vikunjaId: number;
  name: string;
  username: string;
  discordUserId?: string; // Se disponível, será usado para menção
  avatarUrl?: string;
}

/**
 * Representa uma label para exibição
 */
export interface LabelInfo {
  title: string;
  hexColor: string;
}

/**
 * Contexto adicional específico para eventos de tarefa
 */
export interface TaskEventContext {
  taskId: number;
  projectId: number;
  taskIdentifier: string; // Ex: "PROJ-123"
  priority?: number;
  dueDate?: Date;
  startDate?: Date;
  endDate?: Date;
  done?: boolean;
  percentDone?: number;
  assignees?: UserReference[];
  labels?: LabelInfo[];
}

/**
 * Contexto adicional específico para eventos de comentário
 */
export interface CommentEventContext {
  taskId: number;
  taskIdentifier: string;
  commentText: string;
}

/**
 * Contexto adicional específico para eventos de anexo
 */
export interface AttachmentEventContext {
  taskId: number;
  taskIdentifier: string;
  fileName?: string;
}

/**
 * Contexto adicional específico para eventos de relação
 */
export interface RelationEventContext {
  taskId: number;
  taskIdentifier: string;
  relatedTaskId: number;
  relatedTaskTitle?: string;
  relationType: string;
}

/**
 * Contexto adicional específico para eventos de time
 */
export interface TeamEventContext {
  teamName: string;
  teamDescription?: string;
  member?: UserReference;
}

/**
 * Contexto adicional específico para eventos de projeto
 */
export interface ProjectEventContext {
  projectId: number;
  owner?: UserReference;
}

/**
 * União discriminada de contextos de evento
 */
export type EventContext =
  | { type: 'task'; data: TaskEventContext }
  | { type: 'comment'; data: CommentEventContext }
  | { type: 'attachment'; data: AttachmentEventContext }
  | { type: 'relation'; data: RelationEventContext }
  | { type: 'team'; data: TeamEventContext }
  | { type: 'project'; data: ProjectEventContext };

/**
 * Payload expandido para notificações
 */
export interface NotificationPayload {
  eventType: VikunjaEventType;
  title: string;
  description?: string; // Não usar para task description (HTML)
  url?: string; // Link para o frontend do Vikunja

  // Contexto do projeto (sempre presente, especialmente importante para DMs)
  project?: ProjectInfo;

  // Autor da ação
  author?: UserReference;

  // Contexto específico do evento
  context?: EventContext;

  // Campos customizados adicionais (para retrocompatibilidade)
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;

  color?: number;
  timestamp?: Date;

  // Componentes interativos (botões)
  components?: ActionRowBuilder<ButtonBuilder>[];
}

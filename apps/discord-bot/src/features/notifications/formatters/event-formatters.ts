import type { VikunjaEventType } from '../../../shared/types';
import type { UserReference, LabelInfo } from '../types';

/**
 * Mapeamento de tipos de evento para descrição em linguagem natural
 */
export const EVENT_TYPE_LABELS: { [K in VikunjaEventType]: string } = {
  'task.created': 'Tarefa Criada',
  'task.updated': 'Tarefa Atualizada',
  'task.deleted': 'Tarefa Excluída',
  'task.assignee.created': 'Responsável Adicionado',
  'task.assignee.deleted': 'Responsável Removido',
  'task.comment.created': 'Comentário Adicionado',
  'task.comment.edited': 'Comentário Editado',
  'task.comment.deleted': 'Comentário Excluído',
  'task.attachment.created': 'Anexo Adicionado',
  'task.attachment.deleted': 'Anexo Removido',
  'task.relation.created': 'Relação Criada',
  'task.relation.deleted': 'Relação Removida',
  'project.created': 'Projeto Criado',
  'project.updated': 'Projeto Atualizado',
  'project.deleted': 'Projeto Excluído',
  'project.shared.user': 'Projeto Compartilhado',
  'project.shared.team': 'Projeto Compartilhado com Time',
  'team.created': 'Time Criado',
  'team.deleted': 'Time Excluído',
  'team.member.added': 'Membro Adicionado ao Time',
  'team.member.removed': 'Membro Removido do Time',
};

/**
 * Retorna a descrição em linguagem natural para um tipo de evento
 */
export function getEventTypeLabel(eventType: VikunjaEventType): string {
  return EVENT_TYPE_LABELS[eventType] || eventType;
}

/**
 * Formata referência de usuário como menção Discord ou nome do Vikunja
 */
export function formatUserReference(user: UserReference): string {
  if (user.discordUserId) {
    return `<@${user.discordUserId}>`;
  }
  // Fallback: exibe o nome do usuário no Vikunja
  return user.name || user.username;
}

/**
 * Formata lista de assignees
 */
export function formatAssignees(assignees: UserReference[]): string {
  if (!assignees.length) return 'Nenhum';
  return assignees.map(formatUserReference).join(', ');
}

/**
 * Formata prioridade como texto e emoji
 */
export function formatPriority(priority?: number): string {
  const priorities: Record<number, string> = {
    0: '⬜ Nenhuma',
    1: '🟩 Baixa',
    2: '🟨 Média',
    3: '🟧 Alta',
    4: '🟥 Urgente',
    5: '🔴 Imediata',
  };
  return priorities[priority ?? 0] || priorities[0];
}

/**
 * Formata labels com cores
 */
export function formatLabels(labels: LabelInfo[]): string {
  if (!labels.length) return 'Nenhuma';
  return labels.map((l) => `\`${l.title}\``).join(', ');
}

/**
 * Formata data usando timestamp do Discord (formato relativo)
 */
export function formatDate(date?: Date): string {
  if (!date) return 'Não definida';
  const timestamp = Math.floor(date.getTime() / 1000);
  return `<t:${timestamp}:R>`; // Formato relativo: "há 2 horas"
}

/**
 * Formata porcentagem de conclusão como barra de progresso visual
 */
export function formatProgress(percentDone?: number): string {
  if (percentDone === undefined || percentDone === 0) return '0%';
  const filled = Math.round((percentDone / 100) * 10);
  const empty = 10 - filled;
  return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${percentDone}%`;
}

/**
 * Formata tipo de relação para linguagem natural
 */
export function formatRelationType(relationType: string): string {
  const relationTypes: Record<string, string> = {
    subtask: 'Subtarefa de',
    parenttask: 'Tarefa pai de',
    related: 'Relacionada a',
    duplicateof: 'Duplicata de',
    duplicates: 'Duplica',
    blocking: 'Bloqueia',
    blocked: 'Bloqueada por',
    precedes: 'Precede',
    follows: 'Segue',
    copiedfrom: 'Copiada de',
    copiedto: 'Copiada para',
  };
  return relationTypes[relationType] || relationType;
}

import type { VikunjaEventType } from '../../shared/types';

/**
 * Types for the notification module
 */

export interface NotificationPayload {
  eventType: VikunjaEventType;
  title: string;
  description?: string;
  url?: string;
  author?: {
    name: string;
    avatarUrl?: string;
  };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  color?: number;
  timestamp?: Date;
}

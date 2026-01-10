import { ModalSubmitInteraction } from 'discord.js';

/**
 * Calculate the default start date based on current time
 * If the specified hour:minute hasn't passed today, returns today at that time
 * Otherwise, returns tomorrow at that time
 */
export function calculateDefaultStartDate(hour: number, minute: number): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  
  if (today > now) {
    // The time hasn't passed today, start today
    return today;
  } else {
    // The time has already passed, start tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
}

/**
 * Calculate the default start date for weekly reminders
 * Finds the next occurrence based on selected days and time
 */
export function calculateDefaultStartDateForWeekly(hour: number, minute: number, days: number[]): Date {
  const now = new Date();
  const currentDay = now.getDay() + 1; // Convert to 1-7 (1=Sunday)
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Sort days to find the next one
  const sortedDays = [...days].sort((a, b) => a - b);
  
  // Check if today is one of the selected days and time hasn't passed
  if (sortedDays.includes(currentDay)) {
    if (hour > currentHour || (hour === currentHour && minute > currentMinute)) {
      // Time hasn't passed today, start today
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    }
  }
  
  // Find the next day in the list
  let daysToAdd = 1;
  for (let i = 1; i <= 7; i++) {
    const checkDay = ((currentDay - 1 + i) % 7) + 1; // Convert to 1-7
    if (sortedDays.includes(checkDay)) {
      daysToAdd = i;
      break;
    }
  }
  
  const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToAdd, hour, minute, 0, 0);
  return nextDate;
}

/**
 * Parse date string DD/MM/YYYY to Date with specified time
 */
export function parseDate(dateStr: string, hour: number, minute: number): Date | null {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31 || month < 0 || month > 11 || year < 2024) return null;

  const date = new Date(year, month, day, hour, minute);
  if (isNaN(date.getTime())) return null;

  return date;
}

/**
 * Parse optional start date from modal fields
 */
export function parseOptionalStartDate(
  interaction: ModalSubmitInteraction,
  fieldId: string, // Generic field ID
  hour: number,
  minute: number
): Date | undefined {
  try {
    const startDateValue = interaction.fields.getTextInputValue(fieldId)?.trim();
    if (!startDateValue) return undefined;
    
    return parseDate(startDateValue, hour, minute) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse days of week string (e.g., "2,3,4,5,6") to array
 * Returns null if invalid
 */
export function parseDaysOfWeek(daysStr: string): number[] | null {
  const parts = daysStr.split(',').map(s => s.trim());
  const days: number[] = [];

  for (const part of parts) {
    const day = parseInt(part, 10);
    if (isNaN(day) || day < 1 || day > 7) return null;
    if (!days.includes(day)) days.push(day);
  }

  if (days.length === 0) return null;
  return days.sort((a, b) => a - b);
}

/**
 * Format days of week for display
 */
export function formatDaysOfWeek(daysStr: string): string {
  const dayNames = ['', 'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const days = parseDaysOfWeek(daysStr);
  if (!days) return daysStr;
  
  return days.map(d => dayNames[d]).join(', ');
}

import { z } from 'zod';

/**
 * Discord snowflake ID schema
 */
export const snowflakeSchema = z.string().regex(/^\d{17,19}$/, 'Invalid Discord ID');

/**
 * URL schema with custom message
 */
export const urlSchema = z.url('Invalid URL format');
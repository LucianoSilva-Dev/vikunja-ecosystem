import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ILogger } from '../../../shared/types';
import type { WebhookValidationResult } from '../types';

export interface WebhookValidatorDeps {
  logger: ILogger;
  webhookSecret: string;
}

/**
 * Validates webhook signatures using HMAC SHA256
 */
export class WebhookValidator {
  private readonly logger: ILogger;
  private readonly secret: string;

  constructor(deps: WebhookValidatorDeps) {
    this.logger = deps.logger;
    this.secret = deps.webhookSecret;
  }

  /**
   * Validates the X-Vikunja-Signature header
   */
  validateSignature(
    payload: string,
    signature: string | undefined
  ): WebhookValidationResult {
    if (!signature) {
      this.logger.warn('Missing webhook signature');
      return { valid: false, error: 'Missing signature' };
    }

    try {
      const expectedSignature = createHmac('sha256', this.secret)
        .update(payload)
        .digest('hex');

      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (signatureBuffer.length !== expectedBuffer.length) {
        this.logger.warn('Invalid signature length');
        return { valid: false, error: 'Invalid signature' };
      }

      const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);

      if (!isValid) {
        this.logger.warn('Signature mismatch');
        return { valid: false, error: 'Invalid signature' };
      }

      return { valid: true };
    } catch (error) {
      this.logger.error('Signature validation error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { valid: false, error: 'Validation error' };
    }
  }
}

export function createWebhookValidator(
  deps: WebhookValidatorDeps
): WebhookValidator {
  return new WebhookValidator(deps);
}

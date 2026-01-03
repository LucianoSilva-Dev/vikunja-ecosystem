import type { ILogger } from '../../shared/types';
import type { UserMappingRepository } from '../../shared/repositories/user-mapping.repository';
import type { VikunjaApiService } from '../../shared/services/vikunja-api.service';
import type { VikunjaUser } from '../../shared/types/vikunja.types';

export interface AuthServiceDeps {
  logger: ILogger;
  userMappingRepository: UserMappingRepository;
  vikunjaApiService: VikunjaApiService;
}

export class AuthService {
  private readonly logger: ILogger;
  private readonly userMappingRepository: UserMappingRepository;
  private readonly vikunjaApiService: VikunjaApiService;

  constructor(deps: AuthServiceDeps) {
    this.logger = deps.logger;
    this.userMappingRepository = deps.userMappingRepository;
    this.vikunjaApiService = deps.vikunjaApiService;
  }

  /**
   * Connects a Discord user to a Vikunja user using credentials
   * Returns the connected Vikunja user
   */
  async connectUser(
    discordUserId: string,
    credentials: { username: string; password: string }
  ): Promise<VikunjaUser> {
    this.logger.info('Attempting to connect user', { discordUserId });

    try {
      // 1. Authenticate with Vikunja
      const token = await this.vikunjaApiService.authenticate(
        credentials.username,
        credentials.password
      );

      // 2. Get current user info
      const user = await this.vikunjaApiService.getCurrentUser(token);

      // 3. Save mapping
      await this.userMappingRepository.upsertMapping(
        user.id,
        user.username,
        discordUserId
      );

      this.logger.info('User connected successfully', {
        discordUserId,
        vikunjaUserId: user.id,
      });

      return user;
    } catch (error) {
      this.logger.error('Failed to connect user', {
        discordUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Disconnects a Discord user
   */
  async disconnectUser(discordUserId: string): Promise<boolean> {
    const removed = await this.userMappingRepository.removeMappingByDiscordId(
      discordUserId
    );

    if (removed) {
      this.logger.info('User disconnected', { discordUserId });
    }

    return removed;
  }

  /**
   * Checks if a Discord user is already connected
   */
  async isUserConnected(discordUserId: string): Promise<boolean> {
    const vikunjaUserId = await this.userMappingRepository.findVikunjaUserId(
      discordUserId
    );
    return vikunjaUserId !== null;
  }
}

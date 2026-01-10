/**
 * Digest Feature Module
 */

// Repositories
export {
  DigestRepository,
  createDigestRepository,
  type DigestRepositoryDeps,
  type DigestRecord,
} from './repositories/digest.repository';

// Services
export {
  DigestService,
  createDigestService,
  type DigestServiceDeps,
} from './services/digest.service';

// Commands
export {
  DIGEST_COMMAND_NAME,
  digestCommandData,
  DIGEST_CUSTOM_IDS,
} from './commands/digest.command';

// Handlers
export {
  handleDigestAdd,
  handleDigestProjectSelect,
  handleDigestChannelSelect,
} from './handlers/digest-add.handler';

export {
  DIGEST_TYPE_SELECT_CUSTOM_ID,
  DIGEST_CONFIG_MODAL_PREFIX,
  DIGEST_TYPES,
  type DigestType,
  type DigestTypeSelectHandlerDeps,
  canHandleDigestTypeSelect,
  canHandleDigestConfigModal,
  showDigestTypeSelect,
  handleDigestTypeSelect,
} from './handlers/digest-type-select.handler';

export {
  canHandleDigestModal,
  handleDigestModalSubmit,
  type DigestModalHandlerDeps,
} from './handlers/digest-modal.handler';

export { handleDigestList } from './handlers/digest-list.handler';

export {
  handleDigestRemove,
  handleDigestRemoveInteraction,
  DIGEST_REMOVE_IDS,
} from './handlers/digest-remove.handler';

export {
  DIGEST_PRIORITY_SELECT_CUSTOM_ID,
  canHandleDigestPrioritySelect,
  showDigestPrioritySelect,
  handleDigestPrioritySelect,
  type DigestPrioritySelectHandlerDeps,
} from './handlers/digest-priority-select.handler';

export { handleListProjects } from './list.handler';
export type { ListProjectsHandlerDeps } from './list.handler';

export { 
  handleAddProject,
  handleAddProjectSelect,
  handleAddChannelSelect,
  handleAddEventButton,
  handleAddEventSelectAll,
  handleAddEventConfirm,
  ADD_PROJECT_CUSTOM_IDS,
} from './add.handler';
export type { AddProjectHandlerDeps } from './add.handler';

export { 
  handleRemoveProject,
  handleRemoveChannelSelect,
  handleRemoveProjectSelect,
  REMOVE_PROJECT_CUSTOM_IDS,
} from './remove.handler';
export type { RemoveProjectHandlerDeps } from './remove.handler';

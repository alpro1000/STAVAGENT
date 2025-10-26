import { useMemo } from 'react';
import {
  getProjects,
  getProject,
  createProject,
  uploadFiles,
  sendChatMessage,
  triggerAction,
  getProjectResults,
  getProjectStatus,
  getProjectFiles,
  getWorkflowAParsedPositions,
  generateWorkflowATechCard,
  generateWorkflowATov,
  generateWorkflowAMaterials,
  getWorkflowBPositions,
  generateWorkflowBTechCard,
  generateWorkflowBTov,
} from '../utils/api';

export function useAPI() {
  return useMemo(
    () => ({
      getProjects,
      getProject,
      createProject,
      uploadFiles,
      sendChatMessage,
      triggerAction,
      getProjectResults,
      getProjectStatus,
      getProjectFiles,
      getWorkflowAParsedPositions,
      generateWorkflowATechCard,
      generateWorkflowATov,
      generateWorkflowAMaterials,
      getWorkflowBPositions,
      generateWorkflowBTechCard,
      generateWorkflowBTov,
    }),
    [],
  );
}

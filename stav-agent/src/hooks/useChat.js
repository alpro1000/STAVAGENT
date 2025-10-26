import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { sendChatMessage, triggerAction } from '../utils/api';

export const useChat = () => {
  const {
    messages,
    addMessage,
    isLoading,
    setIsLoading,
    selectedArtifact,
    setSelectedArtifact,
  } = useAppStore();

  const sendMessage = useCallback(
    async (projectId, message) => {
      if (!projectId || !message || !message.trim() || isLoading) return;

      addMessage({ type: 'user', text: message });
      setIsLoading(true);

      try {
        const result = await sendChatMessage(projectId, message.trim());
        addMessage({
          type: 'ai',
          text: result.response || 'Žádná odpověď',
        });
        if (result.artifact) {
          setSelectedArtifact(result.artifact);
        }
      } catch (error) {
        addMessage({
          type: 'ai',
          text: 'Chyba: ' + (error.response?.data?.error || error.message),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, addMessage, setIsLoading, setSelectedArtifact]
  );

  const performAction = useCallback(
    async (projectId, descriptor = {}) => {
      const {
        apiAction,
        action: explicitAction,
        label,
        options,
        freeFormQuery,
        positionId,
      } = descriptor;

      const action = explicitAction || apiAction;

      if (!projectId || !action || isLoading) return;

      setIsLoading(true);
      try {
        const result = await triggerAction({
          projectId,
          action,
          options,
          positionId,
          freeFormQuery,
        });
        addMessage({
          type: 'ai',
          text:
            result.response ||
            (label ? `Akce ${label} dokončena` : 'Akce dokončena'),
        });
        if (result.artifact) {
          setSelectedArtifact(result.artifact);
        }
      } catch (error) {
        addMessage({
          type: 'ai',
          text: 'Chyba akce: ' + (error.response?.data?.error || error.message),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, addMessage, setIsLoading, setSelectedArtifact]
  );

  return { messages, sendMessage, performAction, isLoading, selectedArtifact };
};

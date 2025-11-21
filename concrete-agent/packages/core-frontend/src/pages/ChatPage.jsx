import React, { useState, useEffect, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useAppStore } from '../store/appStore';
import { useChat } from '../hooks/useChat';
import {
  getProjects,
  uploadProject,
  uploadFiles,
  getProjectResults,
  getProjectStatus,
  getProjectFiles,
  normalizeChat,
} from '../utils/api';
import { QUICK_ACTIONS, MESSAGE_TYPES } from '../utils/constants';

import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import QuickActions from '../components/chat/QuickActions';
import InputArea from '../components/chat/InputArea';
import ArtifactPanel from '../components/layout/ArtifactPanel';
import UploadProjectModal from '../components/common/UploadProjectModal';

export default function ChatPage() {
  const [projects, setProjects] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [projectStatus, setProjectStatus] = useState(null);
  const [projectFiles, setProjectFiles] = useState([]);
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const fileInputRef = React.useRef(null);

  const {
    addMessage,
    currentProject,
    setCurrentProject,
    setSelectedArtifact,
    setIsLoading,
    sidebarOpen,
    setSidebarOpen,
    clearMessages,
  } = useAppStore();
  const { messages, sendMessage, performAction, isLoading, selectedArtifact } = useChat();

  const isBusy = isLoading || isProjectLoading;

  const loadProjects = useCallback(async () => {
    try {
      const res = await getProjects();
      setProjects(res.data?.projects || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const projectId = currentProject?.project_id ?? currentProject?.id;

    if (!projectId) {
      clearMessages();
      setSelectedArtifact(null);
      setProjectStatus(null);
      setProjectFiles([]);
      setIsProjectLoading(false);
      return;
    }

    clearMessages();
    setSelectedArtifact(null);
    setProjectStatus(null);
    setProjectFiles([]);

    let cancelled = false;
    const projectName = currentProject?.project_name ?? currentProject?.name ?? projectId;

    addMessage({
      type: MESSAGE_TYPES.SYSTEM,
      text: `Projekt ${projectName} vybrán. Načítám data...`,
    });

    const fetchProjectContext = async () => {
      setIsProjectLoading(true);
      try {
        const [statusResult, resultsResult, filesResult] = await Promise.allSettled([
          getProjectStatus(projectId),
          getProjectResults(projectId),
          getProjectFiles(projectId),
        ]);

        if (cancelled) return;

        if (statusResult.status === 'fulfilled') {
          const status = statusResult.value?.data?.status;
          if (status) {
            setProjectStatus(status);
            addMessage({
              type: MESSAGE_TYPES.SYSTEM,
              text: `Status projektu: ${status}`,
            });
          }
        } else {
          console.error('Failed to load project status:', statusResult.reason);
        }

        if (resultsResult.status === 'fulfilled') {
          const resultsData = resultsResult.value?.data;
          if (resultsData?.artifact) {
            setSelectedArtifact(resultsData.artifact);
          } else if (resultsData && Object.keys(resultsData).length > 0) {
            addMessage({
              type: MESSAGE_TYPES.SYSTEM,
              text: 'Výsledky projektu načteny.',
            });
          }
        } else {
          console.error('Failed to load project results:', resultsResult.reason);
        }

        if (filesResult.status === 'fulfilled') {
          const files = filesResult.value?.data?.files || [];
          setProjectFiles(files);
          if (files.length > 0) {
            addMessage({
              type: MESSAGE_TYPES.SYSTEM,
              text: `Načteno ${files.length} souborů projektu.`,
            });
          }
        } else {
          console.error('Failed to load project files:', filesResult.reason);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load project context:', error);
          addMessage({
            type: MESSAGE_TYPES.SYSTEM,
            text: `Chyba načítání projektu: ${error.message}`,
          });
        }
      } finally {
        if (!cancelled) {
          setIsProjectLoading(false);
        }
      }
    };

    fetchProjectContext();

    return () => {
      cancelled = true;
    };
  }, [
    currentProject,
    addMessage,
    clearMessages,
    setSelectedArtifact,
  ]);

  const handleSendMessage = useCallback(
    (text) => {
      if (isBusy) return;
      const projectId = currentProject?.project_id ?? currentProject?.id;
      if (!projectId) return;

      sendMessage(projectId, text);
    },
    [currentProject, sendMessage, isBusy]
  );

  const handleQuickAction = useCallback(
    (actionType) => {
      if (!actionType || isBusy) return;
      const projectId = currentProject?.project_id ?? currentProject?.id;
      if (!projectId) return;

      const quickAction = QUICK_ACTIONS.find(
        (item) => item.apiAction === actionType || item.id === actionType
      );

      if (!quickAction) return;

      // Handle prompt-type buttons (show examples, don't call API)
      if (quickAction.type === 'prompt') {
        addMessage({
          type: 'system',
          text: quickAction.promptMessage,
        });
        if (quickAction.examples && quickAction.examples.length > 0) {
          const examplesText = quickAction.examples
            .map((ex, i) => `${i + 1}. "${ex}"`)
            .join('\n');
          addMessage({
            type: 'system',
            text: `Příklady:\n${examplesText}`,
          });
        }
        return;
      }

      // Handle action-type buttons (call API immediately)
      const label = quickAction?.label || actionType;
      addMessage({
        type: 'user',
        text: `Akce: ${label}`,
      });
      performAction(projectId, { ...quickAction, label });
    },
    [addMessage, currentProject, performAction, isBusy]
  );

  const handleFileUpload = useCallback(
    async (files) => {
      const projectId = currentProject?.project_id ?? currentProject?.id;
      if (!projectId || !files.length || isBusy) return;

      setIsLoading(true);
      try {
        const res = await uploadFiles(projectId, Array.from(files), setUploadProgress);
        const payload = normalizeChat(res.data);

        addMessage({
          type: 'ai',
          text: payload.response || 'Soubory nahrány.',
        });

        if (payload.artifact) {
          setSelectedArtifact(payload.artifact);
        }
      } catch (error) {
        console.error('Upload error:', error);
        addMessage({
          type: 'ai',
          text: 'Chyba: Nahrávání selhalo.',
        });
      } finally {
        setIsLoading(false);
        setUploadProgress(null);
      }
    },
    [
      addMessage,
      currentProject,
      isBusy,
      setIsLoading,
      setSelectedArtifact,
    ]
  );

  const handleUploadProject = useCallback(async ({ projectName, workflow, files }) => {
    if (isBusy) return;

    setIsLoading(true);
    setUploadProgress(0);

    try {
      addMessage({
        type: MESSAGE_TYPES.SYSTEM,
        text: `Nahrávám projekt "${projectName}"...`,
      });

      const res = await uploadProject(projectName, workflow, files, setUploadProgress);
      const newProject = res.data;

      console.log('✅ Project uploaded:', newProject);

      addMessage({
        type: MESSAGE_TYPES.SYSTEM,
        text: `Projekt "${projectName}" nahrán. Spouštím zpracování...`,
      });

      // Обновляем список проектов
      await loadProjects();

      // Выбираем новый проект
      setCurrentProject(newProject);

    } catch (error) {
      console.error('Upload project error:', error);
      addMessage({
        type: MESSAGE_TYPES.SYSTEM,
        text: `Chyba nahrávání: ${error.response?.data?.detail || error.message}`,
      });
    } finally {
      setIsLoading(false);
      setUploadProgress(null);
    }
  }, [isBusy, addMessage, loadProjects, setCurrentProject, setIsLoading]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <Header
        onUploadProject={() => setShowUploadModal(true)}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        currentProject={currentProject}
        projectStatus={projectStatus}
      />

      <UploadProjectModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUploadProject}
      />

      <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        {sidebarOpen && (
          <>
            <Panel defaultSize={20} minSize={15} maxSize={35}>
              <Sidebar
                isOpen={sidebarOpen}
                onToggle={() => setSidebarOpen(!sidebarOpen)}
                projects={projects}
                onSelectProject={setCurrentProject}
                currentProject={currentProject}
                projectFiles={projectFiles}
              />
            </Panel>
            <PanelResizeHandle className="w-1 bg-gray-300 hover:bg-blue-500 transition cursor-col-resize" />
          </>
        )}

        <Panel defaultSize={selectedArtifact ? 50 : 80} minSize={30}>
          <div className="h-full flex flex-col overflow-hidden">
            <ChatWindow messages={messages} isLoading={isLoading} />
            {currentProject && (
              <QuickActions onAction={handleQuickAction} isLoading={isBusy} />
            )}
            <InputArea
              onSend={handleSendMessage}
              onUpload={() => fileInputRef.current?.click()}
              isLoading={isBusy}
              uploadProgress={uploadProgress}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => handleFileUpload(e.target.files)}
              accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg,.dwg"
            />
          </div>
        </Panel>

        {selectedArtifact && (
          <>
            <PanelResizeHandle className="w-1 bg-gray-300 hover:bg-blue-500 transition cursor-col-resize" />
            <Panel defaultSize={30} minSize={20} maxSize={50}>
              <ArtifactPanel artifact={selectedArtifact} isLoading={isBusy} />
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  );
}

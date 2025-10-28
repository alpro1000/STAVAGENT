import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { useChat } from '../hooks/useChat';
import {
  getProjects,
  createProject,
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

export default function ChatPage() {
  const [projects, setProjects] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [projectStatus, setProjectStatus] = useState(null);
  const [projectFiles, setProjectFiles] = useState([]);
  const [isProjectLoading, setIsProjectLoading] = useState(false);
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
      const label = quickAction?.label || actionType;
      addMessage({
        type: 'user',
        text: `Akce: ${label}`,
      });
      if (quickAction) {
        performAction(projectId, { ...quickAction, label });
      } else {
        performAction(projectId, { action: actionType, label });
      }
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

  const handleNewProject = useCallback(async () => {
    const name = prompt('Název nového projektu:');
    if (!name || !name.trim()) return;

    console.log('Create project:', name);

    try {
      const res = await createProject(name.trim());
      const newProject = res.data;

      console.log('✅ Project created:', newProject);

      // Обновляем список проектов
      await loadProjects();

      // Выбираем новый проект
      setCurrentProject(newProject);

      addMessage({
        type: MESSAGE_TYPES.SYSTEM,
        text: `Projekt "${name}" vytvořen. ID: ${newProject.project_id || newProject.id}`,
      });
    } catch (error) {
      console.error('Failed to create project:', error);
      addMessage({
        type: MESSAGE_TYPES.SYSTEM,
        text: `Chyba při vytváření projektu: ${error.message}`,
      });
    }
  }, [loadProjects, setCurrentProject, addMessage]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <Header
        onNewProject={handleNewProject}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        currentProject={currentProject}
        projectStatus={projectStatus}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          projects={projects}
          onSelectProject={setCurrentProject}
          currentProject={currentProject}
          projectFiles={projectFiles}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
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

        <ArtifactPanel artifact={selectedArtifact} isLoading={isBusy} />
      </div>
    </div>
  );
}

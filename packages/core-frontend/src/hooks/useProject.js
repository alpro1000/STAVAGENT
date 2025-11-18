import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  getProjects,
  getProject,
  createProject,
  uploadFiles,
} from '../utils/api';
import { useAppStore } from '../store/appStore';

export function useProjects() {
  const queryClient = useQueryClient();
  const { setCurrentProject } = useAppStore();

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await getProjects();
      return response.data.projects ?? [];
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (name) => {
      const response = await createProject(name);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const selectProject = async (project) => {
    setCurrentProject(project);
    if (!project?.project_id && project?.id) {
      try {
        const response = await getProject(project.id);
        setCurrentProject(response.data);
      } catch (error) {
        console.error('Failed to fetch project', error);
      }
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async ({ projectId, files }) => {
      const response = await uploadFiles(projectId, files);
      return response.data;
    },
  });

  useEffect(() => {
    if (!projectsQuery.isFetching && projectsQuery.data?.length) {
      setCurrentProject(projectsQuery.data[0]);
    }
  }, [projectsQuery.isFetching, projectsQuery.data, setCurrentProject]);

  return {
    projectsQuery,
    createProject: createProjectMutation,
    selectProject,
    uploadMutation,
  };
}

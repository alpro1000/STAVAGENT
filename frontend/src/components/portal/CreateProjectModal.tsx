/**
 * Create Project Modal
 *
 * Modal for creating a new Portal project
 */

import { useState } from 'react';
import { X } from 'lucide-react';

interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (data: {
    project_name: string;
    project_type: string;
    description?: string;
  }) => Promise<void>;
}

export default function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
  const [formData, setFormData] = useState({
    project_name: '',
    project_type: 'custom',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectTypes = [
    { value: 'bridge', label: 'Bridge 🌉', description: 'Bridge or overpass construction' },
    { value: 'building', label: 'Building 🏢', description: 'Residential or commercial building' },
    { value: 'road', label: 'Road 🛣️', description: 'Road or highway construction' },
    { value: 'parking', label: 'Parking 🅿️', description: 'Parking garage or lot' },
    { value: 'custom', label: 'Custom 📋', description: 'Other construction type' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.project_name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setLoading(true);
      await onCreate({
        project_name: formData.project_name.trim(),
        project_type: formData.project_type,
        description: formData.description.trim() || undefined
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Create New Project</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Project Name */}
          <div>
            <label htmlFor="project_name" className="block text-sm font-medium text-gray-700">
              Project Name *
            </label>
            <input
              type="text"
              id="project_name"
              value={formData.project_name}
              onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="e.g., Bridge SO201"
              disabled={loading}
              required
            />
          </div>

          {/* Project Type */}
          <div>
            <label htmlFor="project_type" className="block text-sm font-medium text-gray-700">
              Project Type *
            </label>
            <select
              id="project_type"
              value={formData.project_type}
              onChange={(e) => setFormData({ ...formData, project_type: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              disabled={loading}
            >
              {projectTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">
              {projectTypes.find(t => t.value === formData.project_type)?.description}
            </p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Optional project description..."
              disabled={loading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

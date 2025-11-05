'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/ui/file-upload';
import { uploadProject } from '@/lib/api';
import { WORKFLOW_CONFIG } from '@/lib/constants';

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 1 | 2 | 3;

export function CreateProjectModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateProjectModalProps) {
  const [step, setStep] = React.useState<Step>(1);
  const [projectName, setProjectName] = React.useState('');
  const [workflow, setWorkflow] = React.useState<'A' | 'B' | null>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const resetForm = () => {
    setStep(1);
    setProjectName('');
    setWorkflow(null);
    setFiles([]);
    setUploading(false);
    setUploadProgress(0);
    setError(null);
  };

  const handleClose = () => {
    if (!uploading) {
      resetForm();
      onOpenChange(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && !projectName.trim()) {
      setError('Project name is required');
      return;
    }
    if (step === 2 && !workflow) {
      setError('Please select a workflow');
      return;
    }

    setError(null);
    setStep((prev) => Math.min(prev + 1, 3) as Step);
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1) as Step);
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      setError('Please upload at least one file');
      return;
    }

    if (!workflow) {
      setError('Workflow not selected');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      await uploadProject(
        projectName,
        workflow,
        files,
        (progress) => setUploadProgress(progress)
      );

      // Success!
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err?.response?.data?.detail || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Step {step} of 3: {step === 1 && 'Project Details'}
            {step === 2 && 'Select Workflow'}
            {step === 3 && 'Upload Files'}
          </DialogDescription>
        </DialogHeader>

        {/* Step Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-16 rounded-full transition-colors ${
                s === step
                  ? 'bg-primary'
                  : s < step
                  ? 'bg-primary/60'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Project Name */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                placeholder="e.g. Residential Building 5-Floor"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-gray-500">
                Enter a descriptive name for your construction project
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Workflow Selection */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Choose the workflow that matches your needs:
            </p>

            <div className="grid grid-cols-2 gap-4">
              {/* Workflow A */}
              <button
                className={`flex flex-col items-start p-4 border-2 rounded-lg transition-all ${
                  workflow === 'A'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setWorkflow('A')}
              >
                <span className="text-2xl mb-2">
                  {WORKFLOW_CONFIG.A.icon}
                </span>
                <h3 className="font-semibold mb-1">
                  {WORKFLOW_CONFIG.A.label}
                </h3>
                <p className="text-xs text-gray-600 text-left">
                  {WORKFLOW_CONFIG.A.description}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Upload: Excel (.xlsx, .xls)
                </p>
              </button>

              {/* Workflow B */}
              <button
                className={`flex flex-col items-start p-4 border-2 rounded-lg transition-all ${
                  workflow === 'B'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setWorkflow('B')}
              >
                <span className="text-2xl mb-2">
                  {WORKFLOW_CONFIG.B.icon}
                </span>
                <h3 className="font-semibold mb-1">
                  {WORKFLOW_CONFIG.B.label}
                </h3>
                <p className="text-xs text-gray-600 text-left">
                  {WORKFLOW_CONFIG.B.description}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Upload: PDF, DWG, Images
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: File Upload */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-3">
                Upload files for <strong>{projectName}</strong> (
                {workflow === 'A' ? 'Workflow A' : 'Workflow B'})
              </p>

              <FileUpload
                accept={
                  workflow === 'A'
                    ? '.xlsx,.xls'
                    : '.pdf,.dwg,.png,.jpg,.jpeg'
                }
                onFilesSelect={setFiles}
                disabled={uploading}
              />

              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium">Selected files:</p>
                  {files.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                    >
                      <span className="truncate">{file.name}</span>
                      <span className="text-gray-500 text-xs ml-2">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Footer Actions */}
        <DialogFooter>
          {step > 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={uploading}
            >
              Back
            </Button>
          )}

          {step < 3 ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={uploading || files.length === 0}>
              {uploading ? 'Uploading...' : 'Create Project'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UpdateProjectData {
  title?: string;
  videoTitle?: string;
  description?: string;
  videoDescription?: string;
  keywords?: string[];
  visibility?: string;
  thumbnail?: string;
  instructions?: string;
  projectType?: string;
  dueDate?: string | null;
}

interface UpdatePermissionData {
  fullAccess?: boolean;
  uploadAccess?: boolean;
  downloadAccess?: boolean;
  shareAccess?: boolean;
}

interface UpdateProjectRequest {
  projectData: UpdateProjectData;
  permissionData: UpdatePermissionData;
}

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  [key: string]: string;
}

export interface MarkdownFile {
  id: string;
  name: string;
  content: string;
  matchingFolderId?: string;
  status: 'pending' | 'in-progress' | 'completed';
}

export interface JsonFile {
  id: string;
  name: string;
  content: any;
  folderId: string;
  edited: boolean;
  approved: boolean;
}

export interface JsonFolder {
  id: string;
  name: string;
  files: JsonFile[];
  matchingMarkdownId?: string;
  progress: number;
}

export interface FileState {
  markdownFiles: MarkdownFile[];
  jsonFolders: JsonFolder[];
  isLoading: boolean;
  error: string | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  serviceAccount: ServiceAccount | null;
  isLoading: boolean;
  error: string | null;
}
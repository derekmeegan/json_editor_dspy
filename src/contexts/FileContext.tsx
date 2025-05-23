import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from 'react';
import {
  MarkdownFile,
  JsonFolder,
  JsonFile,
  FileState,
} from '../types';
import {
  fetchMarkdownFiles,
  fetchJsonFolders,
  fetchFileContent,          //  ← NEW
  matchFilesWithFolders,
  saveJsonFile,
  clearCache,
  fetchResultFiles,
  ResultFolder,
} from '../services/driveService';
import { useAuth } from './AuthContext';

/* ------------------------------------------------------------------ */
/* context setup                                                      */
/* ------------------------------------------------------------------ */
interface FileContextProps {
  fileState: FileState;
  loadFiles: (forceRefresh?: boolean) => Promise<void>;
  updateJsonFile: (jsonFile: JsonFile, content: any) => void;
  approveJsonFile: (jsonFile: JsonFile) => void;
  saveToResults: (jsonFile: JsonFile, folderName: string) => Promise<void>;
  getMarkdownFile: (id: string) => MarkdownFile | undefined;
  getJsonFolder: (id: string) => JsonFolder | undefined;
}

const initialState: FileState = {
  markdownFiles: [],
  jsonFolders: [],
  isLoading: false,
  error: null,
};

const FileContext = createContext<FileContextProps>({
  fileState: initialState,
  loadFiles: async () => {},
  updateJsonFile: () => {},
  approveJsonFile: () => {},
  saveToResults: async () => {},
  getMarkdownFile: () => undefined,
  getJsonFolder: () => undefined,
});

/* ------------------------------------------------------------------ */
/* provider                                                           */
/* ------------------------------------------------------------------ */
export const FileProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [fileState, setFileState] = useState<FileState>(initialState);
  const { authState } = useAuth();

  /* ------------------------- load files ---------------------------- */
  const loadFiles = useCallback(
    async (forceRefresh = false) => {
      if (!authState.isAuthenticated) return;

      setFileState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        if (forceRefresh) await clearCache();

        const [markdownFiles, jsonFolders, resultFolders] = await Promise.all([
          fetchMarkdownFiles(),
          fetchJsonFolders(),
          fetchResultFiles(),
        ]);

        const { matchedMarkdownFiles, matchedJsonFolders } =
          matchFilesWithFolders(markdownFiles, jsonFolders);

        const updatedMarkdownFiles = determineFileStatuses(
          matchedMarkdownFiles,
          matchedJsonFolders,
          resultFolders
        );

        setFileState({
          markdownFiles: updatedMarkdownFiles,
          jsonFolders: matchedJsonFolders,
          isLoading: false,
          error: null,
        });
      } catch (e) {
        console.error('Error loading files:', e);
        setFileState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to load files. Please try again.',
        }));
      }
    },
    [authState.isAuthenticated]
  );

  /* --------------------- json file updates ------------------------- */
  const updateJsonFile = useCallback((jsonFile: JsonFile, content: any) => {
    setFileState(prev => {
      const updatedFolders = prev.jsonFolders.map(folder =>
        folder.id === jsonFile.folderId
          ? {
              ...folder,
              files: folder.files.map(file =>
                file.id === jsonFile.id
                  ? { ...file, content, edited: true }
                  : file
              ),
              progress: calcProgress(
                folder.files.map(file =>
                  file.id === jsonFile.id
                    ? { ...file, content, edited: true }
                    : file
                )
              ),
            }
          : folder
      );
      return { ...prev, jsonFolders: updatedFolders };
    });
  }, []);

  const approveJsonFile = useCallback((jsonFile: JsonFile) => {
    setFileState(prev => {
      const updatedFolders = prev.jsonFolders.map(folder =>
        folder.id === jsonFile.folderId
          ? {
              ...folder,
              files: folder.files.map(file =>
                file.id === jsonFile.id
                  ? { ...file, approved: true }
                  : file
              ),
              progress: calcProgress(
                folder.files.map(file =>
                  file.id === jsonFile.id
                    ? { ...file, approved: true }
                    : file
                )
              ),
            }
          : folder
      );

      const updatedMarkdownFiles = prev.markdownFiles.map(md => {
        const match = updatedFolders.find(f => f.id === md.matchingFolderId);
        if (!match) return md;
        return {
          ...md,
          status:
            match.progress === 100
              ? 'completed'
              : match.progress > 0
              ? 'in-progress'
              : 'pending',
        };
      });

      return {
        ...prev,
        jsonFolders: updatedFolders,
        markdownFiles: updatedMarkdownFiles,
      };
    });
  }, []);

  /* ------------------------- save file ----------------------------- */
  const saveToResults = useCallback(
    async (jsonFile: JsonFile, folderName: string) => {
      console.log('FileContext.saveToResults called with:', { jsonFile, folderName });
      
      if (!authState.isAuthenticated) {
        console.error('Not authenticated, cannot save');
        return;
      }

      try {
        let fileToSave = jsonFile;
        console.log('Initial fileToSave:', fileToSave);

        // ① ensure we have content
        if (fileToSave.content === undefined) {
          console.log('No content, fetching from Drive');
          const raw = await fetchFileContent(fileToSave.id);
          const parsed = JSON.parse(raw);
          fileToSave = { ...fileToSave, content: parsed };
          updateJsonFile(fileToSave, parsed); // sync into state
          console.log('Updated fileToSave with fetched content:', fileToSave);
        } else {
          console.log('Using provided content:', fileToSave.content);
        }

        // ② push to Drive
        console.log('Saving to Drive with:', fileToSave);
        await saveJsonFile(fileToSave, folderName);
        console.log('Successfully saved to Drive');

        // ③ refresh cache & mark approved
        console.log('Clearing cache and marking as approved');
        await clearCache();
        approveJsonFile(fileToSave);
        console.log('File has been approved');
      } catch (e) {
        console.error('Error saving file to results:', e);
        setFileState(prev => ({
          ...prev,
          error: 'Failed to save file to results folder. Please try again.',
        }));
      }
    },
    [authState.isAuthenticated, approveJsonFile, updateJsonFile]
  );

  /* ------------------------ selectors ------------------------------ */
  const getMarkdownFile = useCallback(
    (name: string) => fileState.markdownFiles.find(f => f.name === name),
    [fileState.markdownFiles]
  );

  const getJsonFolder = useCallback(
    (id: string) => fileState.jsonFolders.find(f => f.id === id),
    [fileState.jsonFolders]
  );

  /* ---------------------- helper utils ----------------------------- */
  const calcProgress = (files: JsonFile[]) =>
    files.length
      ? (files.filter(f => f.approved).length / files.length) * 100
      : 0;

  const determineFileStatuses = (
    markdownFiles: MarkdownFile[],
    jsonFolders: JsonFolder[],
    resultFolders: ResultFolder[]
  ) =>
    markdownFiles.map(md => {
      const folder = jsonFolders.find(f => f.id === md.matchingFolderId);
      if (!folder) return { ...md, status: 'pending' as const };

      const mdBase = md.name.replace(/\.md$/, '');
      const resultFolder = resultFolders.find(r =>
        mdBase.includes(r.folderName)
      );

      if (!resultFolder) {
        const edited = folder.files.some(f => f.edited);
        return { ...md, status: edited ? 'in-progress' : 'pending' };
      }

      const jsonNames = folder.files.map(f => f.name);
      const resultNames = resultFolder.files.map(f => f.name);
      const completed = jsonNames.filter(n => resultNames.includes(n)).length;

      const progress = jsonNames.length
        ? (completed / jsonNames.length) * 100
        : 0;
      folder.progress = progress;

      return {
        ...md,
        status:
          completed === 0
            ? 'pending'
            : completed < jsonNames.length
            ? 'in-progress'
            : 'completed',
      };
    });

  /* ------------------------- auto load ----------------------------- */
  useEffect(() => {
    if (authState.isAuthenticated) loadFiles(false);
  }, [authState.isAuthenticated, loadFiles]);

  /* ------------------------- provider ------------------------------ */
  return (
    <FileContext.Provider
      value={{
        fileState,
        loadFiles,
        updateJsonFile,
        approveJsonFile,
        saveToResults,
        getMarkdownFile,
        getJsonFolder,
      }}
    >
      {children}
    </FileContext.Provider>
  );
};

/* ------------------------------------------------------------------ */
/* hook                                                               */
/* ------------------------------------------------------------------ */
export const useFiles = () => useContext(FileContext);
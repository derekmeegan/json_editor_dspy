import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, FileText, Database, CheckCircle } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useFiles } from '../contexts/FileContext';
import MarkdownViewer from './MarkdownViewer';
import JsonEditor, { JsonEditorRef } from './JsonEditor';

import { JsonFile } from '../types';
import { fetchFileContent, fetchResultFiles } from '../services/driveService';

const EditorPage: React.FC = () => {
  const { markdownName } = useParams<{ markdownName: string }>();
  const navigate = useNavigate();

  const { authState } = useAuth();
  const { 
    fileState, 
    getMarkdownFile, 
    getJsonFolder, 
    updateJsonFile, 
    saveToResults
  } = useFiles();

  const [selectedJsonFile, setSelectedJsonFile] = useState<JsonFile | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [loadingMd, setLoadingMd] = useState(false);
  const [loadingJson, setLoadingJson] = useState(false);
  const [resultFiles, setResultFiles] = useState<Array<{id: string; name: string; folderName: string;}>>([]);
  // Keep track of which files have result versions (without making them read-only)
  const [filesWithResults, setFilesWithResults] = useState<Set<string>>(new Set());
  const jsonEditorRef = useRef<JsonEditorRef>(null);

  // Auth and param guard
  useEffect(() => {
    if (!authState.isAuthenticated) {
      navigate('/auth');
      return;
    }
    if (!markdownName) {
      navigate('/');
    }
  }, [authState.isAuthenticated, markdownName, navigate]);

  if (!authState.isAuthenticated || !markdownName) return null;

  // Markdown file handling
  const markdownFile = getMarkdownFile(markdownName);
  
  // JSON folder & content handling
  const jsonFolder = markdownFile?.matchingFolderId
    ? getJsonFolder(markdownFile.matchingFolderId)
    : undefined;

  // Reset state when the markdown file changes
  useEffect(() => {
    // Clear selected JSON file when markdown file changes
    setSelectedJsonFile(null);
    setLoadingJson(false);
    // Also clear the set of files with results
    setFilesWithResults(new Set());
  }, [markdownName]);

  // Load result files when the JSON folder changes
  useEffect(() => {
    async function loadResultFilesData() {
      if (!jsonFolder) {
        // If there's no JSON folder, reset the state
        setFilesWithResults(new Set());
        return;
      }
      
      try {
        console.log(`Looking for result folder matching: ${jsonFolder.name}`);
        
        // Get all result folders
        const allResultFolders = await fetchResultFiles();
        
        // Store all result files for reference with their folder names
        const allFiles = allResultFolders.flatMap(folder => 
          folder.files.map(file => ({
            ...file,
            folderName: folder.folderName
          }))
        );
        setResultFiles(allFiles);
        
        // Find the specific result folder that matches this JSON folder
        const matchingResultFolder = allResultFolders.find(
          folder => folder.folderName === jsonFolder.name
        );
        
        if (matchingResultFolder) {
          console.log(`Found matching result folder: ${matchingResultFolder.folderName} with ${matchingResultFolder.files.length} files`);
          
          // Update the set of files with results
          const fileNamesWithResults = new Set(
            matchingResultFolder.files.map(file => file.name)
          );
          
          setFilesWithResults(fileNamesWithResults);
        } else {
          console.log(`No matching result folder found for: ${jsonFolder.name}`);
          setFilesWithResults(new Set());
        }
      } catch (error) {
        console.error('Error loading result files:', error);
        setFilesWithResults(new Set());
      }
    }
    
    if (authState.isAuthenticated) {
      loadResultFilesData();
    }
  }, [authState.isAuthenticated, jsonFolder]);

  useEffect(() => {
    if (!markdownFile) return;

    // Load markdown body if not already present
    if (!markdownFile.content && !loadingMd) {
      setLoadingMd(true);
      fetchFileContent(markdownFile.id)
        .then(txt => setMarkdownContent(txt))
        .catch(console.error)
        .finally(() => setLoadingMd(false));
    } else if (markdownFile.content) {
      setMarkdownContent(markdownFile.content);
    }
  }, [markdownFile, loadingMd]);

  if (!markdownFile) {
    return (
      <div className="p-6 bg-red-50 border border-red-300 rounded-md text-red-700">
        Markdown file not found.&nbsp;
        <button onClick={() => navigate('/')} className="underline">Go back</button>
      </div>
    );
  }

  // Check if a result file exists for the selected JSON file
  const findMatchingResultFile = useCallback(async (fileName: string): Promise<JsonFile | null> => {
    if (!jsonFolder) return null;
    
    try {
      // Look for a matching result file in the current JSON folder only
      const matchingResultFile = resultFiles.find(file => 
        file.name === fileName && file.folderName === jsonFolder.name
      );
      
      if (matchingResultFile) {
        console.log(`Found matching result file: ${fileName} in folder: ${jsonFolder.name}`);
        
        // Fetch the content of the result file
        try {
          const content = await fetchFileContent(matchingResultFile.id)
            .then(text => JSON.parse(text));
            
          return {
            id: matchingResultFile.id,
            name: matchingResultFile.name,
            content,
            folderId: '', // Not important for result files
            edited: false,
            approved: false // Keep it editable
          };
        } catch (error) {
          console.error('Error fetching result file content:', error);
        }
      }
      
      console.log(`No matching result file found for: ${fileName} in folder: ${jsonFolder.name}`);
      return null;
    } catch (error) {
      console.error('Error finding matching result file:', error);
      return null;
    }
  }, [resultFiles, jsonFolder]);

  const handleJsonFileSelect = useCallback(async (file: JsonFile): Promise<void> => {
    // First, set the file so the UI shows something immediately
    setSelectedJsonFile(file);
    
    // Check if a result file exists for this JSON file
    const resultFile = await findMatchingResultFile(file.name);
    
    if (resultFile) {
      // If we found a result file, use its content but keep the file editable
      setSelectedJsonFile({
        ...file,
        content: resultFile.content,
        approved: false, // Ensure it's editable
        edited: false
      });
      return;
    }
    
    // If no result file was found, or there was an error, proceed with the original file
    if (!file.content) {
      // Fetch content if not already present
      setLoadingJson(true);
      try {
        const text = await fetchFileContent(file.id);
        const parsed = JSON.parse(text);
        
        // Update global state
        updateJsonFile(file, parsed);
        // Update local state
        setSelectedJsonFile({
          ...file,
          content: parsed
        });
      } catch (error) {
        console.error('Error fetching JSON file content:', error);
      } finally {
        setLoadingJson(false);
      }
    }
  }, [findMatchingResultFile, updateJsonFile]);

  const handleJsonUpdate = useCallback((content: any): void => {
    if (selectedJsonFile) {
      // Update the global state
      updateJsonFile(selectedJsonFile, content);
      
      // Also update our local state to ensure we have the latest content
      setSelectedJsonFile(prev => prev ? {
        ...prev,
        content,
        edited: true
      } : null);
    }
  }, [selectedJsonFile, updateJsonFile]);

  const handleSaveToResults = useCallback(async (): Promise<void> => {
    console.log('handleSaveToResults called');
    console.log('selectedJsonFile:', selectedJsonFile);
    console.log('jsonFolder:', jsonFolder);
    
    if (!selectedJsonFile || !jsonFolder) {
      console.error('Missing required data for save');
      return;
    }
    
    try {
      // Get the latest content from the editor before saving
      const updatedJsonFile = { ...selectedJsonFile };
      
      // Get the current content from the editor
      if (jsonEditorRef.current) {
        const currentContent = jsonEditorRef.current.getCurrentContent();
        if (currentContent) {
          updatedJsonFile.content = currentContent;
          console.log('Using editor content for save:', updatedJsonFile.content);
        } else {
          console.log('Using existing content for save:', updatedJsonFile.content);
        }
      } else {
        console.log('Editor ref not available, using existing content:', updatedJsonFile.content);
      }
      
      // Save to results folder
      console.log('Calling saveToResults with:', updatedJsonFile);
      await saveToResults(updatedJsonFile, jsonFolder.name);
      
      // Update local state to reflect the saved status
      setSelectedJsonFile({
        ...updatedJsonFile,
        edited: false
      });
      
      // Update global state
      updateJsonFile(selectedJsonFile, updatedJsonFile.content);
      
      // Refresh result files to update the UI
      const results = await fetchResultFiles();
      const allFiles = results.flatMap(folder => 
        folder.files.map(file => ({
          ...file,
          folderName: folder.folderName
        }))
      );
      setResultFiles(allFiles);
      
      // Update the set of files that have result versions
      const matchingResultFolder = results.find(folder => folder.folderName === jsonFolder.name);
      if (matchingResultFolder) {
        const fileNamesWithResults = new Set(
          matchingResultFolder.files.map(file => file.name)
        );
        setFilesWithResults(fileNamesWithResults);
      }
      
      console.log('Save completed successfully');
    } catch (error) {
      console.error('Error in handleSaveToResults:', error);
    }
  }, [selectedJsonFile, jsonFolder, saveToResults, updateJsonFile]);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-blue-600 hover:text-blue-800"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </button>

        <h1 className="text-xl font-bold text-gray-900">{markdownFile.name}</h1>

        <div className="text-sm">
          {markdownFile.status === 'completed' ? (
            <span className="flex items-center text-green-600">
              <CheckCircle className="h-4 w-4 mr-1" /> Completed
            </span>
          ) : markdownFile.status === 'in-progress' ? (
            <span className="text-yellow-600">In Progress</span>
          ) : (
            <span className="text-gray-500">Pending</span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 border rounded-lg overflow-hidden">
        {/* Markdown viewer */}
        <div className="w-1/2 h-full overflow-auto border-r">
          {markdownContent ? (
            <MarkdownViewer content={markdownContent} />
          ) : (
            <div className="p-6 text-center text-gray-500">Loading markdown…</div>
          )}
        </div>

        {/* JSON editor */}
        <div className="w-1/2 h-full flex flex-col">
          {jsonFolder ? (
            <div className="flex h-full">
              {/* File list */}
              <div className="w-1/4 min-w-[200px] bg-gray-100 border-r overflow-y-auto">
                <div className="p-3 border-b bg-gray-200">
                  <h3 className="font-medium text-gray-700 flex items-center">
                    <Database className="h-4 w-4 mr-1.5" /> JSON Files
                  </h3>
                </div>
                <ul className="divide-y divide-gray-200">
                  {jsonFolder.files.map(file => (
                    <li key={file.id}>
                      <button
                        onClick={() => handleJsonFileSelect(file)}
                        className={`w-full text-left px-4 py-3 flex items-center hover:bg-gray-200 ${
                          selectedJsonFile?.id === file.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <FileText
                          className={`h-4 w-4 mr-2 ${
                            file.approved ? 'text-green-600' : 
                            filesWithResults.has(file.name) ? 'text-blue-600' : 
                            'text-gray-500'
                          }`}
                        />
                        <span
                          className={`text-sm truncate ${
                            file.approved ? 'text-green-600 font-medium' : 
                            filesWithResults.has(file.name) ? 'text-blue-600' : 
                            ''
                          }`}
                        >
                          {file.name}
                        </span>
                        <div className="ml-auto flex">
                          {filesWithResults.has(file.name) && (
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full mr-1">
                              Results
                            </span>
                          )}
                          {file.edited && (
                            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                              Edited
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Editor */}
              <div className="flex-1">
                {selectedJsonFile ? (
                  loadingJson && !selectedJsonFile.content ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      Loading JSON...
                    </div>
                  ) : (
                    <JsonEditor 
                      ref={jsonEditorRef}
                      key={selectedJsonFile.id}
                      jsonFile={selectedJsonFile}
                      folderName={jsonFolder.name}
                      onUpdate={handleJsonUpdate}
                      onSave={handleSaveToResults}
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-6">
                    <Database className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">Select a JSON file</h3>
                    <p className="text-gray-500 mt-2 text-center">
                      Choose a JSON file from the list to start editing
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-6">
              <Database className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No matching JSON folder</h3>
              <p className="text-gray-500 mt-2 text-center">
                This markdown file doesn't have a matching JSON folder.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditorPage;

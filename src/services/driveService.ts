import { ServiceAccount, MarkdownFile, JsonFolder, JsonFile } from '../types';

// Server API URL - Use relative URL for Vercel deployment
const API_URL = '/api';

// Helper function to extract JSON from responses that might contain source map comments
const extractValidJson = async (response: Response): Promise<any> => {
  const text = await response.text();
  
  // If the response is empty or contains only source map, return an empty array
  if (!text || text.trim().startsWith('//# sourceMappingURL')) {
    console.log('Response contains only source map or is empty, returning empty array');
    return [];
  }
  
  // Try to extract JSON by removing source map comments
  try {
    // Remove source map comment if present
    const jsonText = text.replace(/\/\/# sourceMappingURL=[^\n]*/, '').trim();
    
    // If we have valid text, parse it
    if (jsonText) {
      return JSON.parse(jsonText);
    } else {
      return [];
    }
  } catch (error) {
    console.error('Error parsing JSON from response:', error);
    console.log('Original response text:', text.substring(0, 200));
    throw new Error('Failed to parse response data');
  }
};

// Result folder file type
export interface ResultFolder {
  folderId: string;
  folderName: string;
  files: { id: string; name: string; }[];
}

// Clear cache (client-side implementation)
export const clearCache = async (): Promise<void> => {
  try {
    console.log('Using client-side cache clearing for static file mode');
    
    // In static file mode, we can't clear the server cache with a POST request
    // Instead, we'll force fresh requests by adding a timestamp parameter
    // This is implemented on the fetch side of each API call
    
    // Set a global timestamp that will be used by fetch calls
    window.localStorage.setItem('cache_timestamp', Date.now().toString());
    
    console.log('Cache timestamp updated for fresh requests');
    return Promise.resolve();
  } catch (error) {
    console.error('Error in client-side cache clearing:', error);
    // Don't throw the error as this is a fallback implementation
    // Just log it and continue
  }
};

// Initialize a client that connects to the backend server
export const initDriveClient = (_serviceAccount: ServiceAccount) => {
  console.log('Initializing client connected to server API');
  
  // This client is a wrapper over the backend API
  // The interface is maintained for compatibility with existing code
  return {
    files: {
      list: async () => {
        // Not actually using params directly as the backend handles the filtering
        
        // We're returning a compatible response structure so the rest of the code works
        return { 
          data: { 
            files: [] // This will be ignored as we're using direct API calls instead
          }
        };
      },
      
      get: async (params: any) => {
        const { fileId } = params;
        
        try {
          const response = await fetch(`${API_URL}/files/${fileId}/content`);
          if (!response.ok) throw new Error('Failed to fetch file content');
          
          const content = await response.text();
          return { data: content };
        } catch (error) {
          console.error(`Error fetching content for file ${fileId}:`, error);
          throw error;
        }
      },
      
      create: async (params: any) => {
        // Forward to the saveJsonFile function which calls the appropriate API
        const { resource } = params;
        console.log('Creating file:', resource.name);
        
        // The actual implementation is in saveJsonFile
        return { data: { id: 'pending' } };
      }
    }
  };
};

// Fetch Markdown files from the server API
export const fetchMarkdownFiles = async (): Promise<MarkdownFile[]> => {
  try {
    // Get cache timestamp if it exists for cache busting
    const cacheTimestamp = window.localStorage.getItem('cache_timestamp') || '';
    const cacheBuster = cacheTimestamp ? `?t=${cacheTimestamp}` : '';
    
    const response = await fetch(`${API_URL}/markdown-files${cacheBuster}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch markdown files: ${response.status}`);
    }
    
    const markdownFiles = await extractValidJson(response);
    return markdownFiles;
  } catch (error) {
    console.error('Error fetching markdown files:', error);
    throw error;
  }
};

// Fetch JSON folders and files from the server API
export const fetchJsonFolders = async (): Promise<JsonFolder[]> => {
  try {
    // Get cache timestamp if it exists for cache busting
    const cacheTimestamp = window.localStorage.getItem('cache_timestamp') || '';
    const cacheBuster = cacheTimestamp ? `?t=${cacheTimestamp}` : '';
    
    const response = await fetch(`${API_URL}/json-folders${cacheBuster}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch JSON folders: ${response.status}`);
    }
    
    const jsonFolders = await extractValidJson(response);
    return jsonFolders;
  } catch (error) {
    console.error('Error fetching JSON folders:', error);
    throw error;
  }
};

// Fetch file content from the server API
export const fetchFileContent = async (
  fileId: string
): Promise<string> => {
  try {
    const response = await fetch(`${API_URL}/files/${fileId}/content`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file content: ${response.status}`);
    }
    
    return await response.text();
  } catch (error) {
    console.error(`Error fetching content for file ${fileId}:`, error);
    throw error;
  }
};

// Save JSON file to results folder using the server API
export const saveJsonFile = async (
  jsonFile: JsonFile,
  folderName: string
): Promise<string> => {
  try {
    console.log(`Saving JSON file to results folder:`, { 
      fileName: jsonFile.name, 
      fileId: jsonFile.id,
      folderName,
      contentSample: jsonFile.content ? JSON.stringify(jsonFile.content).substring(0, 100) + '...' : 'NO CONTENT'
    });
    
    // Make sure content is not undefined before sending
    if (jsonFile.content === undefined) {
      console.error('Cannot save JSON file with undefined content');
      throw new Error('JSON file content is undefined');
    }
    
    const payload = { jsonFile, folderName };
    console.log('POST payload:', JSON.stringify(payload).substring(0, 200) + '...');
    
    const response = await fetch(`${API_URL}/save-json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    console.log('Save response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`Failed to save JSON file: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('Save successful, result:', result);
    return result.id;
  } catch (error) {
    console.error('Error saving JSON file:', error);
    throw error;
  }
};

// Match markdown files with JSON folders
// Fetch files in the result folder
export const fetchResultFiles = async (): Promise<ResultFolder[]> => {
  try {
    // Get cache timestamp if it exists for cache busting
    const cacheTimestamp = window.localStorage.getItem('cache_timestamp') || '';
    const cacheBuster = cacheTimestamp ? `?t=${cacheTimestamp}` : '';
    
    const response = await fetch(`${API_URL}/result-files${cacheBuster}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch result files: ${response.status}`);
    }
    
    const resultFolders = await extractValidJson(response);
    return resultFolders;
  } catch (error) {
    console.error('Error fetching result files:', error);
    throw error;
  }
};

export const matchFilesWithFolders = (
  markdownFiles: MarkdownFile[],
  jsonFolders: JsonFolder[]
): { 
  matchedMarkdownFiles: MarkdownFile[], 
  matchedJsonFolders: JsonFolder[] 
} => {
  const matchedMarkdownFiles = [...markdownFiles];
  const matchedJsonFolders = [...jsonFolders];
  
  matchedMarkdownFiles.forEach(mdFile => {
    // Strip extension and split by underscores
    const mdNameWithoutExt = mdFile.name.replace('.md', '');
    const mdParts = mdNameWithoutExt.split('_');
    const mdPrefix = mdParts.slice(0, 3).join('_');
    
    // Find matching JSON folder
    const matchingFolder = matchedJsonFolders.find(folder => {
      const folderParts = folder.name.split('_');
      const folderPrefix = folderParts.slice(0, 3).join('_');

      return folderPrefix.toLowerCase() === mdPrefix.toLowerCase();
    });
    
    if (matchingFolder) {
      mdFile.matchingFolderId = matchingFolder.id;
      const folderIndex = matchedJsonFolders.findIndex(f => f.id === matchingFolder.id);
      if (folderIndex !== -1) {
        matchedJsonFolders[folderIndex].matchingMarkdownId = mdFile.id;
      }
    }
  });
  
  return { matchedMarkdownFiles, matchedJsonFolders };
};
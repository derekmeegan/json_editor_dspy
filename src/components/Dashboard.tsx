import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Folder, ChevronRight, RefreshCw } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { fileState, loadFiles } = useFiles();
  const { authState } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only load files when authenticated
    if (authState.isAuthenticated) {
      loadFiles();
    }
  }, [authState.isAuthenticated, loadFiles]);

  const handleRefresh = () => {
    loadFiles(true); // Pass forceRefresh=true to clear the cache when explicitly refreshing
  };

  const handleMarkdownClick = (markdownName: string) => {
    navigate(`/editor/${markdownName}`);
  };

  return (
    <div className="space-y-6 px-16">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          File Dashboard
          <span className="ml-3 text-sm font-normal text-gray-600">
            {fileState.markdownFiles.filter(file => file.status === 'completed').length} / {fileState.markdownFiles.length}
          </span>
        </h1>
        <button 
          onClick={handleRefresh}
          className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Files
        </button>
      </div>

      {fileState.isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : fileState.error ? (
        <div className="bg-red-50 border border-red-300 text-red-700 p-4 rounded-md">
          {fileState.error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {fileState.markdownFiles.map((markdownFile) => {
            const matchingFolder = fileState.jsonFolders.find(
              (folder) => folder.id === markdownFile.matchingFolderId
            );
            
            let statusColor = 'bg-gray-100';
            let statusText = 'Pending';
            let textColor = 'text-gray-700';
            
            if (markdownFile.status === 'completed') {
              statusColor = 'bg-green-100';
              statusText = 'Completed';
              textColor = 'text-green-700';
            } else if (markdownFile.status === 'in-progress') {
              statusColor = 'bg-yellow-100';
              statusText = 'In Progress';
              textColor = 'text-yellow-700';
            }
            
            return (
              <div 
                key={markdownFile.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 overflow-hidden cursor-pointer"
                onClick={() => handleMarkdownClick(markdownFile.name)}
              >
                <div className="p-5">
                  <div className="flex items-center mb-4">
                    <FileText className="h-6 w-6 text-blue-600 mr-2" />
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {markdownFile.name}
                    </h3>
                  </div>
                  
                  <div className="flex items-center mb-3">
                    <Folder className="h-5 w-5 text-gray-500 mr-2" />
                    <span className="text-sm text-gray-600">
                      {matchingFolder 
                        ? `${matchingFolder.files.length} JSON files` 
                        : 'No matching JSON folder'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className={`px-3 py-1 rounded-full ${statusColor} ${textColor} text-xs font-medium`}>
                      {statusText}
                    </div>
                    
                    {matchingFolder && (
                      <div className="text-sm text-gray-500">
                        {Math.round(matchingFolder.progress)}% complete
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-gray-50 px-5 py-3 flex justify-end">
                  <div className="flex items-center text-sm text-blue-600">
                    <span className="mr-1">View</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {fileState.markdownFiles.length === 0 && !fileState.isLoading && !fileState.error && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No files found</h3>
          <p className="text-gray-500 mt-2">
            No markdown files were found in your Google Drive folder.
          </p>
          <button
            onClick={handleRefresh}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Files
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
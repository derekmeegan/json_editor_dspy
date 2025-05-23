import React, { useState } from 'react';
import { Save, Upload, Trash, Database } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ServiceAccount } from '../types';

const SettingsPage: React.FC = () => {
  const { authState, login } = useAuth();
  const [serviceAccountText, setServiceAccountText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      // Parse service account JSON
      const serviceAccount: ServiceAccount = JSON.parse(serviceAccountText);
      
      // Check required fields
      if (!serviceAccount.client_email || !serviceAccount.private_key) {
        setError('Invalid service account. Missing required fields.');
        return;
      }
      
      await login(serviceAccount);
      setSuccess('Service account credentials updated successfully.');
      setServiceAccountText('');
    } catch (error) {
      setError('Invalid JSON format. Please check your service account credentials.');
      console.error('Error parsing service account:', error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setServiceAccountText(content);
      } catch (error) {
        setError('Error reading file. Please try again.');
        console.error('Error reading file:', error);
      }
    };
    
    reader.readAsText(file);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="p-5 border-b">
          <h2 className="text-xl font-medium text-gray-900 mb-1">Google Drive Folders</h2>
          <p className="text-sm text-gray-500">
            These are the Google Drive folders used by the application.
          </p>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="flex items-start">
            <Database className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
            <div>
              <h3 className="font-medium text-gray-900">Markdown Files</h3>
              <p className="text-sm text-gray-600 mb-1">
                Folder ID: 1YIbPXYUwDhQ_wjSlFEdaM-Fio0wdzoJS
              </p>
              <p className="text-xs text-gray-500">
                Contains markdown files with information to review against JSON.
              </p>
            </div>
          </div>
          
          <div className="flex items-start">
            <Database className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
            <div>
              <h3 className="font-medium text-gray-900">JSON Data</h3>
              <p className="text-sm text-gray-600 mb-1">
                Folder ID: 183oEQEl_4KFbxLpfFNvX11YDXbD8cUgf
              </p>
              <p className="text-xs text-gray-500">
                Contains folders with JSON files to be reviewed and edited.
              </p>
            </div>
          </div>
          
          <div className="flex items-start">
            <Database className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
            <div>
              <h3 className="font-medium text-gray-900">Results</h3>
              <p className="text-sm text-gray-600 mb-1">
                Folder ID: 1rVwwuNmExsaV1QJm4z4MYrEXk9etixlw
              </p>
              <p className="text-xs text-gray-500">
                Destination for approved JSON files.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="text-xl font-medium text-gray-900 mb-1">Service Account Credentials</h2>
          <p className="text-sm text-gray-500">
            Update your Google Drive service account credentials.
          </p>
        </div>
        
        <form className="p-5" onSubmit={handleUpdateCredentials}>
          <div className="mb-4">
            <label htmlFor="service-account" className="block text-sm font-medium text-gray-700 mb-2">
              Service Account JSON
            </label>
            <textarea
              id="service-account"
              name="service-account"
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder='{"type": "service_account", "project_id": "...", ...}'
              value={serviceAccountText}
              onChange={(e) => setServiceAccountText(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-4 mb-4">
            <label 
              htmlFor="file-upload" 
              className="cursor-pointer flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Upload className="h-4 w-4 mr-2 text-gray-500" />
              Upload JSON file
              <input 
                id="file-upload" 
                name="file-upload" 
                type="file" 
                className="sr-only" 
                accept=".json"
                onChange={handleFileUpload}
              />
            </label>
            
            {serviceAccountText && (
              <button
                type="button"
                onClick={() => setServiceAccountText('')}
                className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-red-600 bg-white hover:bg-red-50"
              >
                <Trash className="h-4 w-4 mr-2" />
                Clear
              </button>
            )}
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 p-3 rounded-md mb-4">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-300 text-green-700 p-3 rounded-md mb-4">
              {success}
            </div>
          )}
          
          <button
            type="submit"
            disabled={!serviceAccountText}
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            Update Credentials
          </button>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Upload, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ServiceAccount } from '../types';

const AuthPage: React.FC = () => {
  const [serviceAccountText, setServiceAccountText] = useState('');
  const [error, setError] = useState('');
  const { login, authState } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      // Parse service account JSON
      const serviceAccount: ServiceAccount = JSON.parse(serviceAccountText);
      
      // Check required fields
      if (!serviceAccount.client_email || !serviceAccount.private_key) {
        setError('Invalid service account. Missing required fields.');
        return;
      }
      
      await login(serviceAccount);
      navigate('/');
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

  if (authState.isAuthenticated) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <FileText className="mx-auto h-12 w-12 text-blue-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Google Drive JSON Editor
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Connect with your Google Drive service account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="service-account" className="block text-sm font-medium text-gray-700">
                Service Account Credentials (JSON)
              </label>
              <div className="mt-1">
                <textarea
                  id="service-account"
                  name="service-account"
                  rows={10}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder='{"type": "service_account", "project_id": "...", ...}'
                  value={serviceAccountText}
                  onChange={(e) => setServiceAccountText(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-center">
              <label 
                htmlFor="file-upload" 
                className="cursor-pointer flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Upload className="h-5 w-5 mr-2 text-gray-500" />
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
            </div>

            {error && (
              <div className="text-red-600 text-sm mt-2">
                {error}
              </div>
            )}

            {authState.error && (
              <div className="text-red-600 text-sm mt-2">
                {authState.error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={authState.isLoading}
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <Key className="h-5 w-5 mr-2" />
                {authState.isLoading ? 'Connecting...' : 'Connect to Google Drive'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
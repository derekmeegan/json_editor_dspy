import React, { useState, forwardRef, useImperativeHandle, useCallback, useRef, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';
import { JsonFile } from '../types';

// Import the json-edit-react package
import { JsonEditor as JsonEditComponent } from 'json-edit-react';

interface JsonEditorProps {
  jsonFile: JsonFile;
  folderName: string;
  onUpdate: (content: any) => void;
  onSave: () => Promise<void>;
}

export interface JsonEditorRef {
  getCurrentContent: () => any;
  // For backward compatibility
  editorRef: {
    current: {
      jsObject: any;
    };
  };
}

const JsonEditorWrapper = forwardRef<JsonEditorRef, JsonEditorProps>(({ 
  jsonFile, 
  folderName: _folderName, // Prefix with _ to indicate it's intentionally unused
  onUpdate, 
  onSave 
}, ref) => {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Keep track of the current JSON value
  const [jsonValue, setJsonValue] = useState(jsonFile.content);
  
  // Create a ref to store the latest json value
  const jsonValueRef = useRef(jsonValue);
  
  // Update ref when state changes
  useEffect(() => {
    jsonValueRef.current = jsonValue;
  }, [jsonValue]);
  
  // Update jsonValue when jsonFile changes
  useEffect(() => {
    setJsonValue(jsonFile.content);
  }, [jsonFile.id, jsonFile.content]);
  
  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    getCurrentContent: () => jsonValueRef.current,
    // For backward compatibility
    editorRef: { 
      current: { 
        jsObject: jsonValueRef.current 
      } 
    }
  }), []);

  // Handle error from the editor
  const handleError = useCallback((err: any) => {
    console.error('JSON validation error:', err);
    setError(err?.message || 'Invalid JSON format');
  }, []);

  const handleSave = useCallback(async () => {
    console.log('Save button clicked');
    console.log('Current JSON value:', jsonValue);
    
    if (error) {
      console.log('Cannot save due to error:', error);
      return;
    }
    
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      // Update with the current JSON value
      console.log('Updating with:', jsonValue);
      onUpdate(jsonValue);
      
      // Call the parent's save handler
      await onSave();
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Error saving file:', err);
      setError('Failed to save file');
    } finally {
      setIsSaving(false);
    }
  }, [error, onUpdate, onSave, jsonValue]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="font-medium">{jsonFile.name}</h3>
        <div className="flex items-center space-x-2">
          {error && (
            <span className="text-red-500 text-sm flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {error}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !!error || jsonFile.approved}
            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center ${
              isSaving || error || jsonFile.approved
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSaving ? (
              'Saving...'
            ) : saveSuccess ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Saved
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1.5" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4 bg-gray-50">
        {jsonFile.approved ? (
          // For approved files, render a read-only display
          <div className="h-full w-full bg-white p-4 overflow-auto rounded border border-gray-200">
            <pre className="text-sm">{JSON.stringify(jsonValue, null, 2)}</pre>
          </div>
        ) : (
          // For editable files, use the JsonEditComponent
          <JsonEditComponent 
            data={jsonValue}
            setData={setJsonValue}
            onError={handleError}
          />
        )}
      </div>
      
      {jsonFile.approved && (
        <div className="bg-green-50 p-2 text-center text-green-700 font-medium">
          This file has been approved and saved to results
        </div>
      )}
    </div>
  );
});

export default JsonEditorWrapper;

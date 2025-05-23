declare module 'react-json-editor-ajrm' {
  import { Component } from 'react';

  interface JSONEditorProps {
    id?: string;
    placeholder?: any;
    theme?: string;
    colors?: {
      default?: string;
      background?: string;
      background_warning?: string;
      string?: string;
      number?: string;
      colon?: string;
      keys?: string;
      error?: string;
    };
    height?: string;
    width?: string;
    onChange?: (data: { jsObject: any; error: any }) => void;
    disabled?: boolean;
  }

  export default class ReactJsonEditorAjrm extends Component<JSONEditorProps> {}
}

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownViewerProps {
  content: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  return (
    <div className="prose max-w-none p-6 bg-white rounded-lg shadow-sm">
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={vs}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold mb-4 text-gray-900" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-bold mb-3 mt-6 text-gray-900" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-bold mb-2 mt-5 text-gray-900" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="mb-4 text-gray-700" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc ml-5 mb-4" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal ml-5 mb-4" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="mb-1" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a className="text-blue-600 hover:underline" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-gray-200 pl-4 py-2 italic text-gray-600" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300 border" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-gray-50" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-gray-200" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-gray-50" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 text-sm text-gray-500" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;
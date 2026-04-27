import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeString = String(children).replace(/\n$/, '');
          const isInline = !match && !codeString.includes('\n');

          if (isInline) {
            return (
              <code
                style={{
                  background: '#f0f0f0',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '0.9em',
                  color: '#d63384',
                }}
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            <SyntaxHighlighter
              style={oneDark as { [key: string]: React.CSSProperties }}
              language={match ? match[1] : 'text'}
              PreTag="div"
            >
              {codeString}
            </SyntaxHighlighter>
          );
        },
        h1({ children }) {
          return (
            <h1 style={{ fontSize: '1.8em', fontWeight: 'bold', margin: '16px 0 8px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
              {children}
            </h1>
          );
        },
        h2({ children }) {
          return (
            <h2 style={{ fontSize: '1.5em', fontWeight: 'bold', margin: '14px 0 6px', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>
              {children}
            </h2>
          );
        },
        h3({ children }) {
          return (
            <h3 style={{ fontSize: '1.25em', fontWeight: 'bold', margin: '12px 0 4px' }}>
              {children}
            </h3>
          );
        },
        h4({ children }) {
          return (
            <h4 style={{ fontSize: '1.1em', fontWeight: 'bold', margin: '10px 0 4px' }}>
              {children}
            </h4>
          );
        },
        p({ children }) {
          return (
            <p style={{ margin: '8px 0', lineHeight: 1.7 }}>
              {children}
            </p>
          );
        },
        ul({ children }) {
          return (
            <ul style={{ margin: '8px 0', paddingLeft: '24px', listStyleType: 'disc' }}>
              {children}
            </ul>
          );
        },
        ol({ children }) {
          return (
            <ol style={{ margin: '8px 0', paddingLeft: '24px', listStyleType: 'decimal' }}>
              {children}
            </ol>
          );
        },
        li({ children }) {
          return (
            <li style={{ margin: '4px 0', lineHeight: 1.6 }}>
              {children}
            </li>
          );
        },
        blockquote({ children }) {
          return (
            <blockquote style={{
              margin: '12px 0',
              padding: '8px 16px',
              borderLeft: '4px solid #1890ff',
              background: '#f5f5f5',
              color: '#666',
            }}>
              {children}
            </blockquote>
          );
        },
        table({ children }) {
          return (
            <table style={{
              margin: '12px 0',
              borderCollapse: 'collapse',
              width: '100%',
              fontSize: '14px',
            }}>
              {children}
            </table>
          );
        },
        thead({ children }) {
          return <thead style={{ background: '#fafafa' }}>{children}</thead>;
        },
        th({ children }) {
          return (
            <th style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              textAlign: 'left',
              fontWeight: 'bold',
            }}>
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
            }}>
              {children}
            </td>
          );
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              style={{ color: '#1890ff', textDecoration: 'none' }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        },
        hr() {
          return <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #eee' }} />;
        },
        strong({ children }) {
          return <strong style={{ fontWeight: 'bold', color: '#333' }}>{children}</strong>;
        },
        em({ children }) {
          return <em style={{ fontStyle: 'italic' }}>{children}</em>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer;

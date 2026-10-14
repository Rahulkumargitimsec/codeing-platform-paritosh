// Load Monaco from node_modules instead of a CDN, so the editor works offline.
import { loader } from '@monaco-editor/react';
// Only the editor core plus the three languages we use, to keep the bundle small
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/editor/editor.all';
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution';
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

self.MonacoEnvironment = { getWorker: () => new editorWorker() };

monaco.editor.defineTheme('cj-paper', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '75819b', fontStyle: 'italic' },
    { token: 'keyword', foreground: '2346d8', fontStyle: 'bold' },
    { token: 'string', foreground: '12804e' },
    { token: 'number', foreground: 'a35f00' },
    { token: 'type', foreground: '7a3fc4' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#14213d',
    'editorLineNumber.foreground': '#b9c3d6',
    'editorLineNumber.activeForeground': '#44526f',
    'editor.lineHighlightBackground': '#f3f5f9',
    'editor.lineHighlightBorder': '#00000000',
    'editor.selectionBackground': '#cdd7fa',
    'editorCursor.foreground': '#2346d8',
    'editorIndentGuide.background1': '#eef1f7',
    'editorGutter.background': '#ffffff',
  },
});

monaco.editor.defineTheme('cj-blueprint', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '7083ac', fontStyle: 'italic' },
    { token: 'keyword', foreground: '87a7ff', fontStyle: 'bold' },
    { token: 'string', foreground: '45d296' },
    { token: 'number', foreground: 'f3b552' },
    { token: 'type', foreground: 'c7a6ff' },
  ],
  colors: {
    'editor.background': '#11203f',
    'editor.foreground': '#e6ecf9',
    'editorLineNumber.foreground': '#34508a',
    'editorLineNumber.activeForeground': '#a9b6d5',
    'editor.lineHighlightBackground': '#16284e',
    'editor.lineHighlightBorder': '#00000000',
    'editor.selectionBackground': '#2d4a8a',
    'editorCursor.foreground': '#87a7ff',
    'editorIndentGuide.background1': '#1c315c',
    'editorGutter.background': '#11203f',
  },
});

loader.config({ monaco });

export const editorTheme = (theme) => (theme === 'dark' ? 'cj-blueprint' : 'cj-paper');

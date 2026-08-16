import React, { useState, useEffect } from 'react';
import { Folder, File, RefreshCw, Save, Check, FileCode, Plus, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { WorkspaceFile } from '../types';

export const WorkspaceExplorer: React.FC = () => {
  const [currentDir, setCurrentDir] = useState('.');
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>('package.json');
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);

  const fetchFiles = async (dir: string = '.') => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/workspace/files?path=${encodeURIComponent(dir)}`);
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
        setCurrentDir(dir);
      }
    } catch (err) {
      console.error('Failed to fetch workspace files:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFileContent = async (filePath: string) => {
    try {
      const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (data.content !== undefined) {
        setSelectedFile(filePath);
        setFileContent(data.content);
      }
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  };

  const handleSaveFile = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile, content: fileContent }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save file:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const path = currentDir === '.' ? newFileName.trim() : `${currentDir}/${newFileName.trim()}`;
    try {
      await fetch('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content: '' }),
      });
      setNewFileName('');
      setShowNewFileInput(false);
      await fetchFiles(currentDir);
      await loadFileContent(path);
    } catch (err) {
      console.error('Failed to create file:', err);
    }
  };

  useEffect(() => {
    fetchFiles('.');
    loadFileContent('package.json');
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
      {/* File Tree Sidebar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-full shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-white font-mono">
              Workspace / {currentDir === '.' ? 'root' : currentDir}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNewFileInput(!showNewFileInput)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="New File"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => fetchFiles(currentDir)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh Tree"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Create new file prompt */}
        {showNewFileInput && (
          <form onSubmit={handleCreateNewFile} className="mt-2 flex gap-1">
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="e.g. src/index.ts"
              className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              autoFocus
            />
            <button
              type="submit"
              className="bg-indigo-600 px-2 py-1 rounded text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Create
            </button>
          </form>
        )}

        {/* Directory Traversal Back */}
        {currentDir !== '.' && (
          <button
            onClick={() => {
              const parts = currentDir.split('/');
              parts.pop();
              fetchFiles(parts.length === 0 ? '.' : parts.join('/'));
            }}
            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono text-left px-2 py-1 rounded hover:bg-slate-800/40"
          >
            ← .. (parent directory)
          </button>
        )}

        {/* Files List */}
        <div className="flex-1 overflow-y-auto mt-2 space-y-1">
          {files.map((file) => (
            <button
              key={file.path}
              onClick={() => {
                if (file.isDirectory) {
                  fetchFiles(file.path);
                } else {
                  loadFileContent(file.path);
                }
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all text-left ${
                selectedFile === file.path
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {file.isDirectory ? (
                  <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className="truncate">{file.name}</span>
              </div>
              {file.isDirectory && <ChevronRight className="w-3 h-3 text-slate-500" />}
            </button>
          ))}
        </div>
      </div>

      {/* Code Editor & Viewer */}
      <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full shadow-lg overflow-hidden">
        {/* Editor Toolbar */}
        <div className="bg-slate-950/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-indigo-400" />
            <span className="font-mono text-xs font-semibold text-slate-200">
              {selectedFile || 'No file selected'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveFile}
              disabled={isSaving || !selectedFile}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
              }`}
            >
              {saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saveSuccess ? 'Saved' : isSaving ? 'Saving...' : 'Save File'}</span>
            </button>
          </div>
        </div>

        {/* Textarea Code Editor */}
        <div className="flex-1 relative bg-slate-950 p-4 font-mono text-xs">
          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            placeholder="Select a file to view or edit content..."
            className="w-full h-full bg-transparent text-slate-200 resize-none focus:outline-none font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
};

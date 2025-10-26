import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Search, Trash2, Sparkles, Brain, Zap, FileSearch, BookOpen, ChevronRight, Download, CheckCircle, TrendingUp, Filter, RefreshCw, Copy } from 'lucide-react';

const SmartAnswerFinder = () => {
  const [files, setFiles] = useState([]);
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchMode, setSearchMode] = useState('hybrid');
  const [relevanceThreshold, setRelevanceThreshold] = useState(0.3);
  const [contextSize, setContextSize] = useState(5);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation]);

  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const preprocessContent = (content) => {
    const lines = content.split('\n');
    const chunks = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length > 0) {
        chunks.push({
          lineNumber: i + 1,
          text: line,
          textLower: line.toLowerCase(),
          words: line.toLowerCase().split(/\s+/),
          length: line.length
        });
      }
    }
    return chunks;
  };

  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    
    for (const file of uploadedFiles) {
      if (file.type === 'application/pdf' || file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        try {
          const content = await readFileContent(file);
          const processedContent = preprocessContent(content);
          
          setFiles(prev => [...prev, {
            id: Date.now() + Math.random(),
            name: file.name,
            content: content,
            processedContent: processedContent,
            size: file.size,
            uploadedAt: new Date().toLocaleString(),
            wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
            lineCount: content.split('\n').length
          }]);
        } catch (error) {
          console.error('Error reading file:', error);
        }
      }
    }
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const calculateRelevanceScore = (queryTerms, chunk) => {
    let score = 0;
    const textLower = chunk.textLower;
    
    const queryPhrase = queryTerms.join(' ');
    if (textLower.includes(queryPhrase)) {
      score += 100;
    }
    
    queryTerms.forEach(term => {
      if (term.length < 3) return;
      
      const regex = new RegExp(term, 'gi');
      const matches = (textLower.match(regex) || []).length;
      
      if (matches > 0) {
        score += matches * term.length * 2;
      }
    });
    
    return score;
  };

  const hybridSearch = (query, file) => {
    const queryTerms = query.toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2);
    
    if (queryTerms.length === 0) return [];
    
    const results = [];
    
    file.processedContent.forEach(chunk => {
      const score = calculateRelevanceScore(queryTerms, chunk);
      
      if (score > 0) {
        results.push({
          score: score,
          lineNumber: chunk.lineNumber,
          text: chunk.text
        });
      }
    });
    
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, 5).map(result => {
      const lineIndex = result.lineNumber - 1;
      const lines = file.content.split('\n');
      const start = Math.max(0, lineIndex - contextSize);
      const end = Math.min(lines.length, lineIndex + contextSize + 1);
      
      return {
        lineNumber: result.lineNumber,
        context: lines.slice(start, end).join('\n'),
        score: result.score,
        matchedLine: result.text
      };
    });
  };

  const searchInFiles = (query) => {
    if (!query.trim()) return null;
    
    const allResults = [];
    
    files.forEach(file => {
      const fileResults = hybridSearch(query, file);
      
      fileResults.forEach(result => {
        allResults.push({
          fileName: file.name,
          ...result
        });
      });
    });
    
    allResults.sort((a, b) => b.score - a.score);
    return allResults;
  };

  const handleAskQuestion = () => {
    if (!question.trim() || files.length === 0) return;

    setIsProcessing(true);
    
    const userMessage = { 
      type: 'user', 
      text: question,
      timestamp: new Date().toLocaleTimeString()
    };
    setConversation(prev => [...prev, userMessage]);

    setTimeout(() => {
      const results = searchInFiles(question);
      
      let aiResponse;
      if (results && results.length > 0) {
        const topResults = results.slice(0, 3);
        
        let responseText = '🎯 Found ' + results.length + ' results\n\n';
        
        topResults.forEach((result, idx) => {
          responseText += '📄 File: ' + result.fileName + '\n';
          responseText += '📍 Line: ' + result.lineNumber + '\n';
          responseText += 'Score: ' + result.score.toFixed(1) + '\n\n';
          responseText += result.matchedLine + '\n\n';
          responseText += 'Context:\n' + result.context + '\n\n---\n\n';
        });

        aiResponse = {
          type: 'ai',
          text: responseText,
          found: true,
          timestamp: new Date().toLocaleTimeString()
        };
      } else {
        aiResponse = {
          type: 'ai',
          text: '🔍 No results found. Try different keywords.',
          found: false,
          timestamp: new Date().toLocaleTimeString()
        };
      }
      
      setConversation(prev => [...prev, aiResponse]);
      setIsProcessing(false);
      setQuestion('');
    }, 1000);
  };

  const clearChat = () => {
    setConversation([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="relative bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-xl rounded-2xl shadow-2xl p-8 mb-6 border border-purple-500/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                Neural Answer Engine
              </h1>
              <p className="text-purple-300 text-sm">Advanced Multi-Document AI Analysis</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-800/50 p-3 rounded-xl border border-purple-500/30">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-purple-300">Documents</span>
              </div>
              <p className="text-2xl font-bold text-white">{files.length}</p>
            </div>
            <div className="bg-slate-800/50 p-3 rounded-xl border border-blue-500/30">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-blue-300">Queries</span>
              </div>
              <p className="text-2xl font-bold text-white">{conversation.filter(m => m.type === 'user').length}</p>
            </div>
            <div className="bg-slate-800/50 p-3 rounded-xl border border-green-500/30">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-300">Words</span>
              </div>
              <p className="text-2xl font-bold text-white">{files.reduce((sum, f) => sum + f.wordCount, 0).toLocaleString()}</p>
            </div>
            <div className="bg-slate-800/50 p-3 rounded-xl border border-yellow-500/30">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-yellow-300">Success</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {conversation.filter(m => m.type === 'ai').length > 0
                  ? Math.round((conversation.filter(m => m.found).length / conversation.filter(m => m.type === 'ai').length) * 100)
                  : 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-slate-700/50">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FileSearch className="w-5 h-5 text-purple-400" />
                Documents
              </h2>
              
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-purple-500/50 rounded-xl cursor-pointer hover:border-purple-400 transition-all bg-gradient-to-br from-purple-900/20 to-blue-900/20 group">
                <Upload className="w-10 h-10 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm text-purple-300 font-medium">Upload Files</p>
                <p className="text-xs text-purple-400 mt-1">TXT, PDF, MD</p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                {files.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No files uploaded</p>
                  </div>
                ) : (
                  files.map((file) => (
                    <div key={file.id} className="bg-slate-700/50 p-3 rounded-xl border border-slate-600/50 hover:border-purple-500/50 transition-all group">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <FileText className="w-5 h-5 text-purple-400 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{file.name}</p>
                            <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB • {file.wordCount} words</p>
                          </div>
                        </div>
                        <button onClick={() => removeFile(file.id)} className="p-1 hover:bg-red-500/20 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col h-[600px]">
              <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">AI Assistant</h2>
                    <p className="text-xs text-slate-400">Ready to help</p>
                  </div>
                </div>
                {conversation.length > 0 && (
                  <button onClick={clearChat} className="p-2 hover:bg-red-500/20 rounded-lg transition-colors">
                    <RefreshCw className="w-5 h-5 text-red-400" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {conversation.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Brain className="w-16 h-16 mx-auto mb-4 text-purple-400 opacity-50" />
                      <h3 className="text-xl font-bold text-white mb-2">Ready to Answer</h3>
                      <p className="text-slate-400">Upload documents and ask questions</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {conversation.map((msg, index) => (
                      <div key={index} className={'flex gap-3 ' + (msg.type === 'user' ? 'justify-end' : 'justify-start')}>
                        {msg.type === 'ai' && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                            <Brain className="w-5 h-5 text-white" />
                          </div>
                        )}
                        
                        <div className="max-w-2xl">
                          <div className={'p-4 rounded-2xl ' + (msg.type === 'user' ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white' : msg.found ? 'bg-green-900/40 border border-green-500/30 text-slate-200' : 'bg-yellow-900/40 border border-yellow-500/30 text-slate-200')}>
                            <p className="text-xs opacity-70 mb-2">{msg.timestamp}</p>
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                          </div>
                        </div>

                        {msg.type === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm">👤</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {isProcessing && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                          <Brain className="w-5 h-5 text-white animate-pulse" />
                        </div>
                        <div className="bg-slate-700/50 p-4 rounded-2xl">
                          <div className="flex gap-2">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </>
                )}
              </div>

              <div className="p-4 border-t border-slate-700/50">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                    placeholder="Ask anything about your documents..."
                    className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-slate-400"
                    disabled={isProcessing}
                  />
                  <button
                    onClick={handleAskQuestion}
                    disabled={isProcessing || !question.trim() || files.length === 0}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2"
                  >
                    <ChevronRight className="w-5 h-5" />
                    Ask
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartAnswerFinder;
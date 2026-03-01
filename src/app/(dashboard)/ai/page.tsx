'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Input } from '@/components/ui';
import { api } from '@/lib/api-client';
import {
  SparklesIcon,
  PaperAirplaneIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  UserIcon,
  DocumentTextIcon,
  CubeIcon,
  ScaleIcon,
  WrenchScrewdriverIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PhotoIcon,
  XMarkIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';

// ─── Types ──────────────────────────────────────────────────────

interface ToolUsed {
  tool: string;
  input: unknown;
}

interface ImageAttachment {
  data: string; // base64
  mediaType: string;
  preview: string; // data URL for preview
  name: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolsUsed?: ToolUsed[];
  apiKeySource?: 'user' | 'system';
  images?: ImageAttachment[];
}

// ─── Tool Display Helpers ───────────────────────────────────────

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  search_customers: { label: 'Searched customers', icon: '👥' },
  get_invoice_details: { label: 'Retrieved invoice details', icon: '📄' },
  list_invoices: { label: 'Listed invoices', icon: '📋' },
  list_expenses: { label: 'Listed expenses', icon: '💸' },
  get_chart_of_accounts: { label: 'Retrieved chart of accounts', icon: '📊' },
  get_general_ledger: { label: 'Retrieved general ledger', icon: '📒' },
  get_trial_balance: { label: 'Generated trial balance', icon: '⚖️' },
  get_profit_loss: { label: 'Generated profit & loss', icon: '📈' },
  get_balance_sheet: { label: 'Generated balance sheet', icon: '🏦' },
  search_products: { label: 'Searched products/inventory', icon: '📦' },
  list_employees: { label: 'Listed employees', icon: '👷' },
  get_payroll_summary: { label: 'Retrieved payroll summary', icon: '💰' },
  get_bank_accounts: { label: 'Retrieved bank accounts', icon: '🏧' },
  get_aging_report: { label: 'Generated aging report', icon: '📅' },
  create_draft_invoice: { label: 'Created draft invoice', icon: '✨' },
  get_pos_daily_sales: { label: 'Retrieved POS daily sales', icon: '🛒' },
};

// ─── Quick Prompts ──────────────────────────────────────────────

const QUICK_PROMPTS = [
  { icon: ChartBarIcon, text: 'How are my sales this month?', color: 'text-blue-600' },
  { icon: CurrencyDollarIcon, text: 'Pull my profit and loss for this quarter', color: 'text-emerald-600' },
  { icon: ExclamationTriangleIcon, text: 'Show me overdue invoices', color: 'text-amber-600' },
  { icon: ArrowTrendingUpIcon, text: 'What customers owe me the most?', color: 'text-purple-600' },
  { icon: DocumentTextIcon, text: 'Get the trial balance', color: 'text-indigo-600' },
  { icon: CubeIcon, text: 'Which products are low on stock?', color: 'text-red-600' },
  { icon: ScaleIcon, text: 'Generate the balance sheet', color: 'text-teal-600' },
  { icon: WrenchScrewdriverIcon, text: 'How do I create a recurring invoice?', color: 'text-orange-600' },
];

// ─── Markdown-like rendering ────────────────────────────────────

function renderContent(content: string) {
  // Simple markdown rendering for bold, bullets, and line breaks
  const lines = content.split('\n');
  return lines.map((line, idx) => {
    // Bold: **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    // Bullet points
    if (line.trimStart().startsWith('- ') || line.trimStart().startsWith('• ')) {
      return (
        <div key={idx} className="flex gap-2 ml-2">
          <span className="text-gray-400 dark:text-gray-500 mt-0.5">•</span>
          <span>{rendered.map((r, i) => typeof r === 'string' ? r.replace(/^[-•]\s*/, '') : r)}</span>
        </div>
      );
    }

    // Empty line → spacing
    if (line.trim() === '') {
      return <div key={idx} className="h-2" />;
    }

    return <div key={idx}>{rendered}</div>;
  });
}

// ─── Tool Results Badge ─────────────────────────────────────────

function ToolsBadge({ tools }: { tools: ToolUsed[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!tools || tools.length === 0) return null;

  return (
    <div className="mt-2 border-t border-gray-200 dark:border-gray-700 pt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 transition-colors"
      >
        <SparklesIcon className="w-3.5 h-3.5" />
        <span>{tools.length} tool{tools.length > 1 ? 's' : ''} used</span>
        {expanded ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          {tools.map((t, i) => {
            const info = TOOL_LABELS[t.tool] || { label: t.tool, icon: '🔧' };
            return (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded px-2 py-1">
                <span>{info.icon}</span>
                <span>{info.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Image Thumbnail Preview ────────────────────────────────────

function ImageThumbnails({ images }: { images: ImageAttachment[] }) {
  if (!images || images.length === 0) return null;
  return (
    <div className="flex gap-2 mt-2">
      {images.map((img, i) => (
        <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const maxFiles = 3;
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    const newImages: ImageAttachment[] = [];

    for (let i = 0; i < Math.min(files.length, maxFiles - pendingImages.length); i++) {
      const file = files[i];
      if (!allowedTypes.includes(file.type)) continue;
      if (file.size > maxSize) continue;

      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      newImages.push({
        data: base64,
        mediaType: file.type,
        preview: URL.createObjectURL(file),
        name: file.name,
      });
    }

    setPendingImages(prev => [...prev, ...newImages].slice(0, maxFiles));

    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingImage = (index: number) => {
    setPendingImages(prev => {
      const newArr = [...prev];
      URL.revokeObjectURL(newArr[index].preview);
      newArr.splice(index, 1);
      return newArr;
    });
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText && pendingImages.length === 0) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText || '(image attached)',
      timestamp: new Date().toISOString(),
      images: pendingImages.length > 0 ? [...pendingImages] : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    const imagesToSend = [...pendingImages];
    setPendingImages([]);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const payload: Record<string, unknown> = {
        message: messageText || 'Please analyze the attached image(s).',
        conversationHistory: history,
      };

      // Include images if present
      if (imagesToSend.length > 0) {
        payload.images = imagesToSend.map(img => ({
          data: img.data,
          mediaType: img.mediaType,
        }));
      }

      const res = await api.post<{ response: string; toolsUsed?: ToolUsed[]; apiKeySource?: string; requiresApiKey?: boolean }>(
        '/api/v1/ai/chat',
        payload
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.response,
        timestamp: new Date().toISOString(),
        toolsUsed: res.toolsUsed,
        apiKeySource: res.apiKeySource as 'user' | 'system' | undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again. If this persists, check your AI API key in Settings > Integrations.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
            <SparklesIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Business Assistant</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Ask questions, run reports, look up data, analyze images, and get actionable business insights
            </p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/40 dark:to-blue-900/40 rounded-full mb-4">
                <SparklesIcon className="w-12 h-12 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">How can I help you today?</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                I can query your real business data, run financial reports, look up customers and inventory, create draft invoices, analyze receipts and images, and provide actionable advice.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-2xl">
                {QUICK_PROMPTS.map((prompt, i) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => handleSend(prompt.text)}
                      className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-left text-sm transition-colors border border-gray-100 dark:border-gray-700"
                    >
                      <Icon className={`w-5 h-5 ${prompt.color} flex-shrink-0`} />
                      <span className="text-gray-700 dark:text-gray-300">{prompt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg h-fit flex-shrink-0">
                      <SparklesIcon className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    {/* Show attached images for user messages */}
                    {message.role === 'user' && message.images && message.images.length > 0 && (
                      <div className="flex gap-2 mb-2">
                        {message.images.map((img, i) => (
                          <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/20">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-sm leading-relaxed">
                      {message.role === 'assistant'
                        ? renderContent(message.content)
                        : <div className="whitespace-pre-wrap">{message.content}</div>
                      }
                    </div>
                    {message.role === 'assistant' && message.toolsUsed && message.toolsUsed.length > 0 && (
                      <ToolsBadge tools={message.toolsUsed} />
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="p-2 bg-emerald-600 rounded-lg h-fit flex-shrink-0">
                      <UserIcon className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg h-fit">
                    <SparklesIcon className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">Analyzing your data...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Pending Image Previews */}
        {pendingImages.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 pt-3">
            <div className="flex gap-2 items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <PhotoIcon className="w-3.5 h-3.5" />
                {pendingImages.length} image{pendingImages.length > 1 ? 's' : ''} attached
              </span>
              <div className="flex gap-2">
                {pendingImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <div className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                    </div>
                    <button
                      onClick={() => removePendingImage(i)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />

            {/* Image upload button */}
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || pendingImages.length >= 3}
              title="Attach image (requires your own API key)"
              className="flex-shrink-0"
            >
              <CameraIcon className="w-5 h-5" />
            </Button>

            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={pendingImages.length > 0 ? 'Describe what you want to know about this image...' : 'Ask about your business, run a report, or look up data...'}
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSend()}
              className="flex-1"
            />
            <Button onClick={() => handleSend()} disabled={(!input.trim() && pendingImages.length === 0) || isLoading}>
              <PaperAirplaneIcon className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
            Powered by Claude AI with real-time access to your business data • Image analysis requires your own API key
          </p>
        </div>
      </Card>
    </div>
  );
}

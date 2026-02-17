'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { usePosStore } from '@/store/posStore';
import { formatJMD } from '@/lib/utils';
import {
  SparklesIcon,
  PaperAirplaneIcon,
  LightBulbIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  { icon: ChartBarIcon, text: 'How are my sales this month?' },
  { icon: CurrencyDollarIcon, text: 'What are my top expenses?' },
  { icon: ExclamationTriangleIcon, text: 'Any low stock items I should reorder?' },
  { icon: ArrowTrendingUpIcon, text: 'Give me a business health summary' },
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { invoices, expenses, customers, products, employees } = useAppStore();
  const { orders } = usePosStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateAIResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();

    // Calculate real-time business metrics
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyInvoices = invoices.filter(i => new Date(i.createdAt) >= thisMonth);
    const monthlyRevenue = monthlyInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0);
    const monthlyOrders = orders.filter(o => new Date(o.createdAt) >= thisMonth && o.status === 'completed');
    const posRevenue = monthlyOrders.reduce((sum, o) => sum + o.total, 0);
    const totalMonthlyRevenue = monthlyRevenue + posRevenue;

    const monthlyExpenses = expenses.filter(e => new Date(e.date) >= thisMonth);
    const totalMonthlyExpenses = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

    const lowStockItems = products.filter(p => p.quantity <= (p.reorderLevel || 0) && p.quantity > 0);
    const outOfStockItems = products.filter(p => p.quantity === 0);

    const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
    const totalReceivables = pendingInvoices.reduce((sum, i) => sum + i.total, 0);

    // Sales related queries
    if (lowerMessage.includes('sales') || lowerMessage.includes('revenue')) {
      return `Here's your sales summary for this month:

**Total Revenue:** ${formatJMD(totalMonthlyRevenue)}
- Invoice Revenue: ${formatJMD(monthlyRevenue)}
- POS Sales: ${formatJMD(posRevenue)}

**Transactions:**
- ${monthlyInvoices.length} invoices created
- ${monthlyOrders.length} POS orders completed

**Outstanding:**
- ${pendingInvoices.length} unpaid invoices
- ${formatJMD(totalReceivables)} in receivables

${totalMonthlyRevenue > totalMonthlyExpenses
  ? `Great news! You're profitable this month with a net of ${formatJMD(totalMonthlyRevenue - totalMonthlyExpenses)}.`
  : `Heads up: Your expenses (${formatJMD(totalMonthlyExpenses)}) exceed revenue this month.`}`;
    }

    // Expense related queries
    if (lowerMessage.includes('expense') || lowerMessage.includes('spending') || lowerMessage.includes('cost')) {
      const expensesByCategory = monthlyExpenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {} as Record<string, number>);

      const sortedCategories = Object.entries(expensesByCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      return `Here's your expense breakdown this month:

**Total Expenses:** ${formatJMD(totalMonthlyExpenses)}

**Top Categories:**
${sortedCategories.map(([cat, amount], i) =>
  `${i + 1}. ${cat}: ${formatJMD(amount)}`
).join('\n')}

**Tip:** ${sortedCategories[0]
  ? `Your highest expense category is ${sortedCategories[0][0]}. Consider reviewing if there are opportunities to optimize.`
  : 'Start tracking expenses to get insights on your spending patterns.'}`;
    }

    // Inventory related queries
    if (lowerMessage.includes('stock') || lowerMessage.includes('inventory') || lowerMessage.includes('reorder')) {
      return `Here's your inventory status:

**Overview:**
- Total Products: ${products.length}
- Low Stock Items: ${lowStockItems.length}
- Out of Stock: ${outOfStockItems.length}

${lowStockItems.length > 0 ? `**Items to Reorder:**
${lowStockItems.slice(0, 5).map(p =>
  `- ${p.name}: ${p.quantity} remaining (reorder at ${p.reorderLevel})`
).join('\n')}` : '**All items are well-stocked!**'}

${outOfStockItems.length > 0 ? `\n**Out of Stock (Urgent):**
${outOfStockItems.slice(0, 5).map(p => `- ${p.name}`).join('\n')}` : ''}`;
    }

    // Customer related queries
    if (lowerMessage.includes('customer') || lowerMessage.includes('client')) {
      const customersWithBalance = customers.filter(c => c.balance > 0);
      const totalCustomerBalance = customers.reduce((sum, c) => sum + c.balance, 0);

      return `Here's your customer overview:

**Customer Base:**
- Total Contacts: ${customers.length}
- Customers: ${customers.filter(c => c.type === 'customer' || c.type === 'both').length}
- Vendors: ${customers.filter(c => c.type === 'vendor' || c.type === 'both').length}

**Receivables:**
- ${customersWithBalance.length} customers with outstanding balance
- Total Receivables: ${formatJMD(totalCustomerBalance)}

${customersWithBalance.length > 0 ? `**Top Outstanding:**
${customersWithBalance.sort((a, b) => b.balance - a.balance).slice(0, 3).map(c =>
  `- ${c.name}: ${formatJMD(c.balance)}`
).join('\n')}` : '**All accounts are current!**'}`;
    }

    // Business health / summary queries
    if (lowerMessage.includes('health') || lowerMessage.includes('summary') || lowerMessage.includes('overview') || lowerMessage.includes('how am i doing')) {
      const profitMargin = totalMonthlyRevenue > 0
        ? ((totalMonthlyRevenue - totalMonthlyExpenses) / totalMonthlyRevenue * 100).toFixed(1)
        : 0;

      return `Here's your business health summary:

**Financial Performance (This Month):**
- Revenue: ${formatJMD(totalMonthlyRevenue)}
- Expenses: ${formatJMD(totalMonthlyExpenses)}
- Net Profit: ${formatJMD(totalMonthlyRevenue - totalMonthlyExpenses)}
- Profit Margin: ${profitMargin}%

**Operations:**
- ${products.length} products in inventory
- ${employees.length} employees on payroll
- ${customers.length} customer/vendor contacts

**Action Items:**
${lowStockItems.length > 0 ? `- ${lowStockItems.length} items need reordering` : '- Inventory levels are healthy'}
${pendingInvoices.length > 0 ? `- ${pendingInvoices.length} invoices pending payment` : '- All invoices collected'}
${outOfStockItems.length > 0 ? `- ${outOfStockItems.length} items out of stock` : ''}

**Overall:** ${
  totalMonthlyRevenue > totalMonthlyExpenses
    ? 'Your business is performing well! Keep up the great work.'
    : 'There are some areas to focus on. Consider following up on receivables and reviewing expenses.'
}`;
    }

    // GCT related queries
    if (lowerMessage.includes('gct') || lowerMessage.includes('tax')) {
      const invoiceGCT = monthlyInvoices.reduce((sum, i) => sum + (i.gctAmount || 0), 0);
      const posGCT = monthlyOrders.reduce((sum, o) => sum + (o.gctAmount || 0), 0);

      return `Here's your GCT summary for this month:

**GCT Collected:**
- From Invoices: ${formatJMD(invoiceGCT)}
- From POS Sales: ${formatJMD(posGCT)}
- **Total GCT:** ${formatJMD(invoiceGCT + posGCT)}

**Note:** Jamaica's standard GCT rate is 15%. Make sure to file your GCT returns by the 15th of the following month.`;
    }

    // Payroll related queries
    if (lowerMessage.includes('payroll') || lowerMessage.includes('employee') || lowerMessage.includes('staff')) {
      const activeEmployees = employees.filter(e => e.isActive);
      const monthlyPayroll = activeEmployees.reduce((sum, e) => sum + (e.baseSalary || 0), 0);

      return `Here's your payroll summary:

**Team:**
- Total Employees: ${employees.length}
- Active: ${activeEmployees.length}

**Monthly Payroll Expense:** ${formatJMD(monthlyPayroll)}

**Statutory Contributions (Estimated):**
- NIS (3%): ${formatJMD(monthlyPayroll * 0.03)}
- NHT (2%): ${formatJMD(monthlyPayroll * 0.02)}
- Education Tax (2.25%): ${formatJMD(monthlyPayroll * 0.0225)}

**Tip:** Don't forget employer contributions for NIS (3%) and NHT (3%).`;
    }

    // Default response
    return `I can help you with insights about your business! Try asking me:

- "How are my sales this month?"
- "What are my top expenses?"
- "Any low stock items I should reorder?"
- "Give me a business health summary"
- "What's my GCT this month?"
- "How's my customer receivables?"
- "What's my payroll looking like?"

I analyze your real business data to give you actionable insights!`;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI thinking
    await new Promise(resolve => setTimeout(resolve, 800));

    const aiResponse = generateAIResponse(input);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(false);
  };

  const handleQuickPrompt = (text: string) => {
    setInput(text);
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
            <h1 className="text-2xl font-bold text-gray-900">AI Business Assistant</h1>
            <p className="text-gray-500">Get insights and answers about your business</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full mb-4">
                <SparklesIcon className="w-12 h-12 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">How can I help you today?</h2>
              <p className="text-gray-500 mb-6 max-w-md">
                I can analyze your business data and provide insights on sales, expenses, inventory, and more.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-lg">
                {QUICK_PROMPTS.map((prompt, i) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => handleQuickPrompt(prompt.text)}
                      className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left text-sm transition-colors"
                    >
                      <Icon className="w-5 h-5 text-purple-600 flex-shrink-0" />
                      <span className="text-gray-700">{prompt.text}</span>
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
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg h-fit">
                      <SparklesIcon className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                  </div>
                  {message.role === 'user' && (
                    <div className="p-2 bg-emerald-600 rounded-lg h-fit">
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
                  <div className="bg-gray-100 rounded-lg p-4">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your business..."
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={!input.trim() || isLoading}>
              <PaperAirplaneIcon className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            AI responses are based on your actual business data
          </p>
        </div>
      </Card>
    </div>
  );
}

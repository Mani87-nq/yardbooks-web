/**
 * POST /api/v1/ai/chat — AI Business Assistant powered by Claude
 * Fetches real business data and provides contextual financial advice.
 */
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { internalError, badRequest } from '@/lib/api-error';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'reports:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message) return badRequest('Message is required');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        response: 'AI features require an Anthropic API key. Please add ANTHROPIC_API_KEY to your environment variables.',
      });
    }

    // Fetch business context for Claude
    const [invoiceStats, expenseStats, customerCount, productStats, employeeCount] = await Promise.all([
      prisma.invoice.aggregate({
        where: { companyId: companyId!, deletedAt: null },
        _sum: { total: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { companyId: companyId!, deletedAt: null },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.customer.count({ where: { companyId: companyId!, deletedAt: null } }),
      prisma.product.findMany({
        where: { companyId: companyId!, deletedAt: null },
        select: { name: true, quantity: true, reorderLevel: true, unitPrice: true },
      }),
      prisma.employee.count({ where: { companyId: companyId! } }),
    ]);

    // Get this month's data
    const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [monthlyInvoices, monthlyExpenses, overdueInvoices] = await Promise.all([
      prisma.invoice.aggregate({
        where: { companyId: companyId!, deletedAt: null, createdAt: { gte: thisMonth }, status: 'PAID' },
        _sum: { total: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { companyId: companyId!, deletedAt: null, date: { gte: thisMonth } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.invoice.findMany({
        where: { companyId: companyId!, deletedAt: null, status: { in: ['SENT', 'OVERDUE'] } },
        select: { invoiceNumber: true, total: true, dueDate: true, customer: { select: { name: true } } },
      }),
    ]);

    const lowStockItems = productStats.filter(p => Number(p.quantity) <= Number(p.reorderLevel || 0));
    const totalInventoryValue = productStats.reduce((sum, p) => sum + (Number(p.unitPrice) * Number(p.quantity ?? 0)), 0);

    const systemPrompt = `You are YaadBooks AI Assistant — an intelligent financial advisor for a Jamaican business using the YaadBooks accounting platform. You speak with a warm, professional tone. Currency is JMD (Jamaican Dollars). Format currency as J$X,XXX.XX.

Here is the current business data:

**This Month:**
- Revenue (paid invoices): J$${Number(monthlyInvoices._sum.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} (${monthlyInvoices._count} invoices)
- Expenses: J$${Number(monthlyExpenses._sum.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} (${monthlyExpenses._count} expenses)
- Net: J$${(Number(monthlyInvoices._sum.total || 0) - Number(monthlyExpenses._sum.amount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}

**Overall:**
- Total invoices: ${invoiceStats._count} (J$${Number(invoiceStats._sum.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })})
- Total expenses: ${expenseStats._count} (J$${Number(expenseStats._sum.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })})
- Customers: ${customerCount}
- Products: ${productStats.length} (Inventory value: J$${totalInventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2 })})
- Employees: ${employeeCount}
- Low stock items: ${lowStockItems.length}${lowStockItems.length > 0 ? ' — ' + lowStockItems.map(p => `${p.name} (${p.quantity} left)`).join(', ') : ''}

**Overdue/Outstanding Invoices:** ${overdueInvoices.length}
${overdueInvoices.slice(0, 10).map(inv => `- ${inv.invoiceNumber}: J$${Number(inv.total).toLocaleString('en-US', { minimumFractionDigits: 2 })} (${inv.customer?.name || 'Unknown'}, due ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'})`).join('\n')}

Provide concise, actionable advice. Use bullet points and bold text for key figures. Keep responses under 300 words unless the user asks for detail.`;

    const client = new Anthropic({ apiKey });

    // Build messages array from conversation history
    const messages = [
      ...conversationHistory.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const completion = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const responseText = completion.content[0].type === 'text' ? completion.content[0].text : 'I could not generate a response.';

    return NextResponse.json({ response: responseText });
  } catch (error) {
    console.error('[AI Chat] Error:', error);
    return internalError(error instanceof Error ? error.message : 'AI chat failed');
  }
}

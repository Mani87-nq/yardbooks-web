/**
 * POST /api/employee/terminal/register
 * Register (or re-register) this browser/device as a named kiosk terminal.
 * Uses terminal JWT auth — the employee must be logged in first.
 *
 * The endpoint:
 *   1. Accepts a device fingerprint (userAgent hash + screen dimensions)
 *   2. Upserts a KioskDevice record for this company + fingerprint
 *   3. Derives a terminal number from the device's position among active devices
 *   4. Returns { terminalId, terminalNumber, deviceName }
 *
 * GET /api/employee/terminal/register
 * Returns the current terminal info if the device is already registered.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { badRequest, internalError } from '@/lib/api-error';

const registerSchema = z.object({
  /** Device fingerprint string (userAgent + screen hash) */
  fingerprint: z.string().min(8).max(512),
  /** Friendly device name (e.g. "iPad Counter 1") */
  deviceName: z.string().min(1).max(100).trim().optional(),
  /** Device type hint */
  deviceType: z.enum(['desktop', 'tablet', 'phone']).optional(),
  /** Screen width for recognition */
  screenWidth: z.number().int().min(100).max(10000).optional(),
  /** Screen height for recognition */
  screenHeight: z.number().int().min(100).max(10000).optional(),
});

// ── GET: Retrieve current terminal info ────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    // Read fingerprint from query param
    const fingerprint = request.nextUrl.searchParams.get('fingerprint');
    if (!fingerprint) {
      return badRequest('Missing fingerprint query parameter.');
    }

    const device = await prisma.kioskDevice.findFirst({
      where: {
        companyId: companyId!,
        deviceToken: fingerprint,
        isActive: true,
      },
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        createdAt: true,
        autoLockMinutes: true,
        loginMode: true,
      },
    });

    if (!device) {
      return NextResponse.json({ registered: false });
    }

    // Derive terminal number: count active devices created before this one + 1
    const terminalNumber = await deriveTerminalNumber(companyId!, device.id);

    return NextResponse.json({
      registered: true,
      terminalId: device.id,
      terminalNumber,
      deviceName: device.deviceName,
      autoLockMinutes: device.autoLockMinutes,
      loginMode: device.loginMode,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get terminal info');
  }
}

// ── POST: Register / re-register a device ──────────────────────
export async function POST(request: NextRequest) {
  try {
    const { companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid request. Provide at least a fingerprint.');
    }

    const { fingerprint, deviceName, deviceType, screenWidth, screenHeight } = parsed.data;
    const userAgent = request.headers.get('user-agent') || undefined;

    // Upsert: find existing device by company + fingerprint, or create new
    const existing = await prisma.kioskDevice.findFirst({
      where: {
        companyId: companyId!,
        deviceToken: fingerprint,
      },
    });

    let device;

    if (existing) {
      // Re-activate and update
      device = await prisma.kioskDevice.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          deviceName: deviceName || existing.deviceName,
          deviceType: deviceType || existing.deviceType,
          userAgent,
          lastSeenAt: new Date(),
        },
        select: {
          id: true,
          deviceName: true,
          deviceType: true,
          autoLockMinutes: true,
          loginMode: true,
        },
      });
    } else {
      // Generate a friendly default name if none provided
      const activeCount = await prisma.kioskDevice.count({
        where: { companyId: companyId!, isActive: true },
      });

      const defaultName = deviceName || `Terminal ${activeCount + 1}`;

      device = await prisma.kioskDevice.create({
        data: {
          companyId: companyId!,
          deviceToken: fingerprint,
          deviceName: defaultName,
          deviceType: deviceType || guessDeviceType(screenWidth, screenHeight, userAgent),
          userAgent,
          lastSeenAt: new Date(),
        },
        select: {
          id: true,
          deviceName: true,
          deviceType: true,
          autoLockMinutes: true,
          loginMode: true,
        },
      });
    }

    // Derive terminal number
    const terminalNumber = await deriveTerminalNumber(companyId!, device.id);

    return NextResponse.json({
      registered: true,
      terminalId: device.id,
      terminalNumber,
      deviceName: device.deviceName,
      deviceType: device.deviceType,
      autoLockMinutes: device.autoLockMinutes,
      loginMode: device.loginMode,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to register terminal');
  }
}

// ── Helpers ────────────────────────────────────────────────────

/**
 * Derive a terminal number by counting active devices for the company
 * that were created before (or at the same time as) this one, ordered by createdAt.
 * Terminal 1 = oldest active device, Terminal 2 = next oldest, etc.
 */
async function deriveTerminalNumber(companyId: string, deviceId: string): Promise<number> {
  const allActiveDevices = await prisma.kioskDevice.findMany({
    where: { companyId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  const index = allActiveDevices.findIndex((d) => d.id === deviceId);
  return index >= 0 ? index + 1 : allActiveDevices.length + 1;
}

/**
 * Guess device type from screen dimensions and user agent.
 */
function guessDeviceType(
  screenWidth?: number,
  screenHeight?: number,
  userAgent?: string | null
): string {
  if (userAgent) {
    const ua = userAgent.toLowerCase();
    if (ua.includes('ipad') || ua.includes('tablet')) return 'tablet';
    if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) {
      // Large phones in landscape could be phone or tablet
      if (screenWidth && screenWidth >= 768) return 'tablet';
      return 'phone';
    }
  }

  // Infer from screen size
  if (screenWidth && screenHeight) {
    const minDimension = Math.min(screenWidth, screenHeight);
    if (minDimension < 480) return 'phone';
    if (minDimension < 1024) return 'tablet';
  }

  return 'desktop';
}

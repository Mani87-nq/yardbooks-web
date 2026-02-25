import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

export const alt = "YaadBooks — Jamaica's Complete Business Management Solution";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle pattern overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.06,
            background:
              'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: 'linear-gradient(90deg, #34d399 0%, #6ee7b7 50%, #34d399 100%)',
          }}
        >
        </div>

        {/* Logo mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100px',
            height: '100px',
            borderRadius: '24px',
            background: 'rgba(255, 255, 255, 0.15)',
            border: '2px solid rgba(255, 255, 255, 0.25)',
            marginBottom: '28px',
            fontSize: '48px',
            fontWeight: 800,
            color: 'white',
            letterSpacing: '-1px',
          }}
        >
          YB
        </div>

        {/* Brand name */}
        <div
          style={{
            fontSize: '64px',
            fontWeight: 800,
            color: 'white',
            letterSpacing: '-2px',
            lineHeight: 1,
            marginBottom: '16px',
          }}
        >
          YaadBooks
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '26px',
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.9)',
            marginBottom: '36px',
            letterSpacing: '-0.5px',
          }}
        >
          Jamaica&apos;s Complete Business Management Solution
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '12px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {['Invoicing', 'POS', 'Payroll', 'Inventory', 'GCT Filing', 'Reports'].map(
            (feature) => (
              <div
                key={feature}
                style={{
                  padding: '8px 20px',
                  borderRadius: '100px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: 600,
                }}
              >
                {feature}
              </div>
            ),
          )}
        </div>

        {/* Bottom URL bar */}
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '18px',
            fontWeight: 500,
          }}
        >
          🇯🇲 yaadbooks.com
        </div>
      </div>
    ),
    { ...size },
  );
}

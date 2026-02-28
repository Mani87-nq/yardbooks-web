import { ImageResponse } from 'next/og';
import { getBlogPost } from '@/data/blog';

export const runtime = 'nodejs';

export const alt = 'YaadBooks Blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  const title = post?.title || 'YaadBooks Blog';
  const category = post?.category || 'Article';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 80px',
          background: 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Pattern overlay */}
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
        />

        {/* Category badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              padding: '6px 16px',
              borderRadius: '100px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            {category}
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: title.length > 60 ? '40px' : '48px',
            fontWeight: 800,
            color: 'white',
            letterSpacing: '-1.5px',
            lineHeight: 1.15,
            maxWidth: '900px',
            marginBottom: '32px',
          }}
        >
          {title}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '80px',
            right: '80px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                fontSize: '20px',
                fontWeight: 800,
                color: 'white',
              }}
            >
              YB
            </div>
            <span
              style={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '18px',
                fontWeight: 600,
              }}
            >
              YaadBooks Blog
            </span>
          </div>

          <span
            style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '16px',
            }}
          >
            yaadbooks.com/blog
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}

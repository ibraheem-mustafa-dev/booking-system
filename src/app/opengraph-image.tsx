import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#0C0C0F',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Subtle orange glow at top */}
        <div
          style={{
            position: 'absolute',
            top: -80,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 600,
            height: 300,
            background: 'radial-gradient(ellipse at center, rgba(248,122,31,0.18) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Calendar icon */}
        <div
          style={{
            width: 80,
            height: 74,
            display: 'flex',
            flexDirection: 'column',
            marginBottom: 32,
          }}
        >
          {/* Header */}
          <div
            style={{
              width: '100%',
              height: 28,
              background: '#F87A1F',
              borderRadius: '6px 6px 0 0',
              display: 'flex',
            }}
          />
          {/* Body */}
          <div
            style={{
              flex: 1,
              border: '2px solid #F87A1F',
              borderTop: 'none',
              borderRadius: '0 0 6px 6px',
              background: 'rgba(248,122,31,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <div style={{ width: 9, height: 9, background: '#F87A1F', borderRadius: '50%' }} />
            <div style={{ width: 9, height: 9, background: '#F87A1F', borderRadius: '50%' }} />
            <div style={{ width: 9, height: 9, background: '#F87A1F', borderRadius: '50%', opacity: 0.35 }} />
          </div>
        </div>

        {/* Text */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: '#F87A1F',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          Small Giants Studio
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          Book a session
        </div>

        {/* Bottom border accent */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: '#F87A1F',
          }}
        />
      </div>
    ),
    { ...size },
  );
}

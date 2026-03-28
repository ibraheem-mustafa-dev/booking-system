import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#0C0C0F',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Calendar icon */}
        <div
          style={{
            width: 112,
            height: 104,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {/* Ring hangers */}
          <div
            style={{
              position: 'absolute',
              top: -6,
              left: 22,
              width: 10,
              height: 18,
              background: '#F87A1F',
              borderRadius: 5,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -6,
              right: 22,
              width: 10,
              height: 18,
              background: '#F87A1F',
              borderRadius: 5,
            }}
          />
          {/* Calendar header */}
          <div
            style={{
              width: '100%',
              height: 38,
              background: '#F87A1F',
              borderRadius: '8px 8px 0 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
          {/* Calendar body */}
          <div
            style={{
              flex: 1,
              border: '3px solid #F87A1F',
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              background: 'rgba(248,122,31,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <div style={{ width: 14, height: 14, background: '#F87A1F', borderRadius: '50%' }} />
            <div style={{ width: 14, height: 14, background: '#F87A1F', borderRadius: '50%' }} />
            <div style={{ width: 14, height: 14, background: '#F87A1F', borderRadius: '50%', opacity: 0.35 }} />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

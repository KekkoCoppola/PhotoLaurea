// Small line icons shared by home, album and focused view.

export const MicIcon = ({ size = 34 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="8.5" y="3" width="7" height="12" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

export const PencilIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17zM14.5 7.5l3 3"
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
)

export const PlayIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10 6z" fill="currentColor" /></svg>
)

export const PauseIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
    <rect x="2.5" y="1.8" width="2.6" height="8.4" rx="0.8" fill="currentColor" />
    <rect x="6.9" y="1.8" width="2.6" height="8.4" rx="0.8" fill="currentColor" />
  </svg>
)

export const SendIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

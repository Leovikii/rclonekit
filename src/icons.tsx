const paths = {
  settings: <><path d="m9 3 1-1h4l1 1 .6 2.2 2 .9 2.1-.6 2 3.5-1.5 1.6v2.3l1.5 1.6-2 3.5-2.1-.6-2 .9L15 22h-5l-.6-2.2-2-.9-2.1.6-2-3.5 1.5-1.6v-2.3L3.3 8.5l2-3.5 2.1.6 2-.9Z"/><circle cx="12" cy="12" r="3"/></>,
  back: <path d="m12 5-7 7 7 7M5 12h15" />,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  plus: <path d="M12 5v14M5 12h14" />,
  drive: <><path d="m5 4-3 10v5h20v-5L19 4ZM2 14h20"/><path d="M6 17h1m3 0h1"/></>,
};
export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

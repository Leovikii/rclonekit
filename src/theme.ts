import { Accordion, Button, Modal, Tooltip, createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'brand', primaryShade: 7, defaultRadius: 4, respectReducedMotion: true,
  fontFamily: '"Segoe UI Variable", "Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif',
  fontSizes: { sm: '0.875rem', md: '0.875rem', xs: '0.75rem' },
  headings: { sizes: { h1: { fontSize: '1.75rem', fontWeight: '600' }, h2: { fontSize: '0.875rem', fontWeight: '600' } } },
  colors: { brand: ['#faf0ff', '#f2dffc', '#e6bff6', '#d99dec', '#cc7ee6', '#bd61de', '#A84BD6', '#9437c1', '#7f2da6', '#69248a'] },
  components: {
    Button: Button.extend({ defaultProps: { size: 'sm', fw: 400 }, styles: {
      root: { height: 'auto', minHeight: '2.25rem', paddingBlock: '0.4rem', maxWidth: '100%' },
      inner: { height: 'auto' }, label: { height: 'auto', whiteSpace: 'normal', lineHeight: 1.5, textBoxTrim: 'none' },
    } }),
    Accordion: Accordion.extend({ defaultProps: { transitionDuration: 180 } }),
    Modal: Modal.extend({ defaultProps: { radius: 8, transitionProps: { transition: 'fade', duration: 160, exitDuration: 120 } } }),
    Tooltip: Tooltip.extend({ defaultProps: { events: { hover: true, focus: true, touch: false }, transitionProps: { duration: 120, exitDuration: 90 } } }),
  },
});

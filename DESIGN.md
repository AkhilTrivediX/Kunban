# Kunban design system

## Scene

A quiet desktop at the start of a focused work block: charcoal hardware, soft daylight, and one small, exact surface that tells you what deserves attention.

## Strategy

Restrained product palette. The moss-green anchor is reserved for committed actions and a small amount of progress feedback.

## Tokens

```css
:root {
  --kb-bg: oklch(1 0 0);
  --kb-surface: oklch(0.985 0.003 160);
  --kb-surface-raised: oklch(1 0 0);
  --kb-ink: oklch(0.22 0.018 248);
  --kb-muted: oklch(0.49 0.018 248);
  --kb-line: oklch(0.88 0.012 210);
  --kb-primary: oklch(0.52 0.112 160);
  --kb-accent: oklch(0.58 0.14 275);
}
```

Use system UI typography, 12px utility text through 28px headings, 12px maximum component radius, and 180–220ms state transitions. Dark mode mirrors the neutral architecture rather than inverting every value mechanically.

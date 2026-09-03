# Tencent Browser Legacy CSS Fallback

Time: 2026-08-06 16:42 CST

## Background

Tencent Browser displayed the site as nearly unstyled HTML in compatibility mode, while the generated Next.js CSS file was reachable with `200 text/css`. The likely cause is an older browser engine failing to parse newer Tailwind/modern CSS features.

## Changes

- Added `public/legacy-fallback.css` with conservative browser fallback rules for layout, header, navigation, cards, grid/flex basics, video aspect ratio, and mobile header behavior.
- Updated `app/layout.tsx` to preload the fallback stylesheet and conditionally enable it only when the browser does not support modern CSS features such as `100dvh` and `oklch()`.
- Avoided unconditional fallback loading so modern browsers keep the normal design without legacy CSS overriding Tailwind styles.

## Verification

- `npm run build` passed.
- Deployed with `SKIP_BUILD=true npm run deploy:aliyun`.
- Production health check passed: 23 pages and 4 APIs.
- Verified `http://106.14.215.238/legacy-fallback.css` returns `200` with `Content-Type: text/css`.
- Verified `http://106.14.215.238/videos` includes the fallback preload and browser capability detection script.

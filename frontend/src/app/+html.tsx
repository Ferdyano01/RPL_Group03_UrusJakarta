import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Root HTML shell untuk mode Web (Expo Router static & SPA).
 * Mengatur judul tab browser, bahasa dokumen, dan metadata dasar UrusJakarta.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>UrusJakarta — Pelaporan Jalan Rusak DKI</title>
        <meta
          name="description"
          content="Platform pelaporan kerusakan jalan DKI Jakarta berbasis Computer Vision YOLO dan AI."
        />
        <meta name="theme-color" content="#FF5E00" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

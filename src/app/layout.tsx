// Root layout - minimal wrapper
// HTML/body, metadata, and scripts are handled by [locale]/layout.tsx
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://listo.to"),
  title: "Listo - Instant Shareable Lists | No Signup Required",
  description: "Create and share lists in seconds. No signup, no app needed. Real-time collaboration, AI-powered item generation, and custom themes. Just share the link.",
  keywords: [
    "shareable list",
    "collaborative checklist",
    "shared grocery list",
    "real-time todo list",
    "no signup list app",
    "instant list maker",
    "AI list generator",
    "shared shopping list",
    "collaborative task list",
    "free online checklist"
  ],
  authors: [{ name: "Listo" }],
  creator: "Listo",
  publisher: "Listo",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://listo.to",
    siteName: "Listo",
    title: "Listo - Instant Shareable Lists",
    description: "Create and share lists in seconds. No signup needed. Real-time collaboration with anyone.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Listo - Instant Shareable Lists",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Listo - Instant Shareable Lists",
    description: "Create and share lists in seconds. No signup needed. Real-time collaboration with anyone.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://listo.to",
  },
  category: "Productivity",
};

const GA_MEASUREMENT_ID = "G-3N0JE969VW";

// JSON-LD structured data for rich search results
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Listo",
  description: "Create and share lists in seconds. No signup, no app needed. Real-time collaboration, AI-powered item generation, and custom themes.",
  url: "https://listo.to",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "No signup required",
    "Real-time collaboration",
    "AI-powered list generation",
    "Voice dictation",
    "Custom AI-generated themes",
    "Instant URL sharing"
  ],
  screenshot: "https://listo.to/og-image.png"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}

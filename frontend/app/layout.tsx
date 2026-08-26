import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Remote Fleet Control',
  description: 'Monitor and remotely operate the driverless fleet.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

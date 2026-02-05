import type { Metadata } from 'next';
import './globals.css';
import { WebSocketProvider } from './contexts/WebSocketContext';

export const metadata: Metadata = {
  title: 'Animall2 Assignment',
  description: 'Milking session management application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WebSocketProvider>
          {children}
        </WebSocketProvider>
      </body>
    </html>
  );
}

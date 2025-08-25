import './globals.scss';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/context/AuthContext';
import { Noto_Sans_KR } from 'next/font/google';

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

export const metadata = {
  title: 'Nextstudy SEO Master',
  description: '넥스트스터디의 SEO 관리 시스템입니다.',
  icons: {
    icon: '/images/nextgong.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang='ko'>
      <body className={notoSansKr.className}>
        <AuthProvider>
          <Header />
          {children}
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}

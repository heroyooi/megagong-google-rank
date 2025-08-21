import './globals.scss';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

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
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}

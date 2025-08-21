// next.config.mjs
import path from 'path';
import { fileURLToPath } from 'url';

/** __dirname 대체 (ESM) */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // SCSS에서 절대경로처럼 사용하기 위해 src를 includePaths에 추가
  sassOptions: {
    includePaths: [path.join(__dirname, 'src')],
  },

  // JS/TS/SCSS 모두에서 사용할 @ alias 등록
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    };
    return config;
  },
};

export default nextConfig;

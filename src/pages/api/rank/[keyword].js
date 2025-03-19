import puppeteer from 'puppeteer';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET 요청만 허용됩니다.' });
  }

  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: '키워드를 입력해주세요.' });
  }

  let browser = null;

  try {
    // ✅ Vercel 환경 확인
    const isVercel = !!process.env.VERCEL;

    // ✅ 실행 가능한 Puppeteer 설정
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--disable-software-rasterizer',
        '--disable-blink-features=AutomationControlled',
      ],
      executablePath: isVercel ? puppeteer.executablePath() : undefined, // Vercel 환경에서 실행 가능한 Chromium 자동 찾기
    });

    const page = await browser.newPage();

    // 🚀 User-Agent 변경 (Google 크롤링 차단 방지)
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
    );

    let currentPage = 1;
    let searchResults = [];
    let foundMegagongRank = null;

    // ✅ 최대 5페이지까지 검색
    while (currentPage <= 5) {
      const searchURL = `https://www.google.com/search?q=${encodeURIComponent(
        keyword
      )}&start=${(currentPage - 1) * 10}`;

      console.log(`🔍 ${currentPage} 페이지 크롤링: ${searchURL}`);

      await page.goto(searchURL, { waitUntil: 'domcontentloaded' });

      const pageResults = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.tF2C, .g')).map(
          (el, index) => ({
            title: el.querySelector('h3')?.innerText || '제목 없음',
            rank: index + 1,
            url: el.querySelector('a')?.href || '',
          })
        );
      });

      if (pageResults.length === 0) {
        console.log(`❌ ${currentPage} 페이지에서 검색 결과를 찾을 수 없음.`);
      }

      searchResults = searchResults.concat(
        pageResults.map((result, index) => ({
          ...result,
          rank: index + 1 + (currentPage - 1) * 10,
        }))
      );

      const megagongResult = searchResults.find((result) =>
        result.url.includes('megagong.net')
      );

      if (megagongResult) {
        foundMegagongRank = megagongResult.rank;
        break;
      }

      currentPage++;
    }

    await browser.close();

    // ✅ 결과 반환
    res.status(200).json({
      keyword,
      activeRank: foundMegagongRank ? foundMegagongRank : 'N/A',
      results: searchResults,
    });
  } catch (error) {
    if (browser) await browser.close();
    res.status(500).json({
      error: '검색 순위를 가져오는 중 오류 발생',
      details: error.message,
    });
  }
}

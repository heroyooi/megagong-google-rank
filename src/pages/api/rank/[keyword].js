import puppeteer from 'puppeteer';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET 요청만 허용됩니다.' });
  }

  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: '키워드를 입력해주세요.' });
  }

  try {
    const browser = await puppeteer.launch({
      headless: 'new', // 최신 headless 모드 사용 (봇 감지 회피)
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled', // 자동화 감지 방지
      ],
    });

    const page = await browser.newPage();

    // User-Agent 설정 (Google이 봇으로 인식하지 않도록)
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
    );

    let currentPage = 1;
    let searchResults = [];
    let foundMegagongRank = null;

    // 최대 5페이지까지 검색
    while (currentPage <= 5) {
      const searchURL = `https://www.google.com/search?q=${encodeURIComponent(
        keyword
      )}&start=${(currentPage - 1) * 10}`;

      await page.goto(searchURL, { waitUntil: 'domcontentloaded' });

      // 크롤링 방지 회피 (navigator.webDriver 속성 제거)
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });

      // 검색 결과 가져오기 (순위 누적 반영)
      const pageResults = await page.evaluate((currentPage) => {
        return Array.from(document.querySelectorAll('.MjjYud')).map(
          (el, index) => ({
            title: el.querySelector('h3')?.innerText || '제목 없음',
            rank: index + 1 + (currentPage - 1) * 10, // 페이지별 순위 누적
            url: el.querySelector('a')?.href || '',
          })
        );
      }, currentPage);

      searchResults = searchResults.concat(pageResults);

      // "megagong.net"이 포함된 검색 결과 찾기
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

    // 결과 반환
    res.status(200).json({
      keyword,
      activeRank: foundMegagongRank ? foundMegagongRank : 'N/A',
      results: searchResults,
    });
  } catch (error) {
    res.status(500).json({
      error: '검색 순위를 가져오는 중 오류 발생',
      details: error.message,
    });
  }
}

import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 15000 });
    
    // Wait a little bit for React to render
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await browser.close();
    console.log('Done.');
  } catch (err) {
    console.error('Error running puppeteer:', err);
    process.exit(1);
  }
})();

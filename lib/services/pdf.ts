import puppeteer from 'puppeteer';
import * as fs from 'fs';

export async function generatePdf(html: string): Promise<Buffer> {
  let browser = null;
  try {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ||
      (fs.existsSync('/usr/bin/chromium-browser') ? '/usr/bin/chromium-browser' :
       fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

    browser = await puppeteer.launch({ 
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',              // Necessari en Docker (rootless)
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',  // Evita crashes en containers amb poc /dev/shm
        '--disable-gpu',
      ]
    });
    const page = await browser.newPage();

    // SEC: Desactivar JS per evitar XSS server-side al renderitzar HTML dinàmic
    await page.setJavaScriptEnabled(false);

    // SEC: Bloquejar peticions a URLs internes (SSRF prevention)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      const isBlocked = url.startsWith('file://') ||
        url.includes('169.254.169.254') ||  // AWS metadata endpoint
        url.includes('localhost') ||
        url.includes('127.0.0.1');
      if (isBlocked) {
        console.warn(`[PDF] SSRF Blocked: ${url}`);
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Set viewport to A4 size roughly for better rendering simulation
    await page.setViewport({ width: 794, height: 1123 }); // A4 at 96 DPI
    
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    
    // Generate PDF
    const pdf = await page.pdf({ 
        format: 'A4', 
        printBackground: true,
        margin: {
            top: '20px',
            bottom: '40px',
            left: '20px',
            right: '20px'
        }
    });
    
    await browser.close();
    browser = null;
    return Buffer.from(pdf);
  } catch (error: any) {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error("Error closing browser after failure:", closeErr);
      }
    }
    console.error("Error generating PDF:", error);
    throw new Error(`Failed to generate PDF: ${error.message || error}`);
  }
}

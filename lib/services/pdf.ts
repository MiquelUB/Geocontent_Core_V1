import puppeteer from 'puppeteer';

export async function generatePdf(html: string): Promise<Buffer> {
  try {
    const browser = await puppeteer.launch({ 
      headless: true,
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
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
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
    return Buffer.from(pdf);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate PDF");
  }
}

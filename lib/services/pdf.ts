import puppeteer from 'puppeteer';

export async function generatePdf(html: string): Promise<Buffer> {
  try {
    const browser = await puppeteer.launch({ 
      headless: true, // Use new headless mode if compatible, or just true
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
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

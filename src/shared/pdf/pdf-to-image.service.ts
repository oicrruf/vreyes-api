import { Injectable } from '@nestjs/common';
import { createCanvas } from 'canvas';

@Injectable()
export class PdfToImageService {
  async toBase64Png(pdfBuffer: Buffer): Promise<string> {
    // Import dinámico para evitar problemas con ESM/CJS
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfjs = require('pdfjs-dist/legacy/build/pdf');
    pdfjs.GlobalWorkerOptions.workerSrc = '';

    const data = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjs.getDocument({
      data,
      isEvalSupported: false,
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    // Escala 2x para mejor calidad de extracción OCR
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    await pdf.destroy();
    return canvas.toBuffer('image/png').toString('base64');
  }
}

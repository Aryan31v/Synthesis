import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

export const extractTextFromFile = async (file: File): Promise<string> => {
  const type = file.type;
  const name = file.name.toLowerCase();

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return extractTextFromPDF(file);
  } else if (type === 'application/zip' || type === 'application/x-zip-compressed' || name.endsWith('.zip')) {
    return extractTextFromZIP(file);
  } else if (type === 'text/plain' || type === 'text/markdown' || name.endsWith('.md') || name.endsWith('.txt')) {
    return await file.text();
  } else {
    throw new Error(`Unsupported file type: ${type}`);
  }
};

const extractTextFromPDF = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += `\n--- Page ${i} ---\n${pageText}`;
  }
  
  return fullText;
};

const extractTextFromZIP = async (file: File): Promise<string> => {
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);
  let fullText = `--- Archive: ${file.name} ---\n`;

  for (const relativePath of Object.keys(contents.files)) {
    const zipEntry = contents.files[relativePath];
    if (!zipEntry.dir) {
      const lowerName = zipEntry.name.toLowerCase();
      // Only extract text-based files from the zip
      if (lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.json') || lowerName.endsWith('.js') || lowerName.endsWith('.ts')) {
        const text = await zipEntry.async("string");
        fullText += `\n\n--- File: ${relativePath} ---\n${text.substring(0, 5000)}`; // Limit file size per entry
      }
    }
  }
  return fullText;
};

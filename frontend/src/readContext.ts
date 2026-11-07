import { unzipSync, strFromU8 } from 'fflate';

export async function readContext(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a supporting file smaller than 10 MB.');
  const extension = file.name.split('.').pop()?.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (extension === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const task = pdfjs.getDocument({ data: bytes });
    try {
      const document = await task.promise;
      let text = '';
      for (let page = 1; page <= Math.min(document.numPages, 50) && text.length < 12000; page++) {
        const content = await (await document.getPage(page)).getTextContent();
        text += content.items.map(item => 'str' in item ? item.str : '').join(' ') + '\n';
      }
      if (!text.trim()) throw new Error('This PDF has no extractable text. Paste a brief summary instead.');
      return text;
    } finally { await task.destroy(); }
  }
  if (extension === 'pptx' || extension === 'docx') {
    let total = 0;
    let tooLarge = false;
    const files = unzipSync(bytes, { filter: entry => {
      const wanted = extension === 'pptx' ? /^ppt\/slides\/slide\d+\.xml$/.test(entry.name) : entry.name === 'word/document.xml';
      if (!wanted) return false;
      total += entry.originalSize;
      if (total > 8 * 1024 * 1024) { tooLarge = true; return false; }
      return true;
    } });
    if (tooLarge) throw new Error('This document expands beyond the text extraction limit. Choose a smaller file.');
    const text = Object.keys(files).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map(name => {
        const xml = new DOMParser().parseFromString(strFromU8(files[name]), 'application/xml');
        return Array.from(xml.getElementsByTagNameNS('*', 't')).map(element => element.textContent ?? '').join(' ');
      }).join('\n');
    if (!text.trim()) throw new Error('No text was found. Slide images and diagrams need a written summary.');
    return text;
  }
  if (!['txt', 'md', 'csv', 'json', 'py', 'js', 'jsx', 'ts', 'tsx', 'java', 'c', 'cpp', 'h', 'html', 'css', 'r', 'sql'].includes(extension ?? '')) {
    throw new Error('Use PDF, PPTX, DOCX, text, or a source-code file. Convert older PPT/DOC files first.');
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!text.trim()) throw new Error('This file is empty.');
  return text;
}

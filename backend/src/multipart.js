import Busboy from 'busboy';
import { ApiError } from './errors.js';

export function parseHintForm(req, config) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const seen = new Set();
    let screenshot = null;
    let problem = null;
    const fail = (code = 'invalid_multipart', status = 422, message = 'Malformed multipart body or too many/oversized form fields.') => {
      problem ??= new ApiError(status, code, message);
    };
    let parser;
    try {
      parser = Busboy({
        headers: req.headers,
        // Busboy emits these limit events at the threshold, so leave one slot/byte.
        // The explicit image and field validators enforce the public inclusive limits.
        limits: { fileSize: config.maxImageBytes + 1, fields: 3, files: 1, parts: 5, fieldSize: 8192, fieldNameSize: 100 },
      });
    } catch {
      reject(new ApiError(422, 'invalid_multipart', 'Malformed multipart body.'));
      return;
    }
    const fieldName = name => {
      if (seen.has(name)) fail('invalid_request', 422, 'Do not repeat multipart fields.');
      if (!['session_id', 'action', 'question', 'screenshot'].includes(name)) fail('invalid_request', 422, 'Unknown multipart field.');
      seen.add(name);
    };
    parser.on('field', (name, value, info) => {
      fieldName(name);
      if (info.nameTruncated || info.valueTruncated) fail();
      fields[name] = value;
    });
    parser.on('file', (name, stream, info) => {
      fieldName(name);
      if (name !== 'screenshot') fail('invalid_request', 422, 'Only screenshot may be a file upload.');
      const chunks = [];
      stream.on('data', chunk => { if (!problem) chunks.push(chunk); });
      stream.on('limit', () => fail('image_too_large', 413, 'Screenshot exceeds the configured image byte limit.'));
      stream.on('error', () => fail());
      stream.on('end', () => {
        if (!problem && name === 'screenshot') screenshot = { buffer: Buffer.concat(chunks), mimetype: info.mimeType };
      });
    });
    for (const event of ['partsLimit', 'filesLimit', 'fieldsLimit']) parser.on(event, () => fail());
    parser.on('error', () => {
      fail();
      reject(problem);
    });
    parser.on('close', () => problem ? reject(problem) : resolve({ fields, screenshot }));
    // express.raw has already bounded this body; Busboy only parses memory.
    parser.end(req.body);
  });
}

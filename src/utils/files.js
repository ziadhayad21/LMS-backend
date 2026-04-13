import fs from 'fs';
import path from 'path';
import { AppError } from './apiResponse.js';

const uploadsRoot = path.resolve('uploads');

export const resolveSafeUploadPath = (storedPath) => {
  if (!storedPath || typeof storedPath !== 'string') {
    throw new AppError('Invalid file path.', 400);
  }

  const absolute = path.resolve(storedPath);

  // Prevent path traversal / escaping uploads directory
  const rootWithSep = uploadsRoot.endsWith(path.sep) ? uploadsRoot : uploadsRoot + path.sep;
  if (!(absolute === uploadsRoot || absolute.startsWith(rootWithSep))) {
    throw new AppError('Invalid file location.', 400);
  }

  return absolute;
};

export const assertFileExists = (absolutePath) => {
  if (!fs.existsSync(absolutePath)) {
    throw new AppError('File not found on server.', 404);
  }
};

export const sendInlinePdf = (res, absolutePath, filename = 'file.pdf') => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${String(filename).replace(/"/g, '')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.sendFile(absolutePath);
};

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { badRequest } from '../../core/http.js';

const storageRootDir = path.resolve(process.cwd(), 'storage', 'hr');

if (!fs.existsSync(storageRootDir)) {
  fs.mkdirSync(storageRootDir, { recursive: true });
}

const memoryStorage = multer.memoryStorage();

export const uploadPhoto = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(badRequest('Solo se permiten imágenes JPEG, PNG o WebP para la fotografía.'));
    }
  }
});

export const uploadDocument = multer({
  storage: memoryStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'text/plain'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(badRequest('Tipo de archivo no permitido. Solo PDF, Word, Excel, texto o imágenes.'));
    }
  }
});

/**
 * Wraps a multer middleware so file size and filter errors return 400 JSON responses cleanly.
 */
export function withUpload(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, err => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const msg = err.code === 'LIMIT_FILE_SIZE'
          ? 'El archivo excede el tamaño máximo permitido.'
          : `Error al procesar archivo: ${err.message}`;
        return res.status(400).json({ message: msg });
      }
      return res.status(err.status || 400).json({ message: err.message || 'Archivo no válido.' });
    });
  };
}

/**
 * Saves a buffer to disk with sha256 content addressing and registers it in HrFiles.
 */
export async function saveFile({ pool, buffer, originalName, mimeType, companyId, userId, folder = 'docs' }) {
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const safeExt = (path.extname(originalName) || '').replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10);
  const fileUuid = crypto.randomUUID();
  const filename = `${fileUuid}_${sha256.slice(0, 16)}${safeExt}`;

  const safeFolder = String(folder).replace(/[^a-zA-Z0-9_-]/g, '') || 'docs';
  const targetDir = path.join(storageRootDir, String(Number(companyId) || 0), safeFolder);
  await fsp.mkdir(targetDir, { recursive: true });

  const diskPath = path.join(targetDir, filename);
  await fsp.writeFile(diskPath, buffer);

  const storageKey = path.join(String(Number(companyId) || 0), safeFolder, filename).replace(/\\/g, '/');

  const file = await pool.insert('HrFiles', {
    Id: fileUuid,
    CompanyId: companyId,
    StorageKey: storageKey,
    OriginalName: String(originalName || 'archivo').slice(0, 255),
    MimeType: mimeType,
    SizeBytes: buffer.length,
    Sha256: sha256,
    UploadedBy: userId || null
  });

  return {
    Id: file.Id,
    OriginalName: file.OriginalName,
    MimeType: file.MimeType,
    SizeBytes: file.SizeBytes,
    Sha256: file.Sha256
  };
}

/**
 * Resolves full path on disk for a given storageKey and prevents directory traversal outside storageRootDir.
 */
export function getFilePath(storageKey) {
  if (!storageKey || typeof storageKey !== 'string') {
    throw badRequest('Clave de almacenamiento inválida.');
  }
  const resolved = path.resolve(storageRootDir, storageKey);
  const rootWithSep = storageRootDir.endsWith(path.sep) ? storageRootDir : storageRootDir + path.sep;
  if (resolved !== storageRootDir && !resolved.startsWith(rootWithSep)) {
    throw badRequest('Ruta de archivo fuera del directorio permitido.');
  }
  return resolved;
}

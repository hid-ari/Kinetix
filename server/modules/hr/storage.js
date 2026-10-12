import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';

// Storage directory outside /public
const storageRootDir = path.resolve(process.cwd(), 'storage', 'hr');

// Ensure directories exist
if (!fs.existsSync(storageRootDir)) {
  fs.mkdirSync(storageRootDir, { recursive: true });
}

// Memory storage for multer so we can compute sha256 and store with custom structure
const memoryStorage = multer.memoryStorage();

export const uploadPhoto = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes JPEG, PNG o WebP para la fotografía.'));
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
      cb(new Error('Tipo de archivo no permitido. Solo PDF, Word, Excel, texto o imágenes.'));
    }
  }
});

/**
 * Saves a buffer to disk with sha256 content addressing and registers it in dbo.HrFiles.
 */
export async function saveFile({ pool, buffer, originalName, mimeType, companyId, userId, folder = 'docs' }) {
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const ext = path.extname(originalName) || '';
  const fileUuid = crypto.randomUUID();
  const filename = `${fileUuid}_${sha256.slice(0, 16)}${ext}`;

  const targetDir = path.join(storageRootDir, String(companyId), folder);
  await fsp.mkdir(targetDir, { recursive: true });

  const diskPath = path.join(targetDir, filename);
  await fsp.writeFile(diskPath, buffer);

  // Storage key relative to storage root
  const storageKey = path.join(String(companyId), folder, filename).replace(/\\/g, '/');

  const result = await pool.request()
    .input('id', fileUuid)
    .input('companyId', companyId)
    .input('storageKey', storageKey)
    .input('originalName', originalName)
    .input('mimeType', mimeType)
    .input('sizeBytes', buffer.length)
    .input('sha256', sha256)
    .input('uploadedBy', userId || null)
    .query(`
      INSERT INTO dbo.HrFiles (Id, CompanyId, StorageKey, OriginalName, MimeType, SizeBytes, Sha256, UploadedBy)
      OUTPUT INSERTED.Id, INSERTED.OriginalName, INSERTED.MimeType, INSERTED.SizeBytes, INSERTED.Sha256
      VALUES (@id, @companyId, @storageKey, @originalName, @mimeType, @sizeBytes, @sha256, @uploadedBy);
    `);

  return result.recordset[0];
}

/**
 * Resolves full path on disk for a given storageKey
 */
export function getFilePath(storageKey) {
  return path.resolve(storageRootDir, storageKey);
}

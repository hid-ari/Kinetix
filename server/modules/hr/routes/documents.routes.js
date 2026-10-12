import express from 'express';
import fs from 'node:fs';
import {
  listEmployeeDocuments,
  getDocumentById,
  addEmployeeDocument,
  addDocumentVersion,
  softDeleteDocument
} from '../repositories/documents.repo.js';
import { getEmployeeById } from '../repositories/employees.repo.js';
import { assertCompanyAccess, assertEmployeeAccess, hasPermission, isGlobalAdmin, isCompanyAdmin } from '../access.js';
import { uploadDocument, saveFile, getFilePath } from '../storage.js';

export function createDocumentsRouter(ctx) {
  const router = express.Router();
  const { pool, requirePermission, writeAudit } = ctx;

  router.get('/employees/:id/documents', requirePermission('RRHH Expedientes', 'Ver documentos'), async (req, res) => {
    try {
      await assertEmployeeAccess(pool, req, req.params.id);
      const canViewConfidential = isGlobalAdmin(req) || isCompanyAdmin(req) || await hasPermission(pool, req.user.userId, 'RRHH Expedientes', 'Ver documentos confidenciales', req);
      const docs = await listEmployeeDocuments(pool, req.params.id, { canViewConfidential });
      res.json(docs);
    } catch (err) {
      console.error('Error listing documents:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al listar documentos.' });
    }
  });

  router.post('/employees/:id/documents', requirePermission('RRHH Expedientes', 'Cargar documentos'), uploadDocument.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Se requiere adjuntar un archivo.' });
      }

      const emp = await getEmployeeById(pool, req.params.id);
      if (!emp) return res.status(404).json({ message: 'Empleado no encontrado.' });
      await assertCompanyAccess(pool, req, emp.CompanyId);

      const { documentTypeId, title, description, isConfidential, issueDate, expiryDate } = req.body;
      if (!documentTypeId || !title?.trim()) {
        return res.status(400).json({ message: 'Tipo de documento y título son obligatorios.' });
      }

      // Save file
      const savedFile = await saveFile({
        pool,
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        companyId: emp.CompanyId,
        userId: req.user.userId,
        folder: 'docs'
      });

      const doc = await addEmployeeDocument(pool, {
        employeeId: emp.Id,
        companyId: emp.CompanyId,
        documentTypeId,
        title,
        description,
        fileId: savedFile.Id,
        isConfidential: isConfidential === 'true' || isConfidential === true,
        issueDate,
        expiryDate,
        userId: req.user.userId
      });

      await writeAudit(req, 'UPLOAD', 'RRHH Expedientes', 'HrEmployeeDocument', String(doc.Id), emp.CompanyId, {
        newValues: {
          title,
          originalName: req.file.originalname,
          sizeBytes: req.file.size
        }
      });

      res.status(201).json(doc);
    } catch (err) {
      console.error('Error uploading document:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al cargar documento.' });
    }
  });

  router.post('/documents/:id/versions', requirePermission('RRHH Expedientes', 'Cargar documentos'), uploadDocument.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'Se requiere adjuntar un archivo.' });

      const currentDoc = await getDocumentById(pool, req.params.id);
      if (!currentDoc || currentDoc.IsDeleted) return res.status(404).json({ message: 'Documento no encontrado.' });
      await assertCompanyAccess(pool, req, currentDoc.CompanyId);

      const savedFile = await saveFile({
        pool,
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        companyId: currentDoc.CompanyId,
        userId: req.user.userId,
        folder: 'docs'
      });

      const newVer = await addDocumentVersion(pool, {
        rootDocId: currentDoc.Id,
        fileId: savedFile.Id,
        title: req.body.title,
        description: req.body.description,
        userId: req.user.userId
      });

      await writeAudit(req, 'UPLOAD', 'RRHH Expedientes', 'HrEmployeeDocument', String(newVer.Id), currentDoc.CompanyId, {
        context: `Nueva versión ${newVer.VersionNumber} para documento ${currentDoc.Id}`
      });

      res.status(201).json(newVer);
    } catch (err) {
      console.error('Error adding document version:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al crear versión de documento.' });
    }
  });

  router.get('/documents/:id/download', requirePermission('RRHH Expedientes', 'Ver documentos'), async (req, res) => {
    try {
      const doc = await getDocumentById(pool, req.params.id);
      if (!doc || doc.IsDeleted) return res.status(404).json({ message: 'Documento no encontrado.' });
      await assertCompanyAccess(pool, req, doc.CompanyId);

      if (doc.IsConfidential) {
        const canViewConfidential = isGlobalAdmin(req) || isCompanyAdmin(req) || await hasPermission(pool, req.user.userId, 'RRHH Expedientes', 'Ver documentos confidenciales', req);
        if (!canViewConfidential) {
          return res.status(403).json({ message: 'No tienes autorización para acceder a este documento confidencial.' });
        }
      }

      const filePath = getFilePath(doc.StorageKey);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'El archivo físico no se encuentra disponible.' });
      }

      await writeAudit(req, 'DOWNLOAD', 'RRHH Expedientes', 'HrEmployeeDocument', String(doc.Id), doc.CompanyId);

      res.setHeader('Content-Type', doc.MimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.OriginalName)}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      console.error('Error downloading document:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al descargar documento.' });
    }
  });

  router.delete('/documents/:id', requirePermission('RRHH Expedientes', 'Eliminar documentos'), async (req, res) => {
    try {
      const doc = await getDocumentById(pool, req.params.id);
      if (!doc || doc.IsDeleted) return res.status(404).json({ message: 'Documento no encontrado.' });
      await assertCompanyAccess(pool, req, doc.CompanyId);

      const deleted = await softDeleteDocument(pool, doc.Id, req.user.userId);

      await writeAudit(req, 'DELETE', 'RRHH Expedientes', 'HrEmployeeDocument', String(doc.Id), doc.CompanyId, {
        oldValues: { title: doc.Title, originalName: doc.OriginalName }
      });

      res.json({ message: 'Documento eliminado del expediente.', id: deleted.Id });
    } catch (err) {
      console.error('Error deleting document:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al eliminar documento.' });
    }
  });

  return router;
}

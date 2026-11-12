import { Router } from 'express';
import { db } from '../../../core/db.js';
import { requirePermission, isGlobalAdmin } from '../../../core/auth.js';
import { getContacts, createContact } from '../repositories/contacts.repo.js';

export function createContactsRouter() {
  const router = Router();

  router.get('/contacts', requirePermission('Finanzas', 'Ver finanzas'), async (request, response) => {
    try {
      const contacts = await getContacts(db, {
        companyId: request.user.companyId,
        isGlobal: isGlobalAdmin(request)
      });
      response.json(contacts);
    } catch (error) {
      console.error('Finance contacts query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar los contactos.' });
    }
  });

  router.post('/contacts', requirePermission('Finanzas', 'Registrar transacciones'), async (request, response) => {
    const { type, name, taxId, email, phone } = request.body;
    if (!['Cliente', 'Proveedor'].includes(type) || !name?.trim()) {
      return response.status(400).json({ message: 'Tipo y nombre del contacto son obligatorios.' });
    }

    try {
      const created = await createContact(db, {
        companyId: request.user.companyId,
        type,
        name,
        taxId,
        email,
        phone
      });
      response.status(201).json(created);
    } catch (error) {
      console.error('Finance contact creation failed:', error.message);
      response.status(500).json({ message: 'No fue posible registrar el contacto.' });
    }
  });

  return router;
}

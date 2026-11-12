import { Router } from 'express';
import { db, isUniqueViolation } from '../../../core/db.js';
import { requirePermission, isGlobalAdmin, writeAudit } from '../../../core/auth.js';
import {
  getProducts,
  createProduct,
  updateProduct,
  updateProductStatus,
  getStock,
  getMovements,
  recordStockMovement
} from '../repositories/inventory.repo.js';

export function createInventoryRouter() {
  const router = Router();

  router.get('/products', requirePermission('Productos', 'Ver productos'), async (request, response) => {
    try {
      const products = await getProducts(db, {
        companyId: request.user.companyId,
        isGlobal: isGlobalAdmin(request)
      });
      response.json(products);
    } catch (error) {
      console.error('Products query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar los productos.' });
    }
  });

  router.post('/products', requirePermission('Productos', 'Crear productos'), async (request, response) => {
    const { sku, name, category, unit = 'und.', minimum = 0, price = 0, companyId } = request.body;
    const targetCompanyId = isGlobalAdmin(request) ? Number(companyId || request.user.companyId) : request.user.companyId;

    if (!Number.isInteger(Number(targetCompanyId)) || !sku?.trim() || !name?.trim() || Number(minimum) < 0 || Number(price) < 0) {
      return response.status(400).json({ message: 'Empresa, SKU, nombre y valores válidos son obligatorios.' });
    }

    try {
      const created = await createProduct(db, {
        targetCompanyId,
        sku,
        name,
        category,
        unit,
        minimum,
        price
      });

      await writeAudit(request, 'CREATE', 'Productos', 'Product', created.id, targetCompanyId);
      response.status(201).json(created);
    } catch (error) {
      console.error('Product creation failed:', error.message);
      const isDuplicate = isUniqueViolation(error);
      response.status(isDuplicate ? 409 : 500).json({
        message: isDuplicate ? 'Ese SKU ya existe en la empresa.' : 'No fue posible crear el producto.'
      });
    }
  });

  router.put('/products/:id', requirePermission('Productos', 'Editar productos'), async (request, response) => {
    const { sku, name, category, unit = 'und.', minimum = 0, price = 0 } = request.body;
    if (!sku?.trim() || !name?.trim() || Number(minimum) < 0 || Number(price) < 0) {
      return response.status(400).json({ message: 'SKU, nombre y valores válidos son obligatorios.' });
    }

    try {
      const updated = await updateProduct(db, {
        id: request.params.id,
        sku,
        name,
        category,
        unit,
        minimum,
        price,
        companyId: request.user.companyId,
        isGlobal: isGlobalAdmin(request)
      });

      if (!updated) {
        return response.status(404).json({ message: 'Producto no encontrado.' });
      }

      await writeAudit(request, 'UPDATE', 'Productos', 'Product', request.params.id);
      response.json(updated);
    } catch (error) {
      console.error('Product update failed:', error.message);
      const isDuplicate = isUniqueViolation(error);
      response.status(isDuplicate ? 409 : 500).json({
        message: isDuplicate ? 'Ese SKU ya existe en la empresa.' : 'No fue posible actualizar el producto.'
      });
    }
  });

  router.patch('/products/:id/status', requirePermission('Productos', 'Editar productos'), async (request, response) => {
    if (typeof request.body?.isActive !== 'boolean') {
      return response.status(400).json({ message: 'isActive debe ser booleano.' });
    }

    try {
      const updated = await updateProductStatus(db, {
        id: request.params.id,
        isActive: request.body.isActive,
        companyId: request.user.companyId,
        isGlobal: isGlobalAdmin(request)
      });

      if (!updated) {
        return response.status(404).json({ message: 'Producto no encontrado.' });
      }

      await writeAudit(request, request.body.isActive ? 'ACTIVATE' : 'DEACTIVATE', 'Productos', 'Product', request.params.id);
      response.json(updated);
    } catch (error) {
      console.error('Product status update failed:', error.message);
      response.status(500).json({ message: 'No fue posible actualizar el producto.' });
    }
  });

  router.get('/stock', requirePermission('Existencias', 'Ver existencias'), async (request, response) => {
    try {
      const stock = await getStock(db, {
        companyId: request.user.companyId,
        isGlobal: isGlobalAdmin(request)
      });
      response.json(stock);
    } catch (error) {
      console.error('Stock query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar las existencias.' });
    }
  });

  router.get('/movements', requirePermission('Movimientos', 'Ver movimientos'), async (request, response) => {
    try {
      const movements = await getMovements(db, {
        companyId: request.user.companyId,
        isGlobal: isGlobalAdmin(request)
      });
      response.json(movements);
    } catch (error) {
      console.error('Movements query failed:', error.message);
      response.status(500).json({ message: 'No fue posible cargar los movimientos.' });
    }
  });

  router.post('/movements', requirePermission('Movimientos', 'Registrar movimientos'), async (request, response) => {
    const { productId, branchId, type, quantity, notes } = request.body;
    if (!Number.isInteger(Number(productId)) || !Number.isInteger(Number(branchId)) || !Number(quantity) || !['Entrada', 'Salida'].includes(type)) {
      return response.status(400).json({ message: 'Producto, sucursal, tipo y cantidad válida son obligatorios.' });
    }

    try {
      const movement = await recordStockMovement(db, {
        productId,
        branchId,
        type,
        quantity,
        notes,
        userId: request.user.userId,
        companyId: request.user.companyId,
        isGlobal: isGlobalAdmin(request)
      });

      response.status(201).json(movement);
    } catch (error) {
      console.error('Movement creation failed:', error.message);
      response.status(error.status || 500).json({
        message: error.status ? error.message : 'No fue posible registrar el movimiento.'
      });
    }
  });

  return router;
}

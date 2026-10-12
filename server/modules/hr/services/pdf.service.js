import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import { getFilePath } from '../storage.js';

export function generateEmployeePdf(employee, res, { companyName = 'Kinetix Core', photoStorageKey = null } = {}) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: {
      Title: `Ficha del Empleado - ${employee.FullName}`,
      Author: 'Kinetix Core HR',
      Subject: 'Expediente Laboral'
    }
  });

  doc.pipe(res);

  const navy = '#0f172a';
  const royal = '#2563eb';
  const muted = '#64748b';
  const line = '#e2e8f0';
  const paper = '#f8fafc';

  // Header banner
  doc.rect(40, 40, 515, 60).fill(navy);
  doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('KINETIX CORE', 55, 52);
  doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text(`SISTEMA DE GESTIÓN DE RECURSOS HUMANOS · ${companyName.toUpperCase()}`, 55, 74);
  doc.fillColor('#ffffff').fontSize(9).text(`Fecha: ${new Date().toLocaleDateString('es-DO')}`, 430, 62, { align: 'right' });

  // Main Card
  const topY = 115;
  doc.rect(40, topY, 515, 95).fillAndStroke(paper, line);

  // Photo / Avatar Box
  let photoDrawn = false;
  if (photoStorageKey) {
    try {
      const fullPath = getFilePath(photoStorageKey);
      if (fs.existsSync(fullPath)) {
        doc.image(fullPath, 55, topY + 12, { width: 70, height: 70, fit: [70, 70], align: 'center' });
        photoDrawn = true;
      }
    } catch (_) {}
  }

  if (!photoDrawn) {
    doc.rect(55, topY + 12, 70, 70).fillAndStroke('#eff6ff', '#bfdbfe');
    const initials = (employee.FirstName[0] + (employee.LastName ? employee.LastName[0] : '')).toUpperCase();
    doc.fillColor(royal).fontSize(22).font('Helvetica-Bold').text(initials, 55, topY + 36, { width: 70, align: 'center' });
  }

  // Employee details in header card
  doc.fillColor(navy).fontSize(16).font('Helvetica-Bold').text(employee.FullName, 140, topY + 15);
  doc.fillColor(muted).fontSize(10).font('Helvetica').text(`Código: ${employee.EmployeeCode}   ·   Estado: ${employee.Status.toUpperCase()}`, 140, topY + 36);
  doc.fillColor(royal).fontSize(11).font('Helvetica-Bold').text(`${employee.PositionTitle || 'Sin cargo asignado'}`, 140, topY + 54);
  doc.fillColor(muted).fontSize(9).font('Helvetica').text(`${employee.DepartmentName || 'Sin departamento'}  ·  ${employee.BranchName || 'Sin sucursal'}`, 140, topY + 70);

  let currentY = 225;

  function drawSectionTitle(title, y) {
    doc.rect(40, y, 515, 22).fill('#f1f5f9');
    doc.fillColor(navy).fontSize(10).font('Helvetica-Bold').text(title.toUpperCase(), 50, y + 6);
    return y + 30;
  }

  function drawField(label, value, x, y, width = 160) {
    doc.fillColor(muted).fontSize(8).font('Helvetica-Bold').text(label.toUpperCase(), x, y);
    doc.fillColor(navy).fontSize(9.5).font('Helvetica').text(String(value || 'N/D'), x, y + 11, { width, ellipsis: true });
  }

  // Section 1: Datos Personales
  currentY = drawSectionTitle('1. Información Personal y de Identidad', currentY);

  drawField('Tipo de Documento', employee.DocumentType, 50, currentY);
  drawField('Número de Documento', employee.DocumentNumber, 210, currentY);
  drawField('Fecha de Nacimiento', employee.BirthDate ? new Date(employee.BirthDate).toLocaleDateString('es-DO') : 'N/D', 370, currentY);

  currentY += 32;
  drawField('Sexo', employee.Sex === 'M' ? 'Masculino' : employee.Sex === 'F' ? 'Femenino' : 'Otro', 50, currentY);
  drawField('Nacionalidad', employee.Nationality, 210, currentY);
  drawField('Estado Civil', employee.MaritalStatus, 370, currentY);

  currentY += 32;
  drawField('Teléfono', employee.Phone, 50, currentY);
  drawField('Correo Electrónico', employee.Email, 210, currentY);
  drawField('Dirección Residencial', employee.Address, 370, currentY, 175);

  currentY += 45;

  // Section 2: Datos Laborales
  currentY = drawSectionTitle('2. Información Laboral y Organizacional', currentY);

  drawField('Empresa / Razón Social', companyName, 50, currentY);
  drawField('Sucursal / Sede', employee.BranchName, 210, currentY);
  drawField('Departamento', employee.DepartmentName, 370, currentY);

  currentY += 32;
  drawField('Cargo', employee.PositionTitle, 50, currentY);
  drawField('Nivel Jerárquico', employee.HierarchyLevel ? `Nivel ${employee.HierarchyLevel}` : 'N/D', 210, currentY);
  drawField('Supervisor Inmediato', employee.SupervisorName || 'Ninguno', 370, currentY);

  currentY += 32;
  drawField('Fecha de Ingreso', employee.HireDate ? new Date(employee.HireDate).toLocaleDateString('es-DO') : 'N/D', 50, currentY);
  drawField('Tipo de Contrato', employee.ContractTypeName, 210, currentY);
  drawField('Modalidad de Trabajo', employee.WorkModalityName, 370, currentY);

  currentY += 32;
  if (employee.BaseSalary !== undefined) {
    const formattedSal = new Intl.NumberFormat('es-DO', { style: 'currency', currency: employee.SalaryCurrency || 'DOP' }).format(employee.BaseSalary);
    drawField('Salario Base', formattedSal, 50, currentY);
    drawField('Frecuencia de Pago', employee.PayFrequency, 210, currentY);
  }
  drawField('Cuenta de Usuario', employee.UserAccountEmail || 'Sin usuario vinculado', 370, currentY);

  currentY += 45;

  // Section 3: Contactos de Emergencia
  if (employee.emergencyContacts && employee.emergencyContacts.length > 0) {
    currentY = drawSectionTitle('3. Contactos de Emergencia', currentY);
    for (const c of employee.emergencyContacts) {
      drawField('Nombre Completo', `${c.FullName} ${c.IsPrimary ? '(Principal)' : ''}`, 50, currentY);
      drawField('Parentesco / Relación', c.Relationship, 210, currentY);
      drawField('Teléfonos', `${c.Phone}${c.AltPhone ? ` / ${c.AltPhone}` : ''}`, 370, currentY);
      currentY += 28;
    }
  }

  // Footer Disclaimer
  doc.rect(40, 750, 515, 45).fillAndStroke('#f8fafc', line);
  doc.fillColor(muted).fontSize(7.5).font('Helvetica').text(
    'DOCUMENTO CONFIDENCIAL — PROPIEDAD EXCLUSIVA DE LA EMPRESA.\n' +
    'Esta ficha de empleado contiene datos personales protegidos. Su reproducción o divulgación no autorizada está prohibida.\n' +
    'Generado automáticamente por el Módulo de Recursos Humanos de Kinetix Core.',
    50, 758, { align: 'center', width: 495 }
  );

  doc.end();
}

import { state } from '../../core/state.js';
import { escapeHtml, initials, displayDate } from '../../components/utils.js';
import { breadcrumb, pageHeader } from '../../components/ui.js';
import { hrBadge } from './employees.view.js';

export function employeeDetailView(employee) {
  if (!employee) {
    return `
      ${breadcrumb([['dashboard', 'Inicio'], ['hr-dashboard', 'Recursos Humanos'], ['hr-employees', 'Empleados']])}
      <div class="panel empty">Empleado no encontrado o sin permisos suficientes.</div>
    `;
  }

  const fullName = `${employee.FirstName} ${employee.LastName}`;
  const empInitials = initials(fullName);
  const photoUrl = employee.PhotoFileId ? `/api/hr/employees/${employee.Id}/photo` : null;

  const currentTab = state.hr.employeeTab || 'resumen';
  const history = state.hr.currentEmployeeHistory || [];
  const documents = state.hr.currentEmployeeDocuments || [];

  const isActive = employee.Status === 'Activo';
  const isTerminated = employee.Status === 'Desvinculado';

  // Format salary
  let salaryDisplay = 'No disponible';
  if (employee.BaseSalary !== undefined) {
    salaryDisplay = new Intl.NumberFormat('es-DO', { style: 'currency', currency: employee.SalaryCurrency || 'DOP' }).format(employee.BaseSalary);
  }

  return `
    ${breadcrumb([['dashboard', 'Inicio'], ['hr-dashboard', 'Recursos Humanos'], ['hr-employees', 'Empleados'], ['hr-employee-detail', fullName]])}

    <!-- Hero Card -->
    <div class="company-hero-card" style="margin-bottom: 20px;">
      <div class="company-hero-main">
        <div class="company-hero-avatar" style="width:72px; height:72px; font-size:24px; position:relative; overflow:hidden; border-radius:14px; background:#eff6ff; color:var(--royal); border:2px solid #bfdbfe;">
          ${photoUrl ? `<img src="${photoUrl}" alt="${escapeHtml(fullName)}" style="width:100%;height:100%;object-fit:cover;">` : escapeHtml(empInitials)}
        </div>
        <div class="company-hero-details">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h1 style="margin:0; font-size:24px;">${escapeHtml(fullName)}</h1>
            ${hrBadge(employee.Status)}
            <span style="font-family:monospace; background:#e2e8f0; color:var(--navy); padding:2px 8px; border-radius:5px; font-weight:700; font-size:12px;">
              ${escapeHtml(employee.EmployeeCode)}
            </span>
          </div>
          <p style="margin-top:6px; font-size:13px; color:#475569;">
            <strong>${escapeHtml(employee.PositionTitle || 'Sin cargo')}</strong>
            <span>·</span>
            <span>${escapeHtml(employee.DepartmentName || 'Sin departamento')}</span>
            <span>·</span>
            <span>${escapeHtml(employee.BranchName || 'General')}</span>
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="inline-actions" style="align-items:center;">
        <button class="secondary" data-action="download-employee-pdf" data-id="${employee.Id}" title="Descargar expediente formal en PDF">
          <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;"><path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clip-rule="evenodd"/></svg>
          <span>Ficha PDF</span>
        </button>

        <button class="secondary" data-action="open-photo-upload" data-id="${employee.Id}" title="Cambiar fotografía del empleado">
          📷 Foto
        </button>

        ${!isTerminated ? `
          <button class="secondary" data-action="edit-employee" data-id="${employee.Id}">
            ✏️ Editar
          </button>

          <!-- Movements Dropdown / Action Group -->
          <div style="display:flex; gap:6px;">
            <button class="secondary" data-action="open-movement-modal" data-movement="transfer" data-id="${employee.Id}">
              Transferir
            </button>
            <button class="secondary" data-action="open-movement-modal" data-movement="promote" data-id="${employee.Id}">
              Ascenso
            </button>
            <button class="secondary" data-action="open-movement-modal" data-movement="salary" data-id="${employee.Id}">
              Salario
            </button>
            ${isActive ? `
              <button class="secondary" data-action="open-movement-modal" data-movement="suspend" data-id="${employee.Id}">
                Suspender
              </button>
              <button class="secondary" data-action="open-movement-modal" data-movement="leave" data-id="${employee.Id}">
                Licencia
              </button>
            ` : `
              <button class="primary" data-action="open-movement-modal" data-movement="reactivate" data-id="${employee.Id}">
                Reactivar
              </button>
            `}
            <button class="danger" data-action="open-movement-modal" data-movement="terminate" data-id="${employee.Id}">
              Desvincular
            </button>
          </div>
        ` : `
          <button class="primary" data-action="open-movement-modal" data-movement="reactivate" data-id="${employee.Id}">
            Reactivar Colaborador
          </button>
        `}
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="detail-tabs">
      <button class="${currentTab === 'resumen' ? 'active' : ''}" data-hr-tab="resumen">Expediente General</button>
      <button class="${currentTab === 'documentos' ? 'active' : ''}" data-hr-tab="documentos">Documentos Digitales (${documents.length})</button>
      <button class="${currentTab === 'historial' ? 'active' : ''}" data-hr-tab="historial">Historial Laboral (${history.length})</button>
    </div>

    <!-- TAB 1: RESUMEN -->
    ${currentTab === 'resumen' ? `
      <div class="grid-2">
        <!-- Left: Information Cards -->
        <div style="display:grid; gap:20px;">
          <div class="panel">
            <div class="panel-head">
              <h2>Información Personal</h2>
              <span class="panel-note">Datos de identidad</span>
            </div>
            <div class="panel-body">
              <div class="form-grid">
                <div>
                  <span class="panel-note">Tipo y Número de Documento</span>
                  <p><strong>${escapeHtml(employee.DocumentType)}:</strong> ${escapeHtml(employee.DocumentNumber || 'No disponible')}</p>
                </div>
                <div>
                  <span class="panel-note">Fecha de Nacimiento</span>
                  <p>${employee.BirthDate ? displayDate(employee.BirthDate) : 'No registrada'}</p>
                </div>
                <div>
                  <span class="panel-note">Sexo</span>
                  <p>${employee.Sex === 'M' ? 'Masculino' : employee.Sex === 'F' ? 'Femenino' : 'No especificado'}</p>
                </div>
                <div>
                  <span class="panel-note">Nacionalidad</span>
                  <p>${escapeHtml(employee.Nationality || 'Dominicana')}</p>
                </div>
                <div>
                  <span class="panel-note">Estado Civil</span>
                  <p>${escapeHtml(employee.MaritalStatus || 'No especificado')}</p>
                </div>
                <div>
                  <span class="panel-note">Cuenta de Usuario Kinetix</span>
                  <p>${escapeHtml(employee.UserAccountEmail || 'Sin usuario vinculado')}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <h2>Contacto y Domicilio</h2>
              <span class="panel-note">Ubicación física y comunicación</span>
            </div>
            <div class="panel-body">
              <div class="form-grid">
                <div>
                  <span class="panel-note">Teléfono</span>
                  <p>${escapeHtml(employee.Phone || 'No registrado')}</p>
                </div>
                <div>
                  <span class="panel-note">Correo Electrónico</span>
                  <p>${escapeHtml(employee.Email || 'No registrado')}</p>
                </div>
                <div class="field full">
                  <span class="panel-note">Dirección de Residencia</span>
                  <p>${escapeHtml(employee.Address || 'No especificada')}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Emergency Contacts -->
          <div class="panel">
            <div class="panel-head">
              <h2>Contactos de Emergencia</h2>
              <span class="panel-note">${employee.emergencyContacts?.length || 0} registrados</span>
            </div>
            <div class="panel-body">
              ${employee.emergencyContacts && employee.emergencyContacts.length ? `
                <div style="display:grid; gap:10px;">
                  ${employee.emergencyContacts.map(c => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f8fafc; border:1px solid var(--line); border-radius:8px;">
                      <div>
                        <strong>${escapeHtml(c.FullName)}</strong> ${c.IsPrimary ? '<span class="badge active" style="margin-left:6px; font-size:10px;">Principal</span>' : ''}
                        <small style="display:block; color:var(--muted)">${escapeHtml(c.Relationship || 'Familiar')}</small>
                      </div>
                      <span style="font-weight:600; color:var(--navy); font-size:12.5px;">${escapeHtml(c.Phone)}</span>
                    </div>
                  `).join('')}
                </div>
              ` : '<p class="panel-note">No se han registrado contactos de emergencia.</p>'}
            </div>
          </div>
        </div>

        <!-- Right: Contract & Labor Structure -->
        <div style="display:grid; gap:20px; align-content:start;">
          <div class="panel">
            <div class="panel-head">
              <h2>Condiciones Laborales</h2>
              <span class="panel-note">Puesto y régimen</span>
            </div>
            <div class="panel-body" style="display:grid; gap:14px;">
              <div>
                <span class="panel-note">Fecha de Ingreso</span>
                <p><strong>${displayDate(employee.HireDate)}</strong></p>
              </div>
              <div>
                <span class="panel-note">Tipo de Contrato</span>
                <p>${escapeHtml(employee.ContractTypeName || 'Tiempo Indefinido')}</p>
              </div>
              <div>
                <span class="panel-note">Modalidad de Trabajo</span>
                <p>${escapeHtml(employee.WorkModalityName || 'Presencial')}</p>
              </div>
              <div>
                <span class="panel-note">Supervisor Inmediato</span>
                <p>${escapeHtml(employee.SupervisorName || 'Ninguno / Dirección')}</p>
              </div>
              <div>
                <span class="panel-note">Nivel Jerárquico del Cargo</span>
                <p>Nivel ${employee.HierarchyLevel || 'N/D'}</p>
              </div>
              <div style="border-top:1px solid var(--line); padding-top:12px;">
                <span class="panel-note">Compensación Base</span>
                <p style="font-size:18px; font-weight:700; color:var(--navy); margin-top:2px;">
                  ${salaryDisplay}
                  <small style="font-size:11px; color:var(--muted); font-weight:normal;"> / ${escapeHtml(employee.PayFrequency || 'Mensual')}</small>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- TAB 2: DOCUMENTOS DIGITALES -->
    ${currentTab === 'documentos' ? `
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Repositorio Digital del Empleado</h2>
            <span class="panel-note">Contratos, identificaciones, certificados y documentación laboral</span>
          </div>
          <button class="primary" data-action="open-upload-doc-modal" data-id="${employee.Id}">
            ＋ Adjuntar documento
          </button>
        </div>
        <div class="panel-body">
          ${documents.length ? `
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Tipo</th>
                    <th>Versión</th>
                    <th>Archivo</th>
                    <th>Tamaño</th>
                    <th>Fecha Registro</th>
                    <th style="text-align:right;">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${documents.map(doc => {
                    const sizeKb = Math.round(doc.SizeBytes / 1024);
                    return `
                      <tr>
                        <td>
                          <strong>${escapeHtml(doc.Title)}</strong>
                          ${doc.IsConfidential ? '<span class="badge pending" style="margin-left:6px; font-size:10px;">Confidencial</span>' : ''}
                          ${doc.Description ? `<small style="display:block; color:var(--muted)">${escapeHtml(doc.Description)}</small>` : ''}
                        </td>
                        <td><span class="badge" style="background:#f1f5f9; color:var(--navy);">${escapeHtml(doc.DocumentTypeName)}</span></td>
                        <td><span style="font-family:monospace; font-weight:700;">v${doc.VersionNumber}</span></td>
                        <td>${escapeHtml(doc.OriginalName)}</td>
                        <td>${sizeKb} KB</td>
                        <td>${displayDate(doc.CreatedAt)}</td>
                        <td style="text-align:right;">
                          <div style="display:inline-flex; gap:6px;">
                            <a href="/api/hr/documents/${doc.Id}/download" target="_blank" class="row-action" title="Descargar documento">
                              Descargar
                            </a>
                            <button class="row-action" data-action="open-new-version-modal" data-doc-id="${doc.Id}" title="Subir nueva versión">
                              Nueva versión
                            </button>
                            <button class="row-action" style="color:var(--red);" data-action="delete-document" data-doc-id="${doc.Id}" title="Eliminar del expediente">
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="empty">
              <p>No se han adjuntado documentos digitales en este expediente.</p>
              <button class="secondary" data-action="open-upload-doc-modal" data-id="${employee.Id}" style="margin-top:10px;">
                Adjuntar primer documento
              </button>
            </div>
          `}
        </div>
      </div>
    ` : ''}

    <!-- TAB 3: HISTORIAL LABORAL -->
    ${currentTab === 'historial' ? `
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Historial y Trazabilidad Laboral</h2>
            <span class="panel-note">Registro inmutable de movimientos, transferencias, ascensos y cambios salariales</span>
          </div>
        </div>
        <div class="panel-body">
          ${history.length ? `
            <div class="activity" style="position:relative; padding-left:10px;">
              ${history.map(m => {
                let changeSummary = '';
                if (m.MovementType === 'Transferencia') {
                  changeSummary = `De: ${m.FromDepartmentName || 'N/D'} (${m.FromBranchName || 'General'}) → A: ${m.ToDepartmentName || 'N/D'} (${m.ToBranchName || 'General'})`;
                } else if (m.MovementType === 'Ascenso' || m.MovementType === 'CambioCargo') {
                  changeSummary = `Cargo anterior: ${m.FromPositionTitle || 'N/D'} → Nuevo cargo: ${m.ToPositionTitle || 'N/D'}`;
                } else if (m.MovementType === 'AjusteSalarial') {
                  changeSummary = `Salario anterior: RD$ ${m.FromSalary || 0} → Nuevo salario: RD$ ${m.ToSalary || 0}`;
                } else if (m.MovementType === 'Suspension' || m.MovementType === 'Licencia' || m.MovementType === 'Reactivacion') {
                  changeSummary = `Estado anterior: ${m.FromStatus} → Nuevo estado: ${m.ToStatus}`;
                } else if (m.MovementType === 'Desvinculacion') {
                  changeSummary = `Desvinculación definitiva. Motivo registrado.`;
                } else if (m.MovementType === 'Ingreso') {
                  changeSummary = `Ingreso al cargo ${m.ToPositionTitle || 'N/D'} en el departamento ${m.ToDepartmentName || 'N/D'}`;
                }

                let movClass = 'mov-transferencia';
                if (m.MovementType === 'Ingreso') movClass = 'mov-ingreso';
                else if (m.MovementType === 'Ascenso' || m.MovementType === 'CambioCargo') movClass = 'mov-ascenso';
                else if (m.MovementType === 'AjusteSalarial') movClass = 'mov-salario';
                else if (m.MovementType === 'Suspension') movClass = 'mov-suspension';
                else if (m.MovementType === 'Licencia') movClass = 'mov-licencia';
                else if (m.MovementType === 'Desvinculacion') movClass = 'mov-desvinculacion';

                return `
                  <div class="activity-item" style="border-bottom:1px solid #f1f5f9; padding-bottom:14px;">
                    <span class="activity-bullet ${movClass}" style="margin-top:4px;"></span>
                    <div style="flex:1;">
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${escapeHtml(m.MovementType)}</strong>
                        <small style="color:var(--muted)">${displayDate(m.EffectiveDate)}</small>
                      </div>
                      <p style="margin:4px 0; font-size:12.5px; color:#334155;">${escapeHtml(changeSummary)}</p>
                      ${m.Reason ? `<p style="margin:2px 0; font-size:11.5px; color:var(--muted); font-style:italic;">Motivo: "${escapeHtml(m.Reason)}"</p>` : ''}
                      <small style="display:block; color:#94a3b8; font-size:10.5px; margin-top:4px;">Registrado por: ${escapeHtml(m.CreatedByEmail || 'Sistema')}</small>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : '<p class="panel-note">Sin historial de movimientos registrado.</p>'}
        </div>
      </div>
    ` : ''}
  `;
}

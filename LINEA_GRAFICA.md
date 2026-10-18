# Sistema de Diseño y Línea Gráfica — Kinetix Precision

Documento maestro de especificación visual, lineamientos de diseño, tokens de estilo y catálogo de componentes para la plataforma Kinetix Core.

---

## 1. Filosofía y Principios de Diseño

El sistema visual de Kinetix está fundamentado en el principio de "Precisión Cinética" (Kinetic Precision), diseñado para aplicaciones de gestión empresarial y plataformas corporativas de alto rendimiento.

### Principios Fundamentales

- **Claridad Operativa**: Jerarquía visual limpia que prioriza los datos esenciales, facilitando la toma de decisiones rápidas sin fatiga cognitiva.
- **Sobriedad Ejecutiva**: Contraste refinado entre una estructura de navegación oscura y profunda (Deep Obsidian) y un espacio de trabajo claro y luminoso de máxima legibilidad.
- **Densidad de Información Equilibrada**: Aprovechamiento eficiente del espacio de pantalla mediante tipografía compacta y micro-espaciados consistentes, ideal para tablas complejas, registros de auditoría y métricas analíticas.
- **Dinamismo Funcional**: Transiciones suaves y micro-interacciones sutiles que aportan retroalimentación inmediata a las acciones del usuario sin comprometer la velocidad de respuesta.

---

## 2. Tipografía Institucional

La tipografía oficial combina dos familias tipográficas de libre distribución y estándar abierto de Google Fonts:

### Familias Tipográficas

- **Tipografía Primaria de Interfaz**: `Inter`, sans-serif. Utilizada en cuerpos de texto, tablas, formularios, botones y elementos de control.
- **Tipografía de Marca y Títulos Display**: `Plus Jakarta Sans`, sans-serif. Utilizada en logotipos, nombres de módulos, encabezados principales de página y métricas clave.

### Declaración CSS

```css
:root {
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-display: "Plus Jakarta Sans", "Inter", sans-serif;
}
```

### Escala Tipográfica Modular

| Nivel | Tamaño | Peso (Weight) | Altura de Línea | Uso Específico |
|---|---|---|---|---|
| Display XL | 28px - 32px | 800 (ExtraBold) | 1.15 | Encabezados de dashboards ejecutivos y portadas |
| Título H1 | 22px - 24px | 800 (ExtraBold) | 1.2 | Títulos principales de módulo |
| Título H2 | 18px - 20px | 700 (Bold) | 1.25 | Títulos de secciones y títulos de modales |
| Subtítulo H3 | 15px - 16px | 600 (SemiBold) | 1.3 | Encabezados de tarjetas y paneles secundarios |
| Cuerpo Regular | 13.5px - 14px | 400 (Regular) | 1.5 | Texto corrido, descripciones y contenido general |
| Interfaz Compacta | 13px | 500 (Medium) | 1.4 | Opciones de navegación, botones y celdas de tabla |
| Etiquetas Técnicas | 11px - 12px | 600 (SemiBold) | 1.3 | Badges, estados, fechas y datos de apoyo |
| Micro-etiquetas | 9.5px - 10px | 800 (ExtraBold) | 1.0 | Categorías del menú lateral (en mayúsculas con espaciado de 1.3px) |

---

## 3. Paleta Cromática y Tokens de Color

Todos los colores están definidos mediante variables CSS nativas, permitiendo coherencia semántica en todo el ecosistema.

### 3.1. Neutros y Superficies

| Variable | Valor Hex | Uso Principal |
|---|---|---|
| `--navy` | `#090e17` | Fondo profundo del sidebar y shell exterior |
| `--ink` | `#0f172a` | Color principal de textos y títulos |
| `--ink-secondary` | `#334155` | Textos secundarios y leyendas |
| `--muted` | `#64748b` | Subtítulos, metadatos e iconos inactivos |
| `--muted-light` | `#94a3b8` | Textos de navegación lateral y bordes tenues |
| `--line` | `#e2e8f0` | Divisores estándar, bordes de tarjeta e inputs |
| `--line-strong` | `#cbd5e1` | Bordes activos y barras de desplazamiento |
| `--paper` | `#f8fafc` | Fondo general de la aplicación |
| `--surface` | `#ffffff` | Fondo de tarjetas, tablas, modales y formularios |

### 3.2. Color Primario Institucional (Kinetic Royal Blue)

El color azul institucional simboliza tecnología, solidez y precisión ejecutiva.

| Variable | Valor | Aplicación |
|---|---|---|
| `--royal` | `#2563eb` | Botones primarios, enlaces activos y foco |
| `--royal-hover` | `#1d4ed8` | Estado hover de botones primarios |
| `--royal-active` | `#1e40af` | Estado presionado o activo |
| `--royal-soft` | `#eff6ff` | Fondos de badges informativos y áreas de selección |
| `--royal-border` | `#bfdbfe` | Bordes de elementos primarios resaltados |
| `--royal-gradient` | `linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #38bdf8 100%)` | Botones de acción destacada y banners hero |
| `--royal-glow` | `rgba(37, 99, 235, 0.35)` | Sombra perimetral luminosa para elementos clave |

### 3.3. Colores Semánticos y Funcionales

| Dominio Semántico | Variable Base | Color Hex | Fondo Suave (`-soft`) | Borde (`-border`) | Gradiente (`-gradient`) |
|---|---|---|---|---|---|
| Éxito / Operación Aprobada | `--emerald` | `#059669` | `#ecfdf5` | `#a7f3d0` | `linear-gradient(135deg, #047857 0%, #059669 55%, #10b981 100%)` |
| Advertencia / En Revisión | `--amber` | `#d97706` | `#fffbeb` | `#fde68a` | `linear-gradient(135deg, #b45309 0%, #d97706 55%, #f59e0b 100%)` |
| Peligro / Rechazado / Crítico | `--red` | `#e11d48` | `#fff1f2` | `#fecdd3` | `linear-gradient(135deg, #be123c 0%, #e11d48 55%, #fb7185 100%)` |
| Soporte / Proceso / Neutral | `--blue` | `#0284c7` | `#f0f9ff` | `#bae6fd` | `linear-gradient(135deg, #0369a1 0%, #0284c7 100%)` |
| Jerarquía Especial / Analítica | `--purple` | `#7c3aed` | `#faf5ff` | `#ddd6fe` | `linear-gradient(135deg, #6d28d9 0%, #7c3aed 55%, #c084fc 100%)` |

---

## 4. Elevaciones, Sombras y Radios de Borde

### 4.1. Escala de Sombras y Profundidad

```css
--shadow-xs: 0 1px 2px 0 rgba(15, 23, 42, 0.04);
--shadow-sm: 0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04);
--shadow-md: 0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
--shadow-lg: 0 12px 24px -4px rgba(15, 23, 42, 0.1), 0 4px 12px -2px rgba(15, 23, 42, 0.05);
--shadow-xl: 0 20px 32px -6px rgba(15, 23, 42, 0.14), 0 8px 16px -4px rgba(15, 23, 42, 0.06);
--shadow-glow: 0 0 24px -2px rgba(37, 99, 235, 0.35);
```

### 4.2. Escala de Radios de Curvatura

```css
--radius-xs: 4px;   /* Micro-indicadores y badges compactos */
--radius-sm: 8px;   /* Inputs, botones secundarios, selects */
--radius-md: 12px;  /* Botones principales, modales internos, tarjetas */
--radius-lg: 16px;  /* Paneles contenedores principales y tarjetas KPI */
--radius-xl: 20px;  /* Banners de bienvenida y modales de pantalla */
--radius-full: 9999px; /* Avatares, píldoras y badges circulares */
```

---

## 5. Anatomía de Componentes de Interfaz

### 5.1. Barra Lateral de Navegación (Sidebar)

- **Fondo**: Gradiente lineal oscuro vertical `linear-gradient(180deg, #070d18 0%, #0b1528 50%, #080f1e 100%)`.
- **Ancho por defecto**: `260px` de ancho fijo.
- **Logotipo y Marca**: Contenedor blanco con bordes redondeados (`11px`), sombra suave y efecto hover con escalado proporcional a `1.04`.
- **Grupos de Menú**: Encabezados en texto `9.5px` en mayúsculas con espaciado entre letras de `1.3px` y color `#64748b`.
- **Elemento de Menú Inactivo**: Color de texto `#94a3b8`, fondo transparente, radio de curvatura `10px`.
- **Elemento de Menú al Pasar el Cursor (Hover)**: Desplazamiento horizontal de `2px` a la derecha (`transform: translateX(2px)`), fondo `rgba(255, 255, 255, 0.07)`, texto `#f1f5f9`.
- **Elemento de Menú Activo**: Gradiente sutil azul `linear-gradient(90deg, rgba(37, 99, 235, 0.35) 0%, rgba(37, 99, 235, 0.15) 100%)`, borde perimetral en `rgba(59, 130, 246, 0.45)` y texto en `#93c5fd`.

### 5.2. Barra Superior (Topbar)

- **Fondo**: Superficie blanca con transparencia y efecto de desenfoque (`background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px)`).
- **Altura**: `68px` con borde inferior sutil de `1px solid var(--line)`.
- **Buscador Global**: Campo de entrada con icono de lupa integrado, atajo de teclado visible (`Ctrl+K`) y borde reactivo en color `--royal`.
- **Bandeja de Notificaciones**: Botón circular con icono de campana y badge numérico en color `--red` con animación de pulso sutil cuando hay pendientes no leídos.
- **Tarjeta de Perfil**: Avatar compacto con iniciales del colaborador sobre gradiente `--royal-gradient` e indicador de conectividad en verde esmeralda.

### 5.3. Botones y Controles de Acción

| Variante | Clase CSS | Comportamiento Visual |
|---|---|---|
| Primario Estándar | `.btn-primary` | Fondo `--royal`, texto blanco, radio `10px`, sombra `--shadow-xs`. Hover: `--royal-hover` con elevación leve. |
| Primario Destacado | `.btn-gradient` | Fondo `--royal-gradient`, texto blanco, sombra con glow `--royal-glow`. Hover: incremento de saturación. |
| Secundario Neutro | `.btn-secondary` | Fondo `--surface`, borde `1px solid var(--line)`, texto `--ink`. Hover: fondo `--bg-hover`. |
| Peligro / Destructivo | `.btn-danger` | Fondo `--red-soft`, borde `1px solid var(--red-border)`, texto `--red`. Hover: fondo `--red` y texto blanco. |
| Éxito / Confirmación | `.btn-success` | Fondo `--emerald-soft`, borde `1px solid var(--emerald-border)`, texto `--emerald`. |
| Solo Icono | `.btn-icon` | Cuadrado de `34px x 34px`, borde neutro, icono centrado, radio `8px`. |

### 5.4. Tarjetas de Métricas Ejecutivas (KPI Cards)

- **Estructura**:
  - Encabezado con icono temático sobre fondo suave tonal.
  - Cifra cuantitativa en tamaño `24px - 28px` con peso ExtraBold (`800`) en fuente `Plus Jakarta Sans`.
  - Etiqueta descriptiva en texto secundario (`12.5px`).
  - Badge de comparativa o estado (ejemplo: "+12% este mes" o "Normal").
- **Superficie**: Fondo `--surface` blanco, borde `1px solid var(--line)` y sombra `--shadow-sm`.
- **Efecto Hover**: Elevación vertical de `-2px` y transición de sombra hacia `--shadow-md`.

### 5.5. Tablas de Datos de Alta Densidad

- **Encabezados (`thead th`)**:
  - Fondo `#f8fafc`.
  - Texto en mayúsculas, tamaño `11px`, peso `700`, color `--muted`, espaciado `0.5px`.
  - Borde inferior de `1.5px solid var(--line)`.
- **Celdas de Datos (`tbody td`)**:
  - Relleno vertical compacto (`12px 16px`).
  - Tamaño de fuente `13px`, color `--ink`.
  - Borde inferior tenue de `1px solid var(--line)`.
- **Efecto de Fila**: Al pasar el cursor, la fila adopta un fondo suave `#f8fafc` con transición de `120ms`.
- **Paginación Integrada**: Barra inferior con selector de registros por página, contador de totales y controles de navegación numérica.

### 5.6. Etiquetas y Badges Cromáticos

Formato estándar: píldora con `padding: 3px 9px`, radio `9999px`, tamaño de fuente `11.5px` y peso `600`.

- **Activo / Aprobado / Regular**: Fondo `#ecfdf5`, texto `#047857`, borde `#a7f3d0`.
- **Pendiente / En Revisión / Tardanza**: Fondo `#fffbeb`, texto `#b45309`, borde `#fde68a`.
- **Inactivo / Rechazado / Suspendido**: Fondo `#fff1f2`, texto `#be123c`, borde `#fecdd3`.
- **Informativo / En Proceso**: Fondo `#eff6ff`, texto `#1d4ed8`, borde `#bfdbfe`.
- **Especial / Nivel Directivo**: Fondo `#faf5ff`, texto `#6d28d9`, borde `#ddd6fe`.

### 5.7. Campos de Entrada y Formularios

- **Contenedores de Campo**: Agrupados con etiqueta superior visible de tamaño `12.5px`, peso `600` y color `--ink-secondary`.
- **Entrada (`input`, `select`, `textarea`)**:
  - Altura estándar: `40px` (inputs y selects).
  - Borde: `1px solid var(--line)`.
  - Radio de curvatura: `8px`.
  - Relleno interno: `0 12px`.
  - Estado de Foco (`:focus-visible`): Contorno perimetral nítido en color `--royal` de `2px` con desplazamiento de `1px`.

### 5.8. Ventanas Modales y Diálogos

- **Capa Trasera (Backdrop)**: Fondo oscuro con opacidad y desenfoque (`background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(6px)`).
- **Caja de Diálogo**:
  - Fondo `--surface`, radio `16px`, sombra profunda `--shadow-xl`.
  - Cabecera delimitada con título H2 y botón de cierre en esquina superior derecha.
  - Pie de diálogo con acciones alineadas a la derecha (Cancelar secundario y Confirmar primario).
  - Animación de entrada: Escalado sutil desde `0.96` a `1.0` con opacidad de `0` a `1` en `180ms`.

---

## 6. Dinámica de Movimiento y Micro-interacciones

Las animaciones en Kinetix tienen un propósito exclusivamente funcional y de confirmación de interacción.

### Tiempos y Curvas de Aceleración

- **Curva Estándar de Transición**: `cubic-bezier(0.4, 0, 0.2, 1)` (aceleración suave, desaceleración natural).
- **Micro-interacciones Inmediatas (Hover de botones, enlaces, tarjetas)**: `150ms` a `180ms`.
- **Apertura de Paneles y Modales**: `200ms` a `250ms`.
- **Animación de Pulso para Indicadores en Vivo (`@keyframes badgePulse`)**:

```css
@keyframes badgePulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}
```

---

## 7. Directrices de Implementación para Desarrolladores

Para preservar la integridad visual y la consistencia técnica del sistema:

1. **Uso Exclusivo de Variables**: No se deben utilizar valores de color hexadecimales arbitrarios en componentes nuevos. Siempre se deben referenciar las variables oficiales (`var(--royal)`, `var(--surface)`, `var(--line)`, etc.).
2. **Jerarquía Semántica de Badges**: Los estados positivos siempre deben usar la variante esmeralda, los estados transitorios la variante ámbar y las alertas o bloqueos la variante roja.
3. **Mantenimiento del Contraste WCAG**: Todo texto sobre fondo oscuro debe mantener una relación de contraste mínima de 4.5:1 para texto regular y 3:1 para encabezados grandes.
4. **Respeto a la Densidad**: Evitar paddings excesivos en tablas o listas que disminuyan la cantidad de registros visibles en pantallas corporativas estándar (1366x768 a 1920x1080).

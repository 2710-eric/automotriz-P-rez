# Plan de Implementación: Gestión de Eliminación y Tutorial Interactivo

Este cambio incorpora la capacidad de vaciar el inventario con advertencia modal de confirmación, habilita la eliminación de productos individuales para administradores en el Inventario Real con modal seguro, y activa el tutorial interactivo previo al inicio de sesión con apertura automática para nuevos usuarios.

### User Review & Critical Decisions

> [!IMPORTANT]
> Confirmaciones obtenidas en la fase previa aplicadas directamente al diseño de la solución:

- **Confirmación para Vaciar Inventario**: Se implementará un modal dedicado de advertencia con ícono de peligro, conteo exacto de ítems a eliminar y botón de confirmación en color rojo intenso con indicador de carga para evitar ejecuciones accidentales.
- **Eliminación en Inventario Real**: Restringido a usuarios administradores (`isAdmin`), reemplazando el `window.confirm` bloqueado por navegadores en entornos embebidos por un modal reactivo y accesible tanto en escritorio como en dispositivos táctiles.
- **Tutorial Pre-Login**: Se activará de forma automática en la primera visita mediante una bandera en almacenamiento local (`localStorage`), manteniendo además el botón accesible y plenamente interactivo en la pantalla de bienvenida.

---

### 1. Overview & Core Concept

- **Qué hace**:
  1. Permite al administrador purgar la totalidad del inventario de insumos y lubricantes mediante un botón compacto con doble resguardo visual.
  2. Proporciona una acción de borrado directo y sin bloqueos para productos específicos desde la tabla de Inventario Real.
  3. Despliega la guía paso a paso del taller antes de iniciar sesión para que el usuario conozca las funcionalidades de stock, copiloto IA y consumo.
- **Audiencia objetivo**: Jefes de taller y administradores que requieren gestionar su catálogo y capacitar a mecánicos en el uso de la plataforma.
- **Valor clave**: Elimina bloqueos de interfaz generados por diálogos nativos del navegador (`window.confirm`), garantiza la integridad de datos críticos y asegura un onboarding fluido.

---

### 2. User Experience & Visual Design

#### Flujos de Usuario Principales

```
[Pantalla de Bienvenida]
         │
         ├──► (Primera visita detectada) ──► [Modal Tutorial Automático]
         │                                              │
         ├──► [Botón '¿Cómo funciona? Ver Tutorial'] ───┘
         │
         ▼
[Inicio de Sesión / Dashboard]
         │
         ├──► [Sección Inventario Real]
         │            │
         │            ├──► Botón 'Vaciar Inventario' ──► [Modal Advertencia Crítica] ──► [Borrado en Lote]
         │            │
         │            └──► Botón 'Eliminar Producto'  ──► [Modal Confirmación Ítem]  ──► [Borrado Individual]
```

#### Identidad Visual y Componentes

- **Estilo y Paleta**:
  - Tono industrial automotriz con fondo neutro pizarra (`#0F172A`), acentos en rojo de advertencia (`bg-red-600` / `hover:bg-red-700`) y bordes nítidos (`border-slate-800`).
  - Botón de vaciar inventario compacto: micro-botón sutil en el encabezado de la tabla (`text-xs font-bold px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50`).
- **Modales de Confirmación**:
  - Modal con fondo difuminado (`backdrop-blur-sm`), ícono de advertencia animado, mensaje explicativo que indica el nombre del producto o el total de elementos afectados, botón de cancelación gris y botón de acción destructiva roja.
- **Tutorial Pre-Login**:
  - Reubicación del componente `<Tutorial />` al nivel raíz del árbol de renderizado para que esté disponible tanto en el estado no autenticado como dentro del panel principal.

---

### 3. Key Product Decisions & Trade-Offs

- **Decisión 1: Reemplazo integral de `window.confirm` por modal en React**:
  - *Enfoque*: Crear estados dedicados `deleteModalState` y `bulkDeleteModalOpen` en React.
  - *Motivo*: Los navegadores en entornos iframe suelen suprimir o deshabilitar silenciosamente `window.confirm`, haciendo que los botones de eliminación parezcan no responder.
  - *Alternativas*: Mantener confirmaciones nativas fue descartado por fallos de compatibilidad en entornos embebidos.

- **Decisión 2: Apertura del Tutorial mediante bandera local**:
  - *Enfoque*: Inspeccionar `localStorage.getItem('automotriz_tutorial_seen')`. Si no existe, se abre `<Tutorial />` y al cerrarse se registra la marca.
  - *Motivo*: Permite una experiencia de inducción no invasiva sin frustrar al usuario en visitas recurrentes.

- **Decisión 3: Borrado en lote con Firestore Batch**:
  - *Enfoque*: Utilizar `writeBatch` de Firestore para eliminar los documentos de la colección `products` de forma atómica.
  - *Motivo*: Evita estados inconsistentes y optimiza el consumo de red comparado con llamadas individuales.

---

### 4. Technical Architecture & Data Strategy

#### Diagrama de Arquitectura y Componentes

```
┌────────────────────────────────────────────────────────────────────────┐
│                                 App                                    │
│  - isTutorialOpen: boolean                                             │
│  - bulkDeleteOpen: boolean                                             │
│  - pendingDeleteProduct: Product | null                                │
├──────────────────────────────────┬─────────────────────────────────────┤
│      Vista No Autenticada        │         Vista Autenticada           │
│  ┌────────────────────────────┐  │  ┌───────────────────────────────┐  │
│  │     Login & Bienvenida     │  │  │ Header / Navegación           │  │
│  │ - Botón Ver Tutorial       │  │  │ Resumen Métrico               │  │
│  │ - Trigger Primer Ingreso   │  │  │ Gráficos & Asistente IA       │  │
│  └────────────────────────────┘  │  ├───────────────────────────────┤  │
│                                  │  │ Sección Inventario Real       │  │
│                                  │  │ - Botón Vaciar Catálogo       │  │
│                                  │  │ - Fila: Botón Eliminar Ítem   │  │
│                                  │  └───────────────────────────────┘  │
├──────────────────────────────────┴─────────────────────────────────────┤
│                          Capas Superpuestas                            │
│  ┌─────────────────────┐  ┌───────────────────┐  ┌──────────────────┐  │
│  │    <Tutorial />     │  │ Modal Borrado Lote│  │ Modal Borrado    │  │
│  │ (Pre & Post Login)  │  │ (Doble Seguridad) │  │ Individual       │  │
│  └─────────────────────┘  └───────────────────┘  └──────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           Firebase Firestore                           │
│  - deleteDoc(doc(db, 'products', id))                                  │
│  - writeBatch() para vaciado total de colección 'products'             │
└────────────────────────────────────────────────────────────────────────┘
```

#### Mapeo de Estados y Manejadores

1. **Vaciado Total de Inventario**:
   - `handleInitiateBulkDelete`: Abre el modal de advertencia crítica informando la cantidad actual de productos.
   - `handleConfirmBulkDelete`: Ejecuta `writeBatch(db)` para cada producto en `products`, limpia la base de datos y muestra notificación de éxito.
2. **Eliminación Individual**:
   - `handleInitiateDelete(product)`: Almacena el producto en `pendingDeleteProduct` y abre el modal confirmatorio con su nombre y marca.
   - `handleConfirmSingleDelete`: Ejecuta `deleteDoc(doc(db, 'products', pendingDeleteProduct.id))` con manejo de errores de Firestore.
3. **Tutorial Pre-Login**:
   - Hook de inicialización verifica `localStorage.getItem('tutorial_first_visit_shown')`. Si está vacío, ejecuta `setIsTutorialOpen(true)`.
   - El componente `<Tutorial />` se renderiza fuera de la bifurcación condicional de autenticación para estar disponible siempre.

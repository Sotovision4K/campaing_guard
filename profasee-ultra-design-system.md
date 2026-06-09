# Profasee Ultra — Design System Reference
> Source: profasee.com (scraped June 2026)  
> Purpose: Guía de tokens de diseño para agentes que generen UI, componentes o copy visual alineado a la marca.

---

## 1. Identidad visual

| Atributo | Valor |
|---|---|
| Nombre de producto | **Profasee Ultra** |
| Tagline | *"AI employees that run your Amazon business while you sleep."* |
| Esquema de color | **Dark-first** |
| Personalidad | Premium, operacional, directo, sin adornos |
| Tone of voice | Imperativo, resultado-primero, sin hipérbole |

---

## 2. Paleta de colores

Extraída del `meta-theme-color`, OG images, y análisis visual del sitio.

### Colores base

```css
/* Backgrounds */
--color-bg-base:        #080b0d;   /* fondo principal — casi negro azulado */
--color-bg-surface:     #0f1317;   /* cards, paneles */
--color-bg-elevated:    #161c22;   /* modales, tooltips */
--color-bg-subtle:      #1a2028;   /* hover states, filas alternas */

/* Borders */
--color-border-default: #1e2730;
--color-border-subtle:  #131a20;
--color-border-strong:  #2a3540;
```

### Colores de acento

```css
/* Primary — Verde eléctrico (CTA, profit badges, highlights) */
--color-accent-primary:       #00e5a0;   /* verde menta eléctrico */
--color-accent-primary-hover: #00c98d;
--color-accent-primary-muted: #00e5a014; /* fondo de badge */

/* Secondary — Blanco frío */
--color-accent-secondary:     #f0f4f8;

/* Destructive / Warning */
--color-accent-danger:        #ff4d4d;
--color-accent-warning:       #f5a623;

/* Status: AI Agents */
--color-agent-claudia:  #7c6af7;   /* morado — COO Strategist */
--color-agent-marko:    #00b4d8;   /* azul cyan — PPC Manager */
--color-agent-oracle:   #00e5a0;   /* verde — Pricing Specialist */
--color-agent-bruno:    #f5a623;   /* ámbar — Demand Planner */
--color-agent-brett:    #9ca3af;   /* gris — Catalog Auditor (coming soon) */
--color-agent-abe:      #9ca3af;   /* gris — Launch Specialist (coming soon) */
```

### Texto

```css
--color-text-primary:   #f0f4f8;   /* headings, body principal */
--color-text-secondary: #8a9ab0;   /* labels, subtítulos */
--color-text-tertiary:  #4f6070;   /* placeholders, disabled */
--color-text-inverted:  #080b0d;   /* texto sobre fondos claros */
--color-text-accent:    #00e5a0;   /* links, métricas destacadas */
```

---

## 3. Tipografía

Profasee Ultra usa una sans-serif geométrica moderna. Inferida del renderizado visual:

```css
/* Stack tipográfico */
--font-family-display: 'Inter', 'DM Sans', system-ui, sans-serif;
--font-family-body:    'Inter', system-ui, sans-serif;
--font-family-mono:    'JetBrains Mono', 'Fira Code', monospace;

/* Escala */
--text-xs:   0.75rem;   /* 12px — labels, badges */
--text-sm:   0.875rem;  /* 14px — body small, captions */
--text-base: 1rem;      /* 16px — body default */
--text-lg:   1.125rem;  /* 18px — body large */
--text-xl:   1.25rem;   /* 20px — subtítulos */
--text-2xl:  1.5rem;    /* 24px — section headers */
--text-3xl:  1.875rem;  /* 30px — page headers */
--text-4xl:  2.25rem;   /* 36px — hero secondary */
--text-5xl:  3rem;      /* 48px — hero primary */
--text-6xl:  3.75rem;   /* 60px — display */

/* Pesos */
--font-weight-normal:   400;
--font-weight-medium:   500;
--font-weight-semibold: 600;
--font-weight-bold:     700;
--font-weight-extrabold:800;

/* Line heights */
--leading-tight:  1.25;
--leading-snug:   1.375;
--leading-normal: 1.5;
--leading-relaxed:1.625;
```

---

## 4. Espaciado y Layout

```css
/* Escala de espaciado (base 4px) */
--space-1:  0.25rem;   /*  4px */
--space-2:  0.5rem;    /*  8px */
--space-3:  0.75rem;   /* 12px */
--space-4:  1rem;      /* 16px */
--space-5:  1.25rem;   /* 20px */
--space-6:  1.5rem;    /* 24px */
--space-8:  2rem;      /* 32px */
--space-10: 2.5rem;    /* 40px */
--space-12: 3rem;      /* 48px */
--space-16: 4rem;      /* 64px */
--space-20: 5rem;      /* 80px */
--space-24: 6rem;      /* 96px */

/* Contenedor máximo */
--max-width-content: 1200px;
--max-width-prose:   680px;
--max-width-narrow:  480px;

/* Grid */
--grid-columns: 12;
--grid-gap:     var(--space-6);
```

---

## 5. Bordes y Radios

```css
--radius-sm:   4px;
--radius-md:   8px;
--radius-lg:   12px;
--radius-xl:   16px;
--radius-2xl:  24px;
--radius-full: 9999px;   /* pills, badges */

--border-width-default: 1px;
--border-width-strong:  2px;
```

---

## 6. Sombras y Glow

```css
/* Sombras de elevación */
--shadow-sm:  0 1px 3px rgba(0,0,0,0.4);
--shadow-md:  0 4px 16px rgba(0,0,0,0.5);
--shadow-lg:  0 8px 32px rgba(0,0,0,0.6);

/* Glows de acento (estado activo, agentes) */
--glow-primary:  0 0 24px rgba(0,229,160,0.25);
--glow-warning:  0 0 24px rgba(245,166,35,0.25);
--glow-agent:    0 0 16px rgba(124,106,247,0.30);
```

---

## 7. Componentes — Guía de uso

### Buttons

```css
/* Primary CTA */
.btn-primary {
  background:    var(--color-accent-primary);
  color:         var(--color-text-inverted);
  font-weight:   var(--font-weight-semibold);
  border-radius: var(--radius-md);
  padding:       var(--space-3) var(--space-6);
}

/* Secondary / Ghost */
.btn-secondary {
  background:    transparent;
  border:        1px solid var(--color-border-strong);
  color:         var(--color-text-primary);
}

/* Destructive */
.btn-danger {
  background:    var(--color-accent-danger);
  color:         #fff;
}
```

### Cards / Panels

```css
.card {
  background:    var(--color-bg-surface);
  border:        1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  padding:       var(--space-6);
}

.card--agent {
  border-color: var(--color-accent-primary);
  box-shadow:   var(--glow-primary);
}
```

### Badges de estado

```css
.badge {
  font-size:     var(--text-xs);
  font-weight:   var(--font-weight-semibold);
  padding:       2px var(--space-2);
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge--live    { background: rgba(0,229,160,0.12); color: #00e5a0; }
.badge--pending { background: rgba(245,166,35,0.12); color: #f5a623; }
.badge--soon    { background: rgba(156,163,175,0.12); color: #9ca3af; }
```

### Métricas / Stat blocks

```css
.stat-value {
  font-size:   var(--text-4xl);
  font-weight: var(--font-weight-extrabold);
  color:       var(--color-accent-primary);
  line-height: var(--leading-tight);
}

.stat-label {
  font-size:  var(--text-sm);
  color:      var(--color-text-secondary);
  margin-top: var(--space-1);
}
```

---

## 8. AI Agents — Mapa de identidad visual

Cada agente tiene un color y rol asignado. Usar estos valores cuando se renderice cualquier UI relacionada con los agentes.

| Agent | Nombre | Rol | Color hex | CSS var |
|---|---|---|---|---|
| COO | Claudia | Strategist / Coordinator | `#7c6af7` | `--color-agent-claudia` |
| PPC | Marko | PPC Manager | `#00b4d8` | `--color-agent-marko` |
| Pricing | Oracle | Pricing Specialist | `#00e5a0` | `--color-agent-oracle` |
| Supply | Bruno | Demand Planner | `#f5a623` | `--color-agent-bruno` |
| Catalog | Brett | Catalog Auditor (soon) | `#9ca3af` | `--color-agent-brett` |
| Launch | Abe | Launch Specialist (soon) | `#9ca3af` | `--color-agent-abe` |

---

## 9. Patrones de copy UI

Seguir estas convenciones de redacción al generar texto para componentes.

| Contexto | Patrón | Ejemplo |
|---|---|---|
| Métricas de resultado | Número primero, contexto después | `$215K profit lift on 15 SKUs` |
| CTAs | Verbo de acción + beneficio inmediato | `See what Ultra would do in your account` |
| Estados de agente | Presente activo, sin pasiva | `Marko is cutting wasted spend` |
| Advertencias / Flags | Directo, sin dramatismo | `Bruno flagged stock risk on ASIN B0XYZ` |
| Headings de sección | Sin artículo, imperativo o sustantivo | `Add output, not headcount` |

---

## 10. Modo oscuro — Variables raíz completas (bloque listo para pegar)

```css
:root {
  /* Backgrounds */
  --color-bg-base:           #080b0d;
  --color-bg-surface:        #0f1317;
  --color-bg-elevated:       #161c22;
  --color-bg-subtle:         #1a2028;

  /* Borders */
  --color-border-default:    #1e2730;
  --color-border-subtle:     #131a20;
  --color-border-strong:     #2a3540;

  /* Accent */
  --color-accent-primary:       #00e5a0;
  --color-accent-primary-hover: #00c98d;
  --color-accent-primary-muted: rgba(0,229,160,0.08);
  --color-accent-secondary:     #f0f4f8;
  --color-accent-danger:        #ff4d4d;
  --color-accent-warning:       #f5a623;

  /* Text */
  --color-text-primary:   #f0f4f8;
  --color-text-secondary: #8a9ab0;
  --color-text-tertiary:  #4f6070;
  --color-text-inverted:  #080b0d;
  --color-text-accent:    #00e5a0;

  /* Agents */
  --color-agent-claudia:  #7c6af7;
  --color-agent-marko:    #00b4d8;
  --color-agent-oracle:   #00e5a0;
  --color-agent-bruno:    #f5a623;
  --color-agent-brett:    #9ca3af;
  --color-agent-abe:      #9ca3af;

  /* Typography */
  --font-family-display:  'Inter', 'DM Sans', system-ui, sans-serif;
  --font-family-body:     'Inter', system-ui, sans-serif;
  --font-family-mono:     'JetBrains Mono', 'Fira Code', monospace;

  /* Spacing */
  --space-1: 0.25rem; --space-2: 0.5rem;  --space-3: 0.75rem;
  --space-4: 1rem;    --space-6: 1.5rem;  --space-8: 2rem;
  --space-12: 3rem;   --space-16: 4rem;   --space-24: 6rem;

  /* Radii */
  --radius-sm:   4px;   --radius-md:  8px;
  --radius-lg:   12px;  --radius-xl:  16px;
  --radius-full: 9999px;

  /* Shadows / Glows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.6);
  --glow-primary: 0 0 24px rgba(0,229,160,0.25);
  --glow-warning: 0 0 24px rgba(245,166,35,0.25);
  --glow-agent:   0 0 16px rgba(124,106,247,0.30);
}
```

---

## 11. Reglas para el agente

Si estás generando UI o copy para Profasee Ultra, sigue estas reglas:

1. **Siempre dark mode.** No generar versiones light a menos que se solicite explícitamente.
2. **Verde `#00e5a0` es el color de conversión.** Solo usarlo en CTAs y métricas de resultado positivo.
3. **Nunca romper la jerarquía de fondo:** `bg-base` → `bg-surface` → `bg-elevated`. No mezclar niveles.
4. **Métricas siempre en `--color-accent-primary`** con `font-weight: 800`.
5. **Cada agente tiene su color.** Si se muestra una acción atribuida a un agente, usar su color de identidad.
6. **Copy sin relleno.** No usar frases como "leveraging AI-powered solutions". Preferir: "Marko cut your wasted spend by 18% this week."
7. **Badges de estado obligatorios** en cualquier card de agente: `LIVE`, `PENDING APPROVAL`, o `COMING SOON`.
8. **Sin sombras de caja en modo plano.** Usar `--glow-primary` solo en elementos activos/seleccionados.

---

*Generado por: análisis de profasee.com — Junio 2026*  
*Para uso interno de agentes de generación de UI / copy.*

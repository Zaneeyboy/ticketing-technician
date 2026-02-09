# Tech Dynamics Ticketing System - Design System & Landing Page Plan

## 🎨 Design Philosophy

Modern, clean, professional with subtle coffee-inspired warmth. The design prioritizes clarity, readability, and user efficiency while maintaining an inviting, contemporary feel.

---

## 📊 Color Palette

### Primary Colors

- **Primary Brand**: `#6B5B4F` (Warm charcoal - professional, not harsh brown)
- **Primary Accent**: `#C89D5C` (Warm gold/bronze - refined, sophisticated)
- **Accent Light**: `#E8D5C4` (Warm cream - approachable)

### Semantic Colors

- **Success**: `#10B981` (Emerald green - clear positive action)
- **Warning**: `#F59E0B` (Amber - attention needed)
- **Error**: `#EF4444` (Red - critical issues)
- **Info**: `#3B82F6` (Blue - informational)

### Neutral Scale

- **Background**: `#FAFAF8` (Off-white with warmth)
- **Surface**: `#FFFFFF` (Clean white)
- **Text Primary**: `#1F2937` (Dark charcoal)
- **Text Secondary**: `#6B7280` (Medium gray)
- **Border**: `#E5E7EB` (Light gray)

### Dark Mode

- **Background**: `#0F172A` (Deep slate)
- **Surface**: `#1E293B` (Slate 800)
- **Text Primary**: `#F1F5F9` (Off-white)
- **Accent**: `#D4A574` (Warmer gold in dark mode)

---

## 🔤 Typography System

### Font Stack

- **Display/Headlines**: `"Inter", "Segoe UI"` - Bold, modern, sans-serif
- **Body/UI**: `"Inter", "Segoe UI"` - Excellent readability, professional
- **Monospace**: `"Fira Code", "Monaco"` - For ticket numbers, technical data

### Hierarchy

```
H1 (36px, 700): Page titles, hero text
H2 (28px, 700): Section headings
H3 (24px, 600): Subsection headings
H4 (20px, 600): Card titles
Body (16px, 400): Main content
Small (14px, 400): Secondary text
Label (12px, 600): Form labels, badges
```

---

## 🧩 Component Design Language

### Buttons

- **Primary**: Warm charcoal bg (`#6B5B4F`), white text, rounded corners (8px)
- **Secondary**: Outline style, charcoal border, transparent bg
- **Hover**: Slight darken + subtle shadow lift
- **Disabled**: Muted colors, cursor not-allowed

### Cards

- **Background**: White (`#FFFFFF`)
- **Border**: Light gray (`#E5E7EB`), 1px
- **Radius**: 12px
- **Shadow**: Soft shadow on hover (transition-based)
- **Padding**: 24px (headers), 16px (content)

### Inputs & Forms

- **Border**: Light gray, 1px
- **Focus**: Accent color border (`#C89D5C`), subtle shadow
- **Background**: Off-white (`#FAFAF8`)
- **Radius**: 8px

### Navigation

- **Header**: Clean, minimal, white background with border
- **Sidebar**: Warm neutral, icons + text, active state in accent gold
- **Breadcrumbs**: Subtle text breadcrumbs (no heavy styling)

### Badges/Tags

- **Success**: Light green bg, green text
- **Warning**: Light amber bg, amber text
- **Error**: Light red bg, red text
- **Neutral**: Light gray bg, gray text

---

## 🏠 Landing Page Structure

### Section 1: Hero

- **Headline**: "Service Management, Simplified"
- **Subheadline**: "Manage technician tickets, track service history, and optimize your operations—all in one platform."
- **CTA Buttons**:
  - Primary: "Get Started" → Signup
  - Secondary: "Learn More" → Features section
- **Visual**: Abstract illustration of connected service flow (minimal, geometric style)
- **Background**: Gradient from off-white to light cream overlay
- **Layout**: 50/50 split (text left, illustration right) on desktop; stacked on mobile

### Section 2: Key Features

- **Headline**: "Everything You Need to Run Your Service Business"
- **Layout**: 3 columns (desktop), 1 column (mobile)
- **Features**:
  1. **Ticket Management**
     - Icon: Clipboard/checklist-style
     - Description: "Create, assign, and track service tickets in real-time"
  2. **Technician Workflow**
     - Icon: Wrench/person-at-work
     - Description: "Log work hours, materials used, and completion notes"
  3. **Customer & Assets**
     - Icon: Building/database
     - Description: "Maintain centralized customer and equipment records"
  4. **Service History**
     - Icon: Clock/history
     - Description: "Complete service history for every customer and machine"
  5. **Reporting & Analytics**
     - Icon: BarChart
     - Description: "Insights into service performance, costs, and trends"
  6. **Role-Based Access**
     - Icon: Lock/shield
     - Description: "Admin, technician, and management-level permissions"

- **Card Style**:
  - White cards with light border
  - Icon in warm gold accent color
  - Hover effect: subtle lift + accent color appears on left border

### Section 3: How It Works

- **Headline**: "Three Easy Steps"
- **Visual Timeline**: Vertical on mobile, horizontal on desktop
- **Steps**:
  1. **Create** - Set up customers, machines, and service tickets
  2. **Assign** - Distribute work to technicians
  3. **Track** - Monitor progress and generate reports

- **Each Step**:
  - Large number (1, 2, 3) in accent gold
  - Brief description
  - Small illustration or icon

### Section 4: Dashboard Preview

- **Headline**: "Powerful Dashboard Overview"
- **Description**: "Get instant visibility into all active tickets and service metrics"
- **Visual**: Screenshot/mockup of dashboard
- **Design**:
  - Large image/screenshot container
  - Highlight key UI elements with subtle annotations
  - Overlay some key metrics as badges

### Section 5: Pricing/Plans (Optional)

- If applicable, show plan tiers
- Simple, clean table format
- Feature comparison checkmarks
- Highlight most popular plan with accent gold

### Section 6: CTA Banner

- **Headline**: "Ready to Transform Your Service Management?"
- **Subtext**: "Join Tech Dynamics and streamline your operations today"
- **Primary CTA**: "Start Free Trial" or "Sign Up Now"
- **Styling**:
  - Dark background (charcoal `#6B5B4F`)
  - White text
  - Accent gold button
  - Simple, bold, no distractions

### Section 7: Footer

- **Columns**:
  - Company info
  - Product links
  - Resources
  - Contact/Social
- **Bottom**: Copyright, simple gray text
- **Background**: Very light gray (`#F3F4F6`)

---

## 🎭 Visual Style Guide

### Spacing System (8px base)

- xs: 8px
- sm: 12px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px

### Border Radius

- sm: 4px (small elements)
- md: 8px (inputs, buttons)
- lg: 12px (cards)
- xl: 16px (large containers)

### Shadows

- sm: `0 1px 2px rgba(0, 0, 0, 0.05)`
- md: `0 4px 6px rgba(0, 0, 0, 0.07)`
- lg: `0 10px 15px rgba(0, 0, 0, 0.1)`
- xl: `0 20px 25px rgba(0, 0, 0, 0.15)`

### Transitions

- Fast: 150ms (UI feedback)
- Normal: 300ms (modal, sidebar)
- Slow: 500ms (page transitions)

### Icons

- Source: Lucide React (already in project)
- Size: 20px (default), 24px (nav), 32px (hero)
- Color: Inherit text color, or accent on hover

---

## 📱 Responsive Design

- **Desktop**: Full layout (1440px+)
- **Tablet**: Adjusted spacing, 2-column grids (768px-1439px)
- **Mobile**: Single column, larger touch targets (320px-767px)
- **Mobile-first**: Design mobile first, scale up

---

## 🎬 Interactions & Animations

### Micro-interactions

- **Hover**: Subtle color shift + slight scale (1.02) on buttons
- **Focus**: Border color change + gentle glow
- **Click**: Brief scale-down feedback
- **Loading**: Spinner or skeleton screens
- **Transitions**: Smooth fade-ins for content

### Animations

- **Page Load**: Fade-in + subtle slide-up
- **Modals**: Scale-in from center
- **Sidebar**: Smooth slide-in from left
- **Toast Notifications**: Slide-in from top-right

---

## 🌙 Dark Mode Implementation

- System preference detection (prefers-color-scheme)
- Manual toggle in navbar
- All colors adapt smoothly
- Maintain contrast ratios (WCAG AA minimum)

---

## 📐 Layout Grid

- **Desktop**: 12-column grid, 24px gutter
- **Tablet**: 6-column grid, 16px gutter
- **Mobile**: 4-column grid, 12px gutter
- **Max-width**: 1280px for content containers

---

## ✨ Special Elements

### Accent Highlights

- Use accent gold (`#C89D5C`) for:
  - Active navigation states
  - Primary CTA buttons
  - Important metric badges
  - Hover states on key elements

### Subtle Patterns

- Optional: Very subtle diagonal stripe or dot pattern in hero background (opacity: 0.02)
- Keeps design warm without being busy

### Coffee References (Subtle)

- Machine types displayed as icons
- Warm color palette evokes coffee/warmth without being literal
- Professional first, coffee aesthetic second

---

## 🎯 Landing Page Wireframe

```
┌─────────────────────────────────────┐
│  NAVBAR (Logo, Nav Links, CTA)      │
├─────────────────────────────────────┤
│                                     │
│  HERO SECTION                       │
│  (Headline, Subtext, CTA, Visual)   │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  FEATURES (3-col grid)              │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  HOW IT WORKS (Timeline)            │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  DASHBOARD PREVIEW                  │
│  (Screenshot + Annotations)         │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  CTA BANNER                         │
│                                     │
├─────────────────────────────────────┤
│  FOOTER                             │
└─────────────────────────────────────┘
```

---

## 🎨 Implementation Tools

- **Colors**: Tailwind CSS custom config
- **Icons**: Lucide React (already installed)
- **Animations**: Tailwind CSS + CSS transitions
- **Responsive**: Tailwind's mobile-first breakpoints
- **Images**: SVG for illustrations, optimized JPG for screenshots

---

## ✅ Accessibility

- WCAG 2.1 AA compliance
- Minimum 4.5:1 contrast ratio for text
- Semantic HTML
- ARIA labels for interactive elements
- Keyboard navigation support
- Size targets: 44x44px minimum for touch targets

---

This design system creates a cohesive, professional, and modern experience that's warm and welcoming while maintaining serious business credibility for a service management platform.

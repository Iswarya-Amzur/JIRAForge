# Slide 4: System Integration & Data Flow - Image Generation Description

## Description for Gemini Image Generation

Create a professional system architecture diagram showing the integration and data flow between components. Use a clean, modern design with boxes, arrows, and clear labels.

### Overall Layout

The diagram should be arranged in a hierarchical flow from top to bottom, with components grouped logically. Use a light background with dark text for readability.

### Top Section: User Environment

**At the top, create a large rectangular container labeled "User Environment"** containing:

1. **Left Box - "Jira (Browser)"**
   - Medium-sized rectangular box
   - Title: "Jira (Browser)"
   - Inside the box, list:
     - "Forge App UI"
     - "- Analytics"
     - "- Screenshots"
     - "- BRD Upload"
   - Position: Left side of the container

2. **Right Box - "Desktop App (Python)"**
   - Medium-sized rectangular box (same size as Jira box)
   - Title: "Desktop App (Python)"
   - Inside the box, list:
     - "- Screenshot Capture"
     - "- OAuth Auth"
     - "- File Upload"
   - Position: Right side of the container

**Both boxes should have downward arrows pointing out of the User Environment container**

### Middle Section: Backend Services

**Below the User Environment, create two parallel boxes:**

1. **Left Box - "Forge Backend (Resolvers)"**
   - Medium-sized rectangular box
   - Title: "Forge Backend (Resolvers)"
   - Inside, list:
     - "- Jira API"
     - "- Data Fetch"
     - "- Issue Create"
   - Position: Left side
   - **Draw a bidirectional arrow (↔) connecting it to the Supabase box on the right**

2. **Right Box - "Supabase (PostgreSQL)"**
   - Medium-sized rectangular box
   - Title: "Supabase (PostgreSQL)"
   - Inside, list:
     - "- Database"
     - "- Storage"
     - "- Auth"
     - "- Edge Functions"
   - Position: Right side
   - **Draw a downward arrow from this box**

### Bottom Section: AI Processing

**At the bottom, create one box:**

1. **"AI Server (Node.js)"**
   - Medium-sized rectangular box
   - Title: "AI Server (Node.js)"
   - Inside, list:
     - "- OCR"
     - "- GPT-4"
     - "- Document Parse"
   - Position: Centered below Supabase
   - **Connect with an arrow from Supabase labeled "Webhooks"**

### Connection Details

**Arrows and Labels:**
- From "Jira (Browser)" box: Downward arrow → "Forge Backend"
- From "Desktop App" box: Downward arrow → "Supabase"
- Between "Forge Backend" and "Supabase": Bidirectional arrow (↔) with label "Data Exchange"
- From "Supabase": Downward arrow labeled "Webhooks" → "AI Server"

### Visual Style

- **Boxes:** Rounded rectangles with solid borders
- **Colors:** 
  - User Environment container: Light blue background
  - Jira box: Light green
  - Desktop App box: Light orange
  - Forge Backend box: Light purple
  - Supabase box: Light yellow
  - AI Server box: Light pink
- **Arrows:** Solid lines with arrowheads, medium thickness
- **Text:** Bold titles, regular text for lists, clear and readable font
- **Spacing:** Generous spacing between components for clarity

### Additional Elements

**Below the main diagram, add a small data flow summary table:**
- Table with columns: Flow | Source | Destination | Purpose
- Rows:
  - Screenshot | Desktop App | Supabase Storage | Store screenshot
  - Analysis | Supabase Webhook | AI Server | Process screenshot
  - Results | AI Server | Supabase DB | Save analysis
  - Analytics | Supabase DB | Forge App | Display dashboard
  - BRD Upload | Forge App | Supabase Storage | Store document
  - BRD Process | Supabase Webhook | AI Server | Parse requirements
  - Issue Create | Forge App | Jira API | Create issues

### Title

**At the top of the entire diagram, add:**
- Title: "System Integration & Data Flow"
- Subtitle: "BRD Automate & Time Tracker for Jira"

---

## Ready-to-Use Prompt for Gemini Image Generation

Copy and paste this prompt directly to Gemini:

---

**PROMPT:**

Create a professional system architecture diagram for "System Integration & Data Flow - BRD Automate & Time Tracker for Jira". 

Layout (top to bottom):

**TOP ROW - User Environment (large container with light blue background):**
- Left box (light green): "Jira (Browser)" containing "Forge App UI - Analytics - Screenshots - BRD Upload"
- Right box (light orange): "Desktop App (Python)" containing "- Screenshot Capture - OAuth Auth - File Upload"
- Both boxes have downward arrows exiting the container

**MIDDLE ROW - Backend Services:**
- Left box (light purple): "Forge Backend (Resolvers)" containing "- Jira API - Data Fetch - Issue Create"
- Right box (light yellow): "Supabase (PostgreSQL)" containing "- Database - Storage - Auth - Edge Functions"
- Bidirectional arrow (↔) between these two boxes labeled "Data Exchange"
- Downward arrow from Supabase labeled "Webhooks"

**BOTTOM ROW - AI Processing:**
- Centered box (light pink): "AI Server (Node.js)" containing "- OCR - GPT-4 - Document Parse"
- Connected from Supabase above with arrow

**Visual Style:**
- Rounded rectangular boxes with solid borders
- Color-coded as specified above
- Solid arrows with arrowheads
- Bold titles, clear readable text
- Professional, clean design
- White/light background

**Title at top:** "System Integration & Data Flow"

---

## Alternative Simplified Description (If needed)

If the above is too complex, use this simpler version:

**Create a flowchart-style diagram with:**

1. **Top row (User Layer):**
   - Box: "Jira Browser - Forge App UI"
   - Box: "Desktop App - Python"

2. **Middle row (Backend Layer):**
   - Box: "Forge Backend - Resolvers"
   - Box: "Supabase - PostgreSQL + Storage"

3. **Bottom row (AI Layer):**
   - Box: "AI Server - Node.js (OCR + GPT-4)"

**Connections:**
- Jira Browser → Forge Backend (down arrow)
- Desktop App → Supabase (down arrow)
- Forge Backend ↔ Supabase (bidirectional arrow)
- Supabase → AI Server (down arrow labeled "Webhooks")

**Style:** Clean, modern, professional with color-coded boxes and clear labels.


# Architecture Diagram Validation & Supabase DB vs Storage

## ✅ Diagram Validation

Based on your Figma diagram description, here's my validation:

### Components Present (✅ Correct)

1. **Forge UI (Browser)** ✅
   - Correctly shows bidirectional communication with Forge Backend
   - Correctly shows OAuth 3LO authentication

2. **Forge Backend** ✅
   - Correctly shows connections to:
     - Supabase Storage (for file uploads/downloads)
     - Supabase DB (for data queries and cache updates)
     - Jira Cloud (for issue management)

3. **Desktop App** ✅
   - Correctly shows connections to:
     - Supabase Storage (for screenshot uploads)
     - Supabase DB (for metadata storage)
     - Atlassian OAuth 3LO (for authentication)

4. **Supabase Storage** ✅
   - Correctly positioned as file storage service
   - Receives uploads from Desktop App and Forge Backend

5. **Supabase DB** ✅
   - Correctly positioned as database
   - Includes `user_jira_issues_cache` table (as we implemented)
   - Receives data from multiple sources

6. **AI Server** ✅
   - Correctly shows connections to:
     - Supabase DB (reads cached issues, writes analysis results)
     - Jira Cloud (creates worklogs, creates issues)

7. **Jira Cloud** ✅
   - Correctly positioned as external service
   - Source of truth for issues and worklogs

### Data Flows (✅ Validated)

1. **Screenshot Flow** ✅
   - Desktop App → Supabase Storage (upload screenshot)
   - Desktop App → Supabase DB (save metadata)
   - Supabase DB → AI Server (via Edge Function webhook)
   - AI Server → Supabase DB (read cached issues, save analysis)
   - AI Server → Jira Cloud (create worklog)

2. **BRD Processing Flow** ✅
   - Forge UI → Forge Backend → Supabase Storage (upload document)
   - Forge Backend → Supabase DB (save document metadata)
   - Supabase DB → AI Server (via Edge Function webhook)
   - AI Server → Supabase DB (save parsed requirements)
   - Forge Backend → Jira Cloud (create issues)

3. **Cache Update Flow** ✅
   - Forge Backend → Jira Cloud (fetch assigned issues)
   - Forge Backend → Supabase DB (update `user_jira_issues_cache`)
   - AI Server → Supabase DB (read cached issues)

### Missing Components (⚠️ Optional)

1. **Supabase Edge Functions** - Not explicitly shown but implied
   - These trigger AI Server when screenshots/documents are uploaded
   - Could be shown as part of Supabase services

2. **Periodic Cache Update Mechanism** - Mentioned but not shown
   - Could show a scheduled job or cron trigger

## 📊 Supabase DB vs Supabase Storage - Key Differences

### Supabase Database (PostgreSQL)

**What it is:**
- A PostgreSQL relational database
- Stores structured, queryable data
- Uses SQL for queries
- Has tables, rows, columns, relationships

**What you store:**
- ✅ Structured data (tables with rows and columns)
- ✅ User information
- ✅ Screenshot metadata (id, timestamp, status, etc.)
- ✅ Analysis results (task keys, time spent, confidence scores)
- ✅ Document metadata (file name, processing status)
- ✅ Cached Jira issues (keys, summaries, status)
- ✅ Activity logs
- ✅ Settings and configuration

**How you access it:**
- SQL queries
- REST API (PostgREST)
- Supabase client libraries
- Direct PostgreSQL connection

**Example from your code:**
```typescript
// Storing screenshot metadata
await supabaseClient
  .from('screenshots')
  .insert({
    user_id: userId,
    timestamp: new Date(),
    storage_path: 'user-id/screenshot.png',
    window_title: 'VS Code',
    status: 'pending'
  });

// Querying cached issues
const { data } = await supabaseClient
  .from('user_jira_issues_cache')
  .select('*')
  .eq('user_id', userId);
```

**Characteristics:**
- Fast queries (indexed)
- ACID transactions
- Relationships (foreign keys)
- Row-Level Security (RLS)
- Real-time subscriptions

---

### Supabase Storage (Object Storage)

**What it is:**
- Object storage (like AWS S3, Google Cloud Storage)
- Stores files (binary data)
- Organized in "buckets"
- Files have paths/URLs

**What you store:**
- ✅ Screenshot images (PNG, JPG files)
- ✅ BRD documents (PDF, DOCX files)
- ✅ Thumbnails
- ✅ Any binary files

**How you access it:**
- File upload/download APIs
- Signed URLs (for secure access)
- Storage client libraries
- Direct file paths

**Example from your code:**
```typescript
// Uploading screenshot
const { data, error } = await supabaseClient.storage
  .from('screenshots')
  .upload('user-id/screenshot_123.png', imageFile);

// Downloading for AI analysis
const { data } = await supabaseClient.storage
  .from('screenshots')
  .download('user-id/screenshot_123.png');
```

**Characteristics:**
- Large file support (up to 50MB by default)
- Public or private buckets
- Signed URLs for temporary access
- File versioning
- CDN integration

---

## 🔄 How They Work Together in Your App

### Screenshot Example:

```
1. Desktop App captures screenshot (binary image file)
   ↓
2. Upload to Supabase Storage
   → File stored at: "screenshots/user-id/screenshot_123.png"
   ↓
3. Save metadata to Supabase DB
   → Row in 'screenshots' table:
     {
       id: "uuid",
       user_id: "uuid",
       storage_path: "user-id/screenshot_123.png",  ← Reference to Storage
       timestamp: "2024-01-15T10:00:00Z",
       window_title: "VS Code",
       status: "pending"
     }
   ↓
4. AI Server needs the actual image
   → Reads metadata from DB (gets storage_path)
   → Downloads file from Storage using storage_path
   → Performs OCR analysis
   → Saves results back to DB
```

**Key Point**: DB stores the **reference** (path), Storage stores the **actual file**.

---

## 📋 Comparison Table

| Feature | Supabase DB | Supabase Storage |
|---------|------------|------------------|
| **Type** | Relational Database (PostgreSQL) | Object Storage (S3-like) |
| **Data Format** | Structured (tables, rows, columns) | Unstructured (files, binary) |
| **Query Language** | SQL | File paths/URLs |
| **What You Store** | Metadata, configuration, analysis results | Images, documents, files |
| **Size Limits** | Millions of rows | 50MB per file (default) |
| **Access Method** | SQL queries, REST API | Upload/Download APIs |
| **Search** | Full-text search, complex queries | File name/path only |
| **Relationships** | Foreign keys, joins | None (flat structure) |
| **Security** | Row-Level Security (RLS) | Bucket policies |
| **Example Use** | User data, issue cache, logs | Screenshot images, PDFs |

---

## 🎯 In Your Architecture

### Supabase DB Stores:
- ✅ `users` table - User accounts
- ✅ `screenshots` table - Screenshot metadata (NOT the image itself)
- ✅ `analysis_results` table - AI analysis results
- ✅ `documents` table - Document metadata (NOT the file itself)
- ✅ `user_jira_issues_cache` table - Cached Jira issues
- ✅ `worklogs` table - Worklog tracking
- ✅ `activity_log` table - System events

### Supabase Storage Stores:
- ✅ `screenshots` bucket - Actual screenshot image files
- ✅ `documents` bucket - Actual BRD document files (PDF/DOCX)
- ✅ Thumbnails - Smaller preview images

### The Connection:
- **DB table** has a `storage_path` column that points to the file in **Storage**
- Example: `storage_path: "user-123/screenshot_456.png"` → File in Storage bucket

---

## ✅ Validation Summary

Your diagram is **correct and well-structured**! 

**Strengths:**
- ✅ All major components present
- ✅ Data flows are accurate
- ✅ Connections make sense
- ✅ Includes the cache mechanism we implemented

**Minor Suggestions:**
- Could show Supabase Edge Functions as a component (they're part of the flow)
- Could show the periodic cache update mechanism
- Could add labels to connections showing what data flows (e.g., "screenshot file", "metadata", "cached issues")

**Overall**: Your diagram accurately represents the architecture! 🎉


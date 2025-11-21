# BRD Time Tracker - AI Analysis Server

Node.js server that provides AI-powered analysis for screenshot-based time tracking and automated BRD processing. This server processes screenshots to extract text and determine active tasks, and processes BRD documents to automatically generate Jira issues.

## Features

- **Screenshot Analysis**: OCR-based text extraction and Jira task correlation
- **BRD Processing**: AI-powered requirements extraction from PDF/DOCX documents
- **Automatic Jira Integration**: Creates worklogs and issues based on analysis
- **Secure API**: Bearer token authentication for all endpoints
- **Scalable Architecture**: Ready for cloud deployment
- **Comprehensive Logging**: Winston-based logging for debugging and monitoring

## Prerequisites

- Node.js 18.x or higher
- Supabase project configured (service role key required)
- OpenAI API key (or Google Gemini API key)
- Optionally: Google Cloud Vision API for enhanced OCR

## Setup

### 1. Install Dependencies

```bash
cd ai-server
npm install
```

### 2. Create Environment File

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Required
PORT=3001
AI_SERVER_API_KEY=generate_a_secure_random_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key

# Optional
AUTO_CREATE_WORKLOGS=true
AUTO_CREATE_JIRA_ISSUES=false
```

### 3. Create Logs Directory

```bash
mkdir logs
```

### 4. Start the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Health Check

```
GET /health
```

Returns server status and uptime.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600
}
```

### Analyze Screenshot

```
POST /api/analyze-screenshot
```

Analyzes a screenshot to extract text and determine the active Jira task.

**Headers:**
- `Authorization: Bearer YOUR_API_KEY`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "screenshot_id": "uuid",
  "user_id": "uuid",
  "storage_url": "https://...",
  "storage_path": "user_id/screenshot.png",
  "window_title": "VS Code - main.js",
  "application_name": "Visual Studio Code",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "screenshot_id": "uuid",
  "analysis": {
    "task_key": "PROJ-123",
    "project_key": "PROJ",
    "confidence_score": 0.9,
    "is_active_work": true
  }
}
```

### Process BRD Document

```
POST /api/process-brd
```

Processes a BRD document to extract requirements and optionally create Jira issues.

**Headers:**
- `Authorization: Bearer YOUR_API_KEY`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "document_id": "uuid",
  "user_id": "uuid",
  "file_name": "requirements.pdf",
  "file_type": "pdf",
  "storage_url": "https://...",
  "storage_path": "user_id/requirements.pdf",
  "project_key": "PROJ"
}
```

**Response:**
```json
{
  "success": true,
  "document_id": "uuid",
  "result": {
    "extracted_text_length": 5000,
    "epics_count": 3,
    "stories_count": 12,
    "tasks_count": 45
  }
}
```

## Architecture

```
ai-server/
├── src/
│   ├── index.js                    # Main server file
│   ├── controllers/
│   │   ├── screenshot-controller.js # Screenshot analysis endpoint
│   │   └── brd-controller.js       # BRD processing endpoint
│   ├── services/
│   │   ├── screenshot-service.js   # OCR and task correlation
│   │   ├── brd-service.js          # Document parsing and AI analysis
│   │   └── supabase-service.js     # Supabase integration
│   ├── middleware/
│   │   └── auth.js                 # API key authentication
│   └── utils/
│       └── logger.js               # Winston logger configuration
├── logs/                           # Log files
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## How It Works

### Screenshot Analysis Flow

1. Supabase webhook triggers when screenshot is uploaded
2. Server downloads screenshot from Supabase Storage
3. OCR extracts text using Tesseract.js
4. Pattern matching identifies Jira issue keys (e.g., PROJ-123)
5. Heuristics determine if activity is work-related or idle
6. Results saved to `analysis_results` table
7. Optionally creates Jira worklog entry

### BRD Processing Flow

1. Supabase webhook triggers when document is uploaded
2. Server downloads document from Supabase Storage
3. Text extraction (PDF-parse for PDF, Mammoth for DOCX)
4. OpenAI GPT-4 parses requirements into Epics/Stories/Tasks
5. Structured data saved to `documents` table
6. Optionally creates Jira issues hierarchically

## Key Technologies

### OCR & Image Processing
- **Tesseract.js**: Open-source OCR engine
- **Sharp**: High-performance image processing
- Alternative: Google Cloud Vision API for better accuracy

### Document Processing
- **pdf-parse**: PDF text extraction
- **mammoth**: DOCX text extraction

### AI/ML
- **OpenAI GPT-4**: Requirements parsing and structuring
- Alternative: Google Gemini API

### Infrastructure
- **Express**: Web framework
- **Winston**: Logging
- **Helmet**: Security headers
- **Rate Limiting**: DDoS protection

## Configuration

### Screenshot Analysis

```env
SCREENSHOT_INTERVAL=300
AUTO_CREATE_WORKLOGS=true
```

- **SCREENSHOT_INTERVAL**: How long each screenshot represents (in seconds)
- **AUTO_CREATE_WORKLOGS**: Automatically create Jira worklogs when task is detected

### BRD Processing

```env
OPENAI_MODEL=gpt-4
AUTO_CREATE_JIRA_ISSUES=false
```

- **OPENAI_MODEL**: Which OpenAI model to use (gpt-4, gpt-3.5-turbo)
- **AUTO_CREATE_JIRA_ISSUES**: Automatically create issues (or wait for user confirmation)

### Security

```env
AI_SERVER_API_KEY=your_secure_key
```

Generate a secure API key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Deployment

### Option 1: Traditional Server (VPS, AWS EC2, etc.)

```bash
# Install Node.js 18+
# Clone repository
# Install dependencies
npm install --production

# Set environment variables
cp .env.example .env
# Edit .env with production values

# Use PM2 for process management
npm install -g pm2
pm2 start src/index.js --name ai-server
pm2 save
pm2 startup
```

### Option 2: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "src/index.js"]
```

Build and run:
```bash
docker build -t brd-ai-server .
docker run -p 3001:3001 --env-file .env brd-ai-server
```

### Option 3: Cloud Functions

This server can be adapted to run as:
- AWS Lambda
- Google Cloud Functions
- Azure Functions

Modify entry point to handle serverless events.

## Monitoring & Logging

### Log Files

Logs are written to `logs/` directory:
- `error.log`: Error-level logs
- `combined.log`: All logs

### Log Levels

```env
LOG_LEVEL=info  # debug, info, warn, error
```

### Health Check Endpoint

Monitor server health:
```bash
curl http://localhost:3001/health
```

## Performance Optimization

### Caching

Consider caching:
- OCR results for identical screenshots
- User's recent Jira issues for faster correlation
- Parsed BRD requirements

### Parallel Processing

For high volume:
- Use worker threads for OCR
- Queue system (Bull, RabbitMQ) for background processing
- Multiple server instances with load balancer

### Database Connection Pooling

Supabase client handles connection pooling automatically.

## Troubleshooting

### OCR Not Working

- Check image quality (resolution, contrast)
- Ensure Tesseract language data is installed
- Consider using Google Vision API for better results

### OpenAI API Errors

- Verify API key is valid
- Check rate limits
- Monitor token usage
- Try alternative models (gpt-3.5-turbo for faster/cheaper)

### Supabase Connection Issues

- Verify service role key
- Check network connectivity
- Ensure RLS policies allow service role access
- Check Supabase Storage bucket permissions

### Memory Issues

OCR and document processing can be memory-intensive:
- Increase Node.js memory limit: `node --max-old-space-size=4096 src/index.js`
- Process large documents in chunks
- Consider serverless architecture for automatic scaling

## Testing

Run tests:
```bash
npm test
```

Test screenshot analysis endpoint:
```bash
curl -X POST http://localhost:3001/api/analyze-screenshot \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "screenshot_id": "test",
    "user_id": "test",
    "storage_url": "https://...",
    "storage_path": "test/screenshot.png",
    "window_title": "PROJ-123 - Jira",
    "application_name": "Chrome"
  }'
```

## Security Best Practices

1. **API Key**: Use a strong, random API key
2. **HTTPS Only**: Deploy behind HTTPS (nginx, Cloudflare)
3. **Rate Limiting**: Already configured (100 req/15min per IP)
4. **Input Validation**: Validate all request payloads
5. **Service Role Key**: Keep Supabase service role key secret
6. **CORS**: Configure CORS for specific origins in production

## Future Enhancements

- [ ] Google Cloud Vision integration for better OCR
- [ ] Support for more document formats (Pages, ODT)
- [ ] ML model for better task correlation
- [ ] Browser history integration
- [ ] Calendar integration for meeting detection
- [ ] Multi-language support for OCR
- [ ] Real-time analysis via WebSockets
- [ ] Analytics dashboard for processing stats

## License

MIT

## Support

For issues and questions:
- Check logs in `logs/` directory
- Review Supabase setup
- Check OpenAI API status
- Verify environment variables

## API Integration

### From Supabase Edge Functions

Set the webhook URL in Supabase:
```sql
SELECT set_webhook_url('screenshot', 'https://your-server.com/api/analyze-screenshot');
SELECT set_webhook_url('document', 'https://your-server.com/api/process-brd');
```

### From Forge App

Configure in Forge environment:
```env
AI_SERVER_URL=https://your-server.com
AI_SERVER_API_KEY=your_api_key
```

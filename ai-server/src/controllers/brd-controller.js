const brdService = require('../services/brd-service');
const supabaseService = require('../services/supabase-service');
const logger = require('../utils/logger');

/**
 * Process BRD document endpoint
 * Triggered by Supabase webhook when a new document is uploaded
 */
exports.processBRD = async (req, res) => {
  try {
    const {
      document_id,
      user_id,
      file_name,
      file_type,
      storage_url,
      storage_path,
      project_key
    } = req.body;

    // Validate required fields
    if (!document_id || !user_id || !storage_url || !file_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: document_id, user_id, storage_url, file_type'
      });
    }

    logger.info('Starting BRD processing', {
      document_id,
      user_id,
      file_type,
      file_name
    });

    // Update document status to extracting
    await supabaseService.updateDocumentStatus(document_id, 'extracting');

    // Download document from Supabase Storage
    const documentBuffer = await supabaseService.downloadFile('documents', storage_path);

    // Extract text from document
    let extractedText;
    if (file_type === 'pdf') {
      extractedText = await brdService.extractTextFromPDF(documentBuffer);
    } else if (file_type === 'docx' || file_type === 'doc') {
      extractedText = await brdService.extractTextFromDocx(documentBuffer);
    } else {
      throw new Error(`Unsupported file type: ${file_type}`);
    }

    logger.info('Text extracted from document', {
      document_id,
      textLength: extractedText.length
    });

    // Update status to analyzing
    await supabaseService.updateDocumentStatus(document_id, 'analyzing');

    // Parse requirements using AI (GPT-4 or Gemini)
    const parsedRequirements = await brdService.parseRequirements(extractedText, {
      fileName: file_name,
      projectKey: project_key
    });

    logger.info('Requirements parsed', {
      document_id,
      epicsCount: parsedRequirements.epics?.length || 0,
      storiesCount: parsedRequirements.stories?.length || 0
    });

    // Save extracted text and parsed requirements to Supabase
    await supabaseService.updateDocumentData(document_id, {
      extracted_text: extractedText,
      parsed_requirements: parsedRequirements,
      processing_status: 'completed',
      ai_model_version: parsedRequirements.modelVersion
    });

    // Optionally create Jira issues immediately
    // (Or wait for user confirmation via Forge app)
    if (process.env.AUTO_CREATE_JIRA_ISSUES === 'true' && project_key) {
      try {
        const createdIssues = await brdService.createJiraIssues({
          requirements: parsedRequirements,
          projectKey: project_key,
          userId: user_id
        });

        await supabaseService.updateDocumentData(document_id, {
          created_issues: createdIssues
        });

        logger.info('Jira issues created automatically', {
          document_id,
          issuesCreated: createdIssues.length
        });
      } catch (jiraError) {
        logger.error('Failed to create Jira issues', { error: jiraError, document_id });
        // Don't fail the entire processing if Jira creation fails
      }
    }

    logger.info('BRD processing completed', { document_id });

    res.json({
      success: true,
      document_id,
      result: {
        extracted_text_length: extractedText.length,
        epics_count: parsedRequirements.epics?.length || 0,
        stories_count: parsedRequirements.stories?.length || 0,
        tasks_count: parsedRequirements.tasks?.length || 0
      }
    });

  } catch (error) {
    logger.error('BRD processing error:', error);

    // Update document status to failed
    if (req.body.document_id) {
      try {
        await supabaseService.updateDocumentStatus(
          req.body.document_id,
          'failed',
          error.message
        );
      } catch (updateError) {
        logger.error('Failed to update document status:', updateError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to process BRD document',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

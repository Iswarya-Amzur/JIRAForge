/**
 * Feedback Service Unit Tests
 */

const axios = require('axios');
const FormData = require('form-data');
const logger = require('../../src/utils/logger');
const { chatCompletionWithFallback } = require('../../src/services/ai/ai-client');
const { getFeedbackById, updateFeedbackStatus, updateFeedbackAIResults } = require('../../src/services/db/feedback-db-service');
const { downloadFile } = require('../../src/services/db/storage-service');

// Mock all dependencies
jest.mock('axios');
jest.mock('form-data');
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/ai/ai-client');
jest.mock('../../src/services/db/feedback-db-service');
jest.mock('../../src/services/db/storage-service');

// Import service after mocks
const feedbackService = require('../../src/services/feedback-service');

describe('Feedback Service', () => {
  const mockFeedback = {
    id: 'feedback123',
    category: 'bug',
    title: 'Test Bug',
    description: 'Something is broken',
    user_display_name: 'Test User',
    user_email: 'test@example.com',
    image_paths: []
  };

  const mockEnv = {
    JIRA_FEEDBACK_PROJECT: 'PROJ',
    JIRA_FEEDBACK_SITE_URL: 'https://test.atlassian.net',
    JIRA_FEEDBACK_EMAIL: 'test@example.com',
    JIRA_FEEDBACK_API_TOKEN: 'test-token'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set environment variables
    Object.assign(process.env, mockEnv);
  });

  afterEach(() => {
    // Clean up environment variables
    Object.keys(mockEnv).forEach(key => delete process.env[key]);
  });

  describe('processAndCreateJiraTicket', () => {
    it('should process feedback and create Jira ticket successfully', async () => {
      getFeedbackById.mockResolvedValue(mockFeedback);
      updateFeedbackStatus.mockResolvedValue();
      
      chatCompletionWithFallback.mockResolvedValue({
        response: {
          choices: [{
            message: {
              content: JSON.stringify({
                title: 'Bug: Test Bug',
                summary: 'AI generated summary',
                issueType: 'Bug',
                priority: 'High',
                labels: ['bug', 'urgent']
              })
            }
          }]
        }
      });

      updateFeedbackAIResults.mockResolvedValue();

      axios.get.mockResolvedValue({
        data: {
          issueTypes: [
            { name: 'Bug', subtask: false },
            { name: 'Task', subtask: false }
          ]
        }
      });

      axios.post.mockResolvedValue({
        data: {
          key: 'PROJ-123',
          id: '10001'
        }
      });

      await feedbackService.processAndCreateJiraTicket('feedback123');

      expect(updateFeedbackStatus).toHaveBeenCalledWith('feedback123', 'processing');
      expect(getFeedbackById).toHaveBeenCalledWith('feedback123');
      expect(chatCompletionWithFallback).toHaveBeenCalled();
      expect(axios.post).toHaveBeenCalled();
      expect(updateFeedbackStatus).toHaveBeenCalledWith('feedback123', 'created', expect.objectContaining({
        jira_issue_key: 'PROJ-123'
      }));
    });

    it('should handle feedback not found', async () => {
      getFeedbackById.mockResolvedValue(null);

      await feedbackService.processAndCreateJiraTicket('feedback123');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Feedback %s not found'),
        'feedback123'
      );
    });

    it('should fail if JIRA_FEEDBACK_PROJECT is missing', async () => {
      delete process.env.JIRA_FEEDBACK_PROJECT;
      
      getFeedbackById.mockResolvedValue(mockFeedback);
      updateFeedbackStatus.mockResolvedValue();

      await feedbackService.processAndCreateJiraTicket('feedback123');

      expect(updateFeedbackStatus).toHaveBeenCalledWith('feedback123', 'failed', 
        expect.objectContaining({
          error: expect.stringContaining('JIRA_FEEDBACK_PROJECT')
        })
      );
    });

    it('should fail if JIRA_FEEDBACK_SITE_URL is missing', async () => {
      delete process.env.JIRA_FEEDBACK_SITE_URL;
      
      getFeedbackById.mockResolvedValue(mockFeedback);
      updateFeedbackStatus.mockResolvedValue();

      await feedbackService.processAndCreateJiraTicket('feedback123');

      expect(updateFeedbackStatus).toHaveBeenCalledWith('feedback123', 'failed', 
        expect.objectContaining({
          error: expect.stringContaining('JIRA_FEEDBACK_SITE_URL')
        })
      );
    });

    it('should fail if JIRA_FEEDBACK_EMAIL is missing', async () => {
      delete process.env.JIRA_FEEDBACK_EMAIL;
      
      getFeedbackById.mockResolvedValue(mockFeedback);
      updateFeedbackStatus.mockResolvedValue();

      await feedbackService.processAndCreateJiraTicket('feedback123');

      expect(updateFeedbackStatus).toHaveBeenCalledWith('feedback123', 'failed', 
        expect.objectContaining({
          error: expect.stringContaining('JIRA_FEEDBACK_EMAIL')
        })
      );
    });

    it('should fail if JIRA_FEEDBACK_API_TOKEN is missing', async () => {
      delete process.env.JIRA_FEEDBACK_API_TOKEN;
      
      getFeedbackById.mockResolvedValue(mockFeedback);
      updateFeedbackStatus.mockResolvedValue();

      await feedbackService.processAndCreateJiraTicket('feedback123');

      expect(updateFeedbackStatus).toHaveBeenCalledWith('feedback123', 'failed', 
        expect.objectContaining({
          error: expect.stringContaining('JIRA_FEEDBACK_API_TOKEN')
        })
      );
    });

    it('should use default AI results if AI analysis fails', async () => {
      getFeedbackById.mockResolvedValue(mockFeedback);
      updateFeedbackStatus.mockResolvedValue();
      
      chatCompletionWithFallback.mockRejectedValue(new Error('AI service unavailable'));

      axios.get.mockResolvedValue({
        data: {
          issueTypes: [{ name: 'Bug', subtask: false }]
        }
      });

      axios.post.mockResolvedValue({
        data: { key: 'PROJ-123', id: '10001' }
      });

      await feedbackService.processAndCreateJiraTicket('feedback123');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('AI analysis failed'),
        expect.any(String),
        expect.any(String)
      );
      expect(axios.post).toHaveBeenCalled();
    });

    it('should mark as failed if Jira creation fails', async () => {
      getFeedbackById.mockResolvedValue(mockFeedback);
      updateFeedbackStatus.mockResolvedValue();
      
      chatCompletionWithFallback.mockResolvedValue({
        response: {
          choices: [{
            message: {
              content: JSON.stringify({
                title: 'Bug',
                summary: 'Summary',
                issueType: 'Bug',
                priority: 'High',
                labels: []
              })
            }
          }]
        }
      });

      updateFeedbackAIResults.mockResolvedValue();

      axios.get.mockRejectedValue(new Error('Jira API error'));

      await feedbackService.processAndCreateJiraTicket('feedback123');

      expect(updateFeedbackStatus).toHaveBeenCalledWith('feedback123', 'failed', 
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should attach images if present', async () => {
      const feedbackWithImages = {
        ...mockFeedback,
        image_paths: ['user/image1.png', 'user/image2.jpg']
      };

      getFeedbackById.mockResolvedValue(feedbackWithImages);
      updateFeedbackStatus.mockResolvedValue();
      
      chatCompletionWithFallback.mockResolvedValue({
        response: {
          choices: [{
            message: {
              content: JSON.stringify({
                title: 'Bug',
                summary: 'Summary',
                issueType: 'Bug'
              })
            }
          }]
        }
      });

      updateFeedbackAIResults.mockResolvedValue();

      axios.get.mockResolvedValue({
        data: {
          issueTypes: [{ name: 'Bug', subtask: false }]
        }
      });

      axios.post.mockResolvedValue({
        data: { key: 'PROJ-123', id: '10001' }
      });

      downloadFile.mockResolvedValue(Buffer.from('image data'));

      const mockFormData = {
        append: jest.fn(),
        getHeaders: jest.fn().mockReturnValue({})
      };
      FormData.mockImplementation(() => mockFormData);

      await feedbackService.processAndCreateJiraTicket('feedback123');

      expect(downloadFile).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Attached %d images'),
        2,
        'PROJ-123'
      );
    });

    it('should continue if image attachment fails', async () => {
      const feedbackWithImages = {
        ...mockFeedback,
        image_paths: ['user/image1.png']
      };

      getFeedbackById.mockResolvedValue(feedbackWithImages);
      updateFeedbackStatus.mockResolvedValue();
      
      chatCompletionWithFallback.mockResolvedValue({
        response: {
          choices: [{
            message: {
              content: JSON.stringify({
                title: 'Bug',
                summary: 'Summary',
                issueType: 'Bug'
              })
            }
          }]
        }
      });

      updateFeedbackAIResults.mockResolvedValue();

      axios.get.mockResolvedValue({
        data: {
          issueTypes: [{ name: 'Bug', subtask: false }]
        }
      });

      axios.post
        .mockResolvedValueOnce({ data: { key: 'PROJ-123', id: '10001' } })
        .mockRejectedValueOnce(new Error('Attachment failed'));

      downloadFile.mockResolvedValue(Buffer.from('image'));

      const mockFormData = {
        append: jest.fn(),
        getHeaders: jest.fn().mockReturnValue({})
      };
      FormData.mockImplementation(() => mockFormData);

      await feedbackService.processAndCreateJiraTicket('feedback123');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to attach images'),
        expect.any(String),
        expect.any(String)
      );
      expect(updateFeedbackStatus).toHaveBeenCalledWith('feedback123', 'created', expect.any(Object));
    });

    it('should handle parseAIResponse with markdown-wrapped JSON', async () => {
      getFeedbackById.mockResolvedValue(mockFeedback);
      updateFeedbackStatus.mockResolvedValue();
      
      chatCompletionWithFallback.mockResolvedValue({
        response: {
          choices: [{
            message: {
              content: '```json\n{"title":"Bug","summary":"Summary","issueType":"Bug"}\n```'
            }
          }]
        }
      });

      updateFeedbackAIResults.mockResolvedValue();

      axios.get.mockResolvedValue({
        data: {
          issueTypes: [{ name: 'Bug', subtask: false }]
        }
      });

      axios.post.mockResolvedValue({
        data: { key: 'PROJ-123', id: '10001' }
      });

      await feedbackService.processAndCreateJiraTicket('feedback123');

      expect(axios.post).toHaveBeenCalled();
    });

    it('should handle empty AI response', async () => {
      getFeedbackById.mockResolvedValue(mockFeedback);
      updateFeedbackStatus.mockResolvedValue();
      
      chatCompletionWithFallback.mockResolvedValue({
        response: {
          choices: [{
            message: {
              content: null
            }
          }]
        }
      });

      axios.get.mockResolvedValue({
        data: {
          issueTypes: [{ name: 'Bug', subtask: false }]
        }
      });

      axios.post.mockResolvedValue({
        data: { key: 'PROJ-123', id: '10001' }
      });

      await feedbackService.processAndCreateJiraTicket('feedback123');

      expect(logger.warn).toHaveBeenCalled();
      expect(axios.post).toHaveBeenCalled();
    });

    it('should handle invalid JSON in AI response', async () => {
      getFeedbackById.mockResolvedValue(mockFeedback);
      updateFeedbackStatus.mockResolvedValue();
      
      chatCompletionWithFallback.mockResolvedValue({
        response: {
          choices: [{
            message: {
              content: 'invalid json{'
            }
          }]
        }
      });

      updateFeedbackAIResults.mockResolvedValue();

      axios.get.mockResolvedValue({
        data: {
          issueTypes: [{ name: 'Bug', subtask: false }]
        }
      });

      axios.post.mockResolvedValue({
        data: { key: 'PROJ-123', id: '10001' }
      });

      await feedbackService.processAndCreateJiraTicket('feedback123');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse AI response'),
        expect.any(String)
      );
    });
  });

  describe('createJiraIssue', () => {
    it('should create Jira issue with resolved issue type', async () => {
      axios.get.mockResolvedValue({
        data: {
          issueTypes: [
            { name: 'Bug', subtask: false },
            { name: 'Task', subtask: false }
          ]
        }
      });

      axios.post.mockResolvedValue({
        data: {
          key: 'PROJ-123',
          id: '10001'
        }
      });

      const result = await feedbackService.createJiraIssue(
        'test@example.com',
        'token',
        'https://test.atlassian.net',
        {
          projectKey: 'PROJ',
          title: 'Test Issue',
          description: 'Description',
          issueType: 'Bug',
          priority: 'High',
          labels: ['test']
        }
      );

      expect(result.key).toBe('PROJ-123');
      expect(result.url).toBe('https://test.atlassian.net/browse/PROJ-123');
    });

    it('should fallback to Task if requested issue type not available', async () => {
      axios.get.mockResolvedValue({
        data: {
          issueTypes: [
            { name: 'Task', subtask: false },
            { name: 'Story', subtask: false }
          ]
        }
      });

      axios.post.mockResolvedValue({
        data: { key: 'PROJ-123', id: '10001' }
      });

      await feedbackService.createJiraIssue(
        'test@example.com',
        'token',
        'https://test.atlassian.net',
        {
          projectKey: 'PROJ',
          title: 'Test',
          description: 'Desc',
          issueType: 'Bug'
        }
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('not available, using "Task"'),
        expect.any(String)
      );
    });

    it('should use first available type if Task not available', async () => {
      axios.get.mockResolvedValue({
        data: {
          issueTypes: [
            { name: 'Story', subtask: false },
            { name: 'Epic', subtask: false }
          ]
        }
      });

      axios.post.mockResolvedValue({
        data: { key: 'PROJ-123', id: '10001' }
      });

      await feedbackService.createJiraIssue(
        'test@example.com',
        'token',
        'https://test.atlassian.net',
        {
          projectKey: 'PROJ',
          title: 'Test',
          description: 'Desc',
          issueType: 'Bug'
        }
      );

      const postCall = axios.post.mock.calls.find(call => 
        call[0].includes('/rest/api/3/issue')
      );
      expect(postCall[1].fields.issuetype.name).toBe('Story');
    });

    it('should retry without priority and labels on field errors', async () => {
      axios.get.mockResolvedValue({
        data: {
          issueTypes: [{ name: 'Task', subtask: false }]
        }
      });

      axios.post
        .mockRejectedValueOnce({
          response: {
            data: {
              errors: {
                priority: 'Priority field is not available',
                labels: 'Labels field is not available'
              }
            }
          }
        })
        .mockResolvedValueOnce({
          data: { key: 'PROJ-123', id: '10001' }
        });

      const result = await feedbackService.createJiraIssue(
        'test@example.com',
        'token',
        'https://test.atlassian.net',
        {
          projectKey: 'PROJ',
          title: 'Test',
          description: 'Desc',
          issueType: 'Task',
          priority: 'High',
          labels: ['test']
        }
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Retrying without priority/labels'),
        expect.any(String)
      );
      expect(result.key).toBe('PROJ-123');
    });

    it('should throw error if Jira API fails with non-field error', async () => {
      axios.get.mockResolvedValue({
        data: {
          issueTypes: [{ name: 'Task', subtask: false }]
        }
      });

      axios.post.mockRejectedValue({
        response: {
          data: {
            errorMessages: ['Project does not exist']
          }
        }
      });

      await expect(feedbackService.createJiraIssue(
        'test@example.com',
        'token',
        'https://test.atlassian.net',
        {
          projectKey: 'INVALID',
          title: 'Test',
          description: 'Desc',
          issueType: 'Task'
        }
      )).rejects.toThrow('Jira API error');
    });

    it('should handle trailing slash in siteUrl', async () => {
      axios.get.mockResolvedValue({
        data: {
          issueTypes: [{ name: 'Task', subtask: false }]
        }
      });

      axios.post.mockResolvedValue({
        data: { key: 'PROJ-123', id: '10001' }
      });

      const result = await feedbackService.createJiraIssue(
        'test@example.com',
        'token',
        'https://test.atlassian.net/',
        {
          projectKey: 'PROJ',
          title: 'Test',
          description: 'Desc',
          issueType: 'Task'
        }
      );

      expect(result.url).toBe('https://test.atlassian.net/browse/PROJ-123');
    });

    it('should filter out subtask issue types', async () => {
      axios.get.mockResolvedValue({
        data: {
          issueTypes: [
            { name: 'Sub-task', subtask: true },
            { name: 'Task', subtask: false }
          ]
        }
      });

      axios.post.mockResolvedValue({
        data: { key: 'PROJ-123', id: '10001' }
      });

      await feedbackService.createJiraIssue(
        'test@example.com',
        'token',
        'https://test.atlassian.net',
        {
          projectKey: 'PROJ',
          title: 'Test',
          description: 'Desc',
          issueType: 'Task'
        }
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Available issue types'),
        'PROJ',
        'Task'
      );
    });

    it('should handle issue type fetch failure gracefully', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      axios.post.mockResolvedValue({
        data: { key: 'PROJ-123', id: '10001' }
      });

      const result = await feedbackService.createJiraIssue(
        'test@example.com',
        'token',
        'https://test.atlassian.net',
        {
          projectKey: 'PROJ',
          title: 'Test',
          description: 'Desc',
          issueType: 'Bug'
        }
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not fetch issue types'),
        'Bug',
        expect.any(String)
      );
      expect(result.key).toBe('PROJ-123');
    });
  });

  describe('attachImagesToJiraIssue', () => {
    it('should attach multiple images to Jira issue', async () => {
      downloadFile.mockResolvedValue(Buffer.from('image data'));

      const mockFormData = {
        append: jest.fn(),
        getHeaders: jest.fn().mockReturnValue({ 'content-type': 'multipart/form-data' })
      };
      FormData.mockImplementation(() => mockFormData);

      axios.post.mockResolvedValue({ data: {} });

      await feedbackService.attachImagesToJiraIssue(
        'test@example.com',
        'token',
        'https://test.atlassian.net',
        'PROJ-123',
        ['user/image1.png', 'user/image2.jpg']
      );

      expect(downloadFile).toHaveBeenCalledTimes(2);
      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(axios.post).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue/PROJ-123/attachments',
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Atlassian-Token': 'no-check'
          })
        })
      );
    });

    it('should continue attaching even if one image fails', async () => {
      downloadFile
        .mockResolvedValueOnce(Buffer.from('image1'))
        .mockRejectedValueOnce(new Error('Download failed'))
        .mockResolvedValueOnce(Buffer.from('image3'));

      const mockFormData = {
        append: jest.fn(),
        getHeaders: jest.fn().mockReturnValue({})
      };
      FormData.mockImplementation(() => mockFormData);

      axios.post.mockResolvedValue({ data: {} });

      await feedbackService.attachImagesToJiraIssue(
        'test@example.com',
        'token',
        'https://test.atlassian.net',
        'PROJ-123',
        ['image1.png', 'image2.png', 'image3.png']
      );

      expect(logger.error).toHaveBeenCalled();
      expect(axios.post).toHaveBeenCalledTimes(2); // Only 2 succeeded
    });

    it('should extract filename from path correctly', async () => {
      downloadFile.mockResolvedValue(Buffer.from('image'));

      const mockFormData = {
        append: jest.fn(),
        getHeaders: jest.fn().mockReturnValue({})
      };
      FormData.mockImplementation(() => mockFormData);

      axios.post.mockResolvedValue({ data: {} });

      await feedbackService.attachImagesToJiraIssue(
        'test@example.com',
        'token',
        'https://test.atlassian.net',
        'PROJ-123',
        ['user/subfolder/image.png']
      );

      expect(mockFormData.append).toHaveBeenCalledWith(
        'file',
        expect.any(Buffer),
        expect.objectContaining({
          filename: 'image.png'
        })
      );
    });

    it('should set correct content type based on file extension', async () => {
      downloadFile.mockResolvedValue(Buffer.from('image'));

      const mockFormData = {
        append: jest.fn(),
        getHeaders: jest.fn().mockReturnValue({})
      };
      FormData.mockImplementation(() => mockFormData);

      axios.post.mockResolvedValue({ data: {} });

      await feedbackService.attachImagesToJiraIssue(
        'test@example.com',
        'token',
        'https://test.atlassian.net',
        'PROJ-123',
        ['test.jpg', 'test.png', 'test.webp']
      );

      const appendCalls = mockFormData.append.mock.calls;
      expect(appendCalls[0][2].contentType).toBe('image/jpeg');
      expect(appendCalls[1][2].contentType).toBe('image/png');
      expect(appendCalls[2][2].contentType).toBe('image/webp');
    });

    it('should handle unknown file extension with default content type', async () => {
      downloadFile.mockResolvedValue(Buffer.from('data'));

      const mockFormData = {
        append: jest.fn(),
        getHeaders: jest.fn().mockReturnValue({})
      };
      FormData.mockImplementation(() => mockFormData);

      axios.post.mockResolvedValue({ data: {} });

      await feedbackService.attachImagesToJiraIssue(
        'test@example.com',
        'token',
        'https://test.atlassian.net',
        'PROJ-123',
        ['test.unknown']
      );

      expect(mockFormData.append).toHaveBeenCalledWith(
        'file',
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'application/octet-stream'
        })
      );
    });

    it('should handle files without extension', async () => {
      downloadFile.mockResolvedValue(Buffer.from('data'));

      const mockFormData = {
        append: jest.fn(),
        getHeaders: jest.fn().mockReturnValue({})
      };
      FormData.mockImplementation(() => mockFormData);

      axios.post.mockResolvedValue({ data: {} });

      await feedbackService.attachImagesToJiraIssue(
        'test@example.com',
        'token',
        'https://test.atlassian.net',
        'PROJ-123',
        ['noextension']
      );

      expect(mockFormData.append).toHaveBeenCalledWith(
        'file',
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'application/octet-stream'
        })
      );
    });
  });
});

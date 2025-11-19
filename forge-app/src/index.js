import Resolver from '@forge/resolver';
import api, { route, fetch, storage } from '@forge/api';

const resolver = new Resolver();

/**
 * Helper function to get Supabase client configuration from settings
 */
async function getSupabaseConfig(accountId) {
  try {
    const settings = await storage.get(`${accountId}:settings`);
    if (!settings) {
      return null;
    }
    return {
      url: settings.supabaseUrl,
      serviceRoleKey: settings.supabaseServiceRoleKey,
      anonKey: settings.supabaseAnonKey
    };
  } catch (error) {
    console.error('Error getting Supabase config:', error);
    return null;
  }
}

/**
 * Helper function to get or create user record in Supabase
 */
async function getOrCreateUser(accountId, supabaseConfig) {
  try {
    // First, try to get user by Atlassian account ID
    const response = await fetch(`${supabaseConfig.url}/rest/v1/users?atlassian_account_id=eq.${accountId}&select=id`, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.serviceRoleKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Content-Type': 'application/json'
      }
    });

    const users = await response.json();
    
    if (users && users.length > 0) {
      return users[0].id;
    }

    // User doesn't exist, create one
    const createResponse = await fetch(`${supabaseConfig.url}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'apikey': supabaseConfig.serviceRoleKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        atlassian_account_id: accountId
      })
    });

    const newUser = await createResponse.json();
    return newUser[0].id;
  } catch (error) {
    console.error('Error getting/creating user:', error);
    throw error;
  }
}

/**
 * Helper function to make Supabase API calls
 */
async function supabaseRequest(supabaseConfig, endpoint, options = {}) {
  const url = `${supabaseConfig.url}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': supabaseConfig.serviceRoleKey,
    'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase request failed: ${error}`);
  }

  return response.json();
}

/**
 * Resolver for fetching time analytics data from Supabase
 */
resolver.define('getTimeAnalytics', async (req) => {
  const { context } = req;
  const accountId = context.accountId;

  try {
    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return {
        success: false,
        error: 'Supabase not configured. Please configure in Settings.'
      };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig);
    if (!userId) {
      return {
        success: false,
        error: 'Unable to get user information'
      };
    }

    // Fetch daily summary
    const dailySummary = await supabaseRequest(
      supabaseConfig,
      `daily_time_summary?user_id=eq.${userId}&order=work_date.desc&limit=30`
    );

    // Fetch weekly summary
    const weeklySummary = await supabaseRequest(
      supabaseConfig,
      `weekly_time_summary?user_id=eq.${userId}&order=week_start.desc&limit=12`
    );

    // Fetch project time summary
    const timeByProject = await supabaseRequest(
      supabaseConfig,
      `project_time_summary?user_id=eq.${userId}&order=total_seconds.desc`
    );

    // Fetch time by issue (from analysis_results)
    const timeByIssue = await supabaseRequest(
      supabaseConfig,
      `analysis_results?user_id=eq.${userId}&is_active_work=eq.true&is_idle=eq.false&active_task_key=not.is.null&select=active_task_key,active_project_key,time_spent_seconds&order=created_at.desc`
    );

    // Aggregate time by issue
    const issueAggregation = {};
    timeByIssue.forEach(result => {
      const key = result.active_task_key;
      if (!issueAggregation[key]) {
        issueAggregation[key] = {
          issueKey: key,
          projectKey: result.active_project_key,
          totalSeconds: 0
        };
      }
      issueAggregation[key].totalSeconds += result.time_spent_seconds || 0;
    });

    const timeByIssueArray = Object.values(issueAggregation)
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .slice(0, 50); // Top 50 issues

    return {
      success: true,
      data: {
        dailySummary: dailySummary || [],
        weeklySummary: weeklySummary || [],
        timeByProject: timeByProject || [],
        timeByIssue: timeByIssueArray
      }
    };
  } catch (error) {
    console.error('Error fetching time analytics:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Resolver for fetching screenshots for a user
 */
resolver.define('getScreenshots', async (req) => {
  const { context, payload } = req;
  const accountId = context.accountId;
  const { limit = 50, offset = 0 } = payload || {};

  try {
    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return {
        success: false,
        error: 'Supabase not configured. Please configure in Settings.'
      };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig);
    if (!userId) {
      return {
        success: false,
        error: 'Unable to get user information'
      };
    }

    // Fetch screenshots (excluding deleted ones)
    const screenshots = await supabaseRequest(
      supabaseConfig,
      `screenshots?user_id=eq.${userId}&deleted_at=is.null&order=timestamp.desc&limit=${limit}&offset=${offset}`
    );

    // Generate signed URLs for private storage images
    // Since the screenshots bucket is private, we need signed URLs
    const screenshotsWithUrls = await Promise.all(
      (screenshots || []).map(async (screenshot) => {
        const screenshotWithUrl = { ...screenshot };
        
        // Generate signed URL for thumbnail if it exists
        if (screenshot.thumbnail_url || screenshot.storage_path) {
          try {
            // Extract thumbnail path from storage_path
            let thumbPath = screenshot.thumbnail_url;
            if (!thumbPath && screenshot.storage_path) {
              // Format: user_id/screenshot_timestamp.png -> user_id/thumb_timestamp.jpg
              if (screenshot.storage_path.includes('/')) {
                const dirPath = screenshot.storage_path.substring(0, screenshot.storage_path.lastIndexOf('/'));
                const filename = screenshot.storage_path.substring(screenshot.storage_path.lastIndexOf('/') + 1);
                const thumbFilename = filename.replace('screenshot_', 'thumb_').replace('.png', '.jpg');
                thumbPath = `${dirPath}/${thumbFilename}`;
              } else {
                thumbPath = screenshot.storage_path.replace('screenshot_', 'thumb_').replace('.png', '.jpg');
              }
            }
            
            // Create signed URL (valid for 1 hour)
            // Supabase Storage signed URL endpoint format
            const filePath = encodeURIComponent(thumbPath || screenshot.storage_path);
            const signedUrlResponse = await fetch(
              `${supabaseConfig.url}/storage/v1/object/sign/screenshots/${filePath}`,
              {
                method: 'POST',
                headers: {
                  'apikey': supabaseConfig.serviceRoleKey,
                  'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  expiresIn: 3600 // 1 hour
                })
              }
            );
            
            if (signedUrlResponse.ok) {
              const signedData = await signedUrlResponse.json();
              // Supabase returns signedURL as a path, need to prepend the base URL
              if (signedData.signedURL) {
                screenshotWithUrl.signed_thumbnail_url = `${supabaseConfig.url}${signedData.signedURL}`;
              } else if (signedData.url) {
                screenshotWithUrl.signed_thumbnail_url = signedData.url;
              }
            } else {
              // If signed URL fails, try to use the public URL (might not work for private buckets)
              console.warn('Failed to generate signed URL, status:', signedUrlResponse.status);
            }
          } catch (err) {
            console.error('Error generating signed URL:', err);
            // Fallback to original URL
            screenshotWithUrl.signed_thumbnail_url = screenshot.thumbnail_url;
          }
        }
        
        return screenshotWithUrl;
      })
    );

    // Get total count for pagination
    const countResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/screenshots?user_id=eq.${userId}&deleted_at=is.null&select=id`,
      {
        method: 'HEAD',
        headers: {
          'apikey': supabaseConfig.serviceRoleKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Prefer': 'count=exact'
        }
      }
    );

    const totalCount = parseInt(countResponse.headers.get('content-range')?.split('/')[1] || '0', 10);

    return {
      success: true,
      data: {
        screenshots: screenshotsWithUrls || [],
        totalCount,
        limit,
        offset
      }
    };
  } catch (error) {
    console.error('Error fetching screenshots:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Resolver for deleting a screenshot
 */
resolver.define('deleteScreenshot', async (req) => {
  const { payload, context } = req;
  const { screenshotId } = payload;
  const accountId = context.accountId;

  try {
    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return {
        success: false,
        error: 'Supabase not configured. Please configure in Settings.'
      };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig);
    if (!userId) {
      return {
        success: false,
        error: 'Unable to get user information'
      };
    }

    // Verify screenshot belongs to user
    const screenshot = await supabaseRequest(
      supabaseConfig,
      `screenshots?id=eq.${screenshotId}&user_id=eq.${userId}&select=id,storage_path`
    );

    if (!screenshot || screenshot.length === 0) {
      return {
        success: false,
        error: 'Screenshot not found or access denied'
      };
    }

    // Soft delete: Update deleted_at timestamp
    await supabaseRequest(
      supabaseConfig,
      `screenshots?id=eq.${screenshotId}`,
      {
        method: 'PATCH',
        body: {
          deleted_at: new Date().toISOString(),
          status: 'deleted'
        }
      }
    );

    // Optionally delete from storage (commented out for now to allow recovery)
    // const storagePath = screenshot[0].storage_path;
    // await fetch(`${supabaseConfig.url}/storage/v1/object/screenshots/${storagePath}`, {
    //   method: 'DELETE',
    //   headers: {
    //     'apikey': supabaseConfig.serviceRoleKey,
    //     'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
    //   }
    // });

    return {
      success: true,
      message: 'Screenshot deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting screenshot:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Resolver for uploading BRD document
 */
resolver.define('uploadBRD', async (req) => {
  const { payload, context } = req;
  const { fileName, fileType, fileData, fileSize } = payload; // fileData is base64
  const accountId = context.accountId;

  try {
    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return {
        success: false,
        error: 'Supabase not configured. Please configure in Settings.'
      };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig);
    if (!userId) {
      return {
        success: false,
        error: 'Unable to get user information'
      };
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!allowedTypes.includes(fileType)) {
      return {
        success: false,
        error: 'Invalid file type. Only PDF and DOCX files are supported.'
      };
    }

    // Convert base64 to Uint8Array (Forge doesn't support Buffer)
    const base64String = fileData.replace(/^data:.*,/, ''); // Remove data URL prefix if present
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const fileExtension = fileType.includes('pdf') ? 'pdf' : 'docx';
    const storagePath = `${userId}/${Date.now()}_${fileName}`;

    // Upload to Supabase Storage
    const uploadResponse = await fetch(
      `${supabaseConfig.url}/storage/v1/object/documents/${storagePath}`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseConfig.serviceRoleKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Content-Type': fileType,
          'x-upsert': 'true'
        },
        body: bytes
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`Failed to upload file: ${error}`);
    }

    const uploadData = await uploadResponse.json();
    const storageUrl = `${supabaseConfig.url}/storage/v1/object/public/documents/${storagePath}`;

    // Save document metadata to database
    const documentRecord = await supabaseRequest(
      supabaseConfig,
      'documents',
      {
        method: 'POST',
        body: {
          user_id: userId,
          file_name: fileName,
          file_type: fileExtension,
          file_size_bytes: fileSize,
          storage_url: storageUrl,
          storage_path: storagePath,
          processing_status: 'uploaded'
        }
      }
    );

    return {
      success: true,
      documentId: documentRecord[0].id,
      message: 'Document uploaded successfully. Processing will begin shortly.'
    };
  } catch (error) {
    console.error('Error uploading BRD:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Resolver for creating Jira issues from BRD
 */
resolver.define('createIssuesFromBRD', async (req) => {
  const { payload, context } = req;
  const { documentId, projectKey } = payload;
  const accountId = context.accountId;

  try {
    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return {
        success: false,
        error: 'Supabase not configured. Please configure in Settings.'
      };
    }

    // Fetch processed BRD data from Supabase
    const documents = await supabaseRequest(
      supabaseConfig,
      `documents?id=eq.${documentId}&select=*`
    );

    if (!documents || documents.length === 0) {
      return {
        success: false,
        error: 'Document not found'
      };
    }

    const document = documents[0];

    if (document.processing_status !== 'completed') {
      return {
        success: false,
        error: `Document is still processing. Current status: ${document.processing_status}`
      };
    }

    if (!document.parsed_requirements) {
      return {
        success: false,
        error: 'Document has not been parsed yet. Please wait for processing to complete.'
      };
    }

    const requirements = document.parsed_requirements;
    const createdIssues = [];

    // Create Epics first
    if (requirements.epics && Array.isArray(requirements.epics)) {
      for (const epic of requirements.epics) {
        try {
          const epicResponse = await api.asUser().requestJira(
            route`/rest/api/3/issue`,
            {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                fields: {
                  project: { key: projectKey },
                  summary: epic.summary || epic.name,
                  description: epic.description || '',
                  issuetype: { name: 'Epic' },
                  ...(epic.name && { customfield_10011: epic.name }) // Epic Name field
                }
              })
            }
          );

          const epicData = await epicResponse.json();
          createdIssues.push({
            key: epicData.key,
            id: epicData.id,
            type: 'Epic',
            summary: epic.summary || epic.name
          });

          // Create Stories under this Epic
          if (epic.stories && Array.isArray(epic.stories)) {
            for (const story of epic.stories) {
              try {
                const storyResponse = await api.asUser().requestJira(
                  route`/rest/api/3/issue`,
                  {
                    method: 'POST',
                    headers: {
                      'Accept': 'application/json',
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      fields: {
                        project: { key: projectKey },
                        summary: story.summary || story.name,
                        description: story.description || '',
                        issuetype: { name: 'Story' },
                        parent: { key: epicData.key }
                      }
                    })
                  }
                );

                const storyData = await storyResponse.json();
                createdIssues.push({
                  key: storyData.key,
                  id: storyData.id,
                  type: 'Story',
                  summary: story.summary || story.name,
                  parent: epicData.key
                });

                // Create Tasks under this Story
                if (story.tasks && Array.isArray(story.tasks)) {
                  for (const task of story.tasks) {
                    try {
                      const taskResponse = await api.asUser().requestJira(
                        route`/rest/api/3/issue`,
                        {
                          method: 'POST',
                          headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({
                            fields: {
                              project: { key: projectKey },
                              summary: task.summary || task.name,
                              description: task.description || '',
                              issuetype: { name: 'Task' },
                              parent: { key: storyData.key }
                            }
                          })
                        }
                      );

                      const taskData = await taskResponse.json();
                      createdIssues.push({
                        key: taskData.key,
                        id: taskData.id,
                        type: 'Task',
                        summary: task.summary || task.name,
                        parent: storyData.key
                      });
                    } catch (taskError) {
                      console.error('Error creating task:', taskError);
                      createdIssues.push({
                        error: `Failed to create task: ${task.summary || task.name}`,
                        details: taskError.message
                      });
                    }
                  }
                }
              } catch (storyError) {
                console.error('Error creating story:', storyError);
                createdIssues.push({
                  error: `Failed to create story: ${story.summary || story.name}`,
                  details: storyError.message
                });
              }
            }
          }
        } catch (epicError) {
          console.error('Error creating epic:', epicError);
          createdIssues.push({
            error: `Failed to create epic: ${epic.summary || epic.name}`,
            details: epicError.message
          });
        }
      }
    }

    // Update document with created issues
    await supabaseRequest(
      supabaseConfig,
      `documents?id=eq.${documentId}`,
      {
        method: 'PATCH',
        body: {
          created_issues: createdIssues,
          project_key: projectKey
        }
      }
    );

    return {
      success: true,
      createdIssues,
      message: `Successfully created ${createdIssues.filter(i => i.key).length} issues`
    };
  } catch (error) {
    console.error('Error creating issues from BRD:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Resolver for creating worklog entries
 */
resolver.define('createWorklog', async (req) => {
  const { payload } = req;
  const { issueKey, timeSpentSeconds, startedAt } = payload;

  try {
    const response = await api.asUser().requestJira(
      route`/rest/api/3/issue/${issueKey}/worklog`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timeSpentSeconds,
          started: startedAt
        })
      }
    );

    const data = await response.json();

    return {
      success: true,
      worklog: data
    };
  } catch (error) {
    console.error('Error creating worklog:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Resolver for getting user settings
 */
resolver.define('getSettings', async (req) => {
  const { context } = req;
  const accountId = context.accountId;

  try {
    const settings = await storage.get(`${accountId}:settings`);
    
    return {
      success: true,
      settings: settings || {
        supabaseUrl: '',
        supabaseAnonKey: '',
        supabaseServiceRoleKey: '',
        screenshotInterval: 300, // 5 minutes default
        autoWorklogEnabled: true,
        aiServerUrl: ''
      }
    };
  } catch (error) {
    console.error('Error getting settings:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Resolver for saving user settings
 */
resolver.define('saveSettings', async (req) => {
  const { payload, context } = req;
  const { settings } = payload;
  const accountId = context.accountId;

  try {
    // Validate required settings
    if (settings.supabaseUrl && !settings.supabaseUrl.startsWith('https://')) {
      return {
        success: false,
        error: 'Supabase URL must start with https://'
      };
    }

    // Store settings in Forge storage
    await storage.set(`${accountId}:settings`, {
      supabaseUrl: settings.supabaseUrl || '',
      supabaseAnonKey: settings.supabaseAnonKey || '',
      supabaseServiceRoleKey: settings.supabaseServiceRoleKey || '',
      screenshotInterval: settings.screenshotInterval || 300,
      autoWorklogEnabled: settings.autoWorklogEnabled !== undefined ? settings.autoWorklogEnabled : true,
      aiServerUrl: settings.aiServerUrl || ''
    });

    return {
      success: true,
      message: 'Settings saved successfully'
    };
  } catch (error) {
    console.error('Error saving settings:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Resolver for getting BRD document status and created issues
 */
resolver.define('getBRDStatus', async (req) => {
  const { payload, context } = req;
  const { documentId } = payload;
  const accountId = context.accountId;

  try {
    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return {
        success: false,
        error: 'Supabase not configured. Please configure in Settings.'
      };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig);
    if (!userId) {
      return {
        success: false,
        error: 'Unable to get user information'
      };
    }

    const documents = await supabaseRequest(
      supabaseConfig,
      `documents?id=eq.${documentId}&user_id=eq.${userId}&select=*`
    );

    if (!documents || documents.length === 0) {
      return {
        success: false,
        error: 'Document not found'
      };
    }

    return {
      success: true,
      document: documents[0]
    };
  } catch (error) {
    console.error('Error getting BRD status:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

export const handler = resolver.getDefinitions();

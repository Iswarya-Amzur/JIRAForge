const { createClient } = require('@supabase/supabase-js');

class SupabaseClient {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.userId = null;
  }

  /**
   * Set the user session using JWT token
   */
  async setSession(jwt) {
    if (!jwt) {
      throw new Error('No JWT token provided');
    }

    const { data, error } = await this.supabase.auth.setSession({
      access_token: jwt,
      refresh_token: ''
    });

    if (error) {
      throw error;
    }

    // Get user ID for folder structure
    await this.fetchUserId();

    return data;
  }

  /**
   * Get the current user's internal ID from the users table
   */
  async fetchUserId() {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();

      if (!user) {
        throw new Error('No authenticated user');
      }

      // Get the user's internal ID from the users table
      const { data, error } = await this.supabase
        .from('users')
        .select('id')
        .eq('supabase_user_id', user.id)
        .single();

      if (error) {
        throw error;
      }

      this.userId = data.id;
      return data.id;
    } catch (error) {
      console.error('Error fetching user ID:', error);
      throw error;
    }
  }

  /**
   * Get user ID (cached)
   */
  async getUserId() {
    if (!this.userId) {
      await this.fetchUserId();
    }
    return this.userId;
  }

  /**
   * Upload screenshot to Supabase Storage
   */
  async uploadScreenshot(filePath, buffer, contentType) {
    try {
      const { data, error } = await this.supabase.storage
        .from('screenshots')
        .upload(filePath, buffer, {
          contentType,
          upsert: false
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = this.supabase.storage
        .from('screenshots')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading screenshot:', error);
      throw error;
    }
  }

  /**
   * Save screenshot metadata to database
   */
  async saveScreenshotMetadata(metadata) {
    try {
      const userId = await this.getUserId();

      const { data, error } = await this.supabase
        .from('screenshots')
        .insert({
          user_id: userId,
          ...metadata
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error saving screenshot metadata:', error);
      throw error;
    }
  }

  /**
   * Get user's screenshots
   */
  async getScreenshots(limit = 50, offset = 0) {
    try {
      const userId = await this.getUserId();

      const { data, error } = await this.supabase
        .from('screenshots')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching screenshots:', error);
      throw error;
    }
  }

  /**
   * Delete a screenshot
   */
  async deleteScreenshot(screenshotId) {
    try {
      // First, get the screenshot to get the storage path
      const { data: screenshot, error: fetchError } = await this.supabase
        .from('screenshots')
        .select('storage_path, thumbnail_url')
        .eq('id', screenshotId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Delete from storage
      const { error: storageError } = await this.supabase.storage
        .from('screenshots')
        .remove([screenshot.storage_path]);

      if (storageError) {
        console.error('Error deleting from storage:', storageError);
      }

      // Mark as deleted in database (soft delete)
      const { error: dbError } = await this.supabase
        .from('screenshots')
        .update({
          status: 'deleted',
          deleted_at: new Date().toISOString()
        })
        .eq('id', screenshotId);

      if (dbError) {
        throw dbError;
      }

      return true;
    } catch (error) {
      console.error('Error deleting screenshot:', error);
      throw error;
    }
  }

  /**
   * Get time analytics for the user
   */
  async getTimeAnalytics(startDate, endDate) {
    try {
      const userId = await this.getUserId();

      // Get daily summary
      const { data: dailySummary, error: dailyError } = await this.supabase
        .from('daily_time_summary')
        .select('*')
        .eq('user_id', userId)
        .gte('work_date', startDate)
        .lte('work_date', endDate);

      if (dailyError) {
        throw dailyError;
      }

      // Get project summary
      const { data: projectSummary, error: projectError } = await this.supabase
        .from('project_time_summary')
        .select('*')
        .eq('user_id', userId);

      if (projectError) {
        throw projectError;
      }

      return {
        dailySummary,
        projectSummary
      };
    } catch (error) {
      console.error('Error fetching time analytics:', error);
      throw error;
    }
  }

  /**
   * Upload BRD document
   */
  async uploadDocument(filePath, buffer, fileName, fileType) {
    try {
      const userId = await this.getUserId();

      // Upload to storage
      const storagePath = `${userId}/${fileName}`;

      const { data: storageData, error: storageError } = await this.supabase.storage
        .from('documents')
        .upload(storagePath, buffer, {
          contentType: fileType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: false
        });

      if (storageError) {
        throw storageError;
      }

      // Get public URL
      const { data: { publicUrl } } = this.supabase.storage
        .from('documents')
        .getPublicUrl(storagePath);

      // Save metadata to database
      const { data: docData, error: docError } = await this.supabase
        .from('documents')
        .insert({
          user_id: userId,
          file_name: fileName,
          file_type: fileType,
          file_size_bytes: buffer.length,
          storage_url: publicUrl,
          storage_path: storagePath,
          processing_status: 'uploaded'
        })
        .select()
        .single();

      if (docError) {
        throw docError;
      }

      return docData;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }
}

module.exports = SupabaseClient;

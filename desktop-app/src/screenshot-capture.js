const screenshot = require('screenshot-desktop');
const sharp = require('sharp');
const path = require('path');
const { app } = require('electron');
const activeWin = require('active-win');
const fs = require('fs').promises;

class ScreenshotCapture {
  constructor(interval, supabaseClient, store) {
    this.interval = interval;
    this.supabaseClient = supabaseClient;
    this.store = store;
    this.intervalId = null;
    this.isCapturing = false;
  }

  async start() {
    if (this.intervalId) {
      console.log('Screenshot capture already running');
      return;
    }

    console.log(`Starting screenshot capture every ${this.interval / 1000} seconds`);

    // Take first screenshot immediately
    await this.captureAndUpload();

    // Then capture at regular intervals
    this.intervalId = setInterval(() => {
      this.captureAndUpload();
    }, this.interval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Screenshot capture stopped');
    }
  }

  async captureAndUpload() {
    if (this.isCapturing) {
      console.log('Already capturing, skipping this interval');
      return;
    }

    this.isCapturing = true;

    try {
      // Get active window information
      const activeWindow = await this.getActiveWindow();

      // Capture screenshot
      const screenshotBuffer = await screenshot({ format: 'png' });

      // Generate thumbnail
      const thumbnailBuffer = await sharp(screenshotBuffer)
        .resize(400, 300, { fit: 'inside' })
        .jpeg({ quality: 70 })
        .toBuffer();

      // Get file size
      const fileSize = screenshotBuffer.length;

      // Create filename with timestamp
      const timestamp = new Date().toISOString();
      const filename = `screenshot_${Date.now()}.png`;
      const thumbnailFilename = `thumb_${Date.now()}.jpg`;

      // Upload to Supabase
      const userId = await this.supabaseClient.getUserId();
      const screenshotPath = `${userId}/${filename}`;
      const thumbnailPath = `${userId}/${thumbnailFilename}`;

      // Upload screenshot
      const screenshotUrl = await this.supabaseClient.uploadScreenshot(
        screenshotPath,
        screenshotBuffer,
        'image/png'
      );

      // Upload thumbnail
      const thumbnailUrl = await this.supabaseClient.uploadScreenshot(
        thumbnailPath,
        thumbnailBuffer,
        'image/jpeg'
      );

      // Save metadata to database
      await this.supabaseClient.saveScreenshotMetadata({
        timestamp,
        storage_url: screenshotUrl,
        storage_path: screenshotPath,
        thumbnail_url: thumbnailUrl,
        window_title: activeWindow.title,
        application_name: activeWindow.appName,
        file_size_bytes: fileSize,
        status: 'pending'
      });

      console.log('Screenshot captured and uploaded:', filename);
    } catch (error) {
      console.error('Error capturing screenshot:', error);
    } finally {
      this.isCapturing = false;
    }
  }

  async getActiveWindow() {
    try {
      const win = await activeWin();
      return {
        title: win?.title || 'Unknown',
        appName: win?.owner?.name || 'Unknown'
      };
    } catch (error) {
      console.error('Error getting active window:', error);
      return {
        title: 'Unknown',
        appName: 'Unknown'
      };
    }
  }
}

module.exports = ScreenshotCapture;

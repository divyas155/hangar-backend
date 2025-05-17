const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { uploadAdminFile } = require('../config/googleDrive');
const File = require('../models/File');
const { auth, isAdmin } = require('../middleware/auth');
const { deleteDriveFile } = require('../config/googleDrive');
const router = express.Router();

// Temp file upload destination
const upload = multer({ dest: path.join(__dirname, '..', 'temp') });

// 📁 Folder ID in Google Drive for admin-uploaded files
const ADMIN_UPLOAD_FOLDER_ID = '1Y2VaRHfN7iw27jcL29AjCzXMrI4jct7C';

// 📤 POST /files/upload - Admin uploads a file
router.post('/upload', auth, isAdmin, upload.single('file'), async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || !req.file) {
      return res.status(400).json({ message: 'Title and file are required' });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;
    const originalName = req.file.originalname;

    const driveUpload = await uploadAdminFile(
      filePath,
      originalName,
      mimeType,
      ADMIN_UPLOAD_FOLDER_ID
    );

    fs.unlinkSync(filePath); // Clean up temp file

    const newFile = new File({
      title,
      driveId: driveUpload.driveId,
      mimeType,
    });

    await newFile.save();

    res.status(200).json({
      message: 'File uploaded successfully',
      file: {
        title,
        driveId: driveUpload.driveId,
        mimeType,
        downloadUrl: driveUpload.downloadUrl,
      }
    });
  } catch (err) {
    console.error('❌ File upload failed:', err);
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

// 📄 GET /files - Get all uploaded files
router.get('/', auth, async (req, res) => {
  try {
    const files = await File.find().sort({ uploadedAt: -1 });
    res.json(files);
  } catch (err) {
    console.error('❌ Failed to fetch files:', err);
    res.status(500).json({ message: 'Error fetching files' });
  }
});



// 🗑️ DELETE /files/drive/:driveId - Admin deletes file from Google Drive + DB
router.delete('/drive/:driveId', auth, isAdmin, async (req, res) => {
  try {
    const file = await File.findOne({ driveId: req.params.driveId });

    if (!file) {
      return res.status(404).json({ message: 'File not found in DB' });
    }

    await deleteDriveFile(req.params.driveId); // Delete from Google Drive
    await file.deleteOne();                    // Delete from MongoDB

    res.status(200).json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error('❌ Deletion error:', err);
    res.status(500).json({ message: 'File deletion failed', error: err.message });
  }
});


module.exports = router;

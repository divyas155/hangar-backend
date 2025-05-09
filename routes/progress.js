const express = require('express');
const router = express.Router();
const multer = require('multer');
const Progress = require('../models/Progress');
const {
  auth,
  isSiteEngineer,
  isViewer,
  isAdmin
} = require('../middleware/auth');
const { uploadFile, getDriveFileStream } = require('../config/googleDrive');

const upload = multer();
const MAX_ZIP_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

// Helper: zip files in-memory and upload to Drive
async function createZipAndUpload(files, date) {
  const photos = files.photos || [];
  const videoFiles = files.video || [];
  const allFiles = [...photos, ...videoFiles];

  if (allFiles.length === 0) {
    throw new Error('At least one file is required to create a ZIP.');
  }

  const safeDate = date.replace(/:/g, '-');
  const filename = `progress_${safeDate}.zip`;

  return new Promise((resolve, reject) => {
    const archiver = require('archiver');
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks = [];

    archive.on('data', chunk => chunks.push(chunk));
    archive.on('error', err => reject(err));
    archive.on('end', async () => {
      try {
        const zipBuffer = Buffer.concat(chunks);
        if (zipBuffer.length > MAX_ZIP_SIZE_BYTES) {
          return reject(new Error(
            `ZIP size ${Math.round(zipBuffer.length / (1024 * 1024))}MB exceeds limit of ${MAX_ZIP_SIZE_BYTES / (1024 * 1024)}MB`
          ));
        }

        const tmpPath = path.join(os.tmpdir(), filename);
        fs.writeFileSync(tmpPath, zipBuffer);

        const fileMeta = await uploadFile(tmpPath, filename, 'application/zip');
        fs.unlinkSync(tmpPath);

        resolve({
          driveId:  fileMeta.id || fileMeta.fileId,
          url:      fileMeta.webViewLink,
          mimeType: 'application/zip',
          filename
        });
      } catch (e) {
        reject(e);
      }
    });

    allFiles.forEach(file => archive.append(file.buffer, { name: file.originalname }));
    archive.finalize();
  });
}

// 🧱 Create a progress update (Site Engineer only)
router.post(
  '/',
  auth,
  isSiteEngineer,
  upload.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'video',  maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { date, description } = req.body;
      if (!date) {
        return res.status(400).json({ message: 'A date is required.' });
      }
      if (!description) {
        return res.status(400).json({ message: 'A description is required.' });
      }

      const zipMeta = await createZipAndUpload(req.files, date);
      const progress = new Progress({
        date,
        description,
        zip:        zipMeta,
        uploadedBy: req.user._id,
        status:     'pending'
      });

      await progress.save();
      return res.status(201).json(progress);
    } catch (error) {
      console.error('❌ Error creating progress:', error);
      return res.status(500).json({ message: error.message });
    }
  }
);

// 🔎 Get progress updates (role-based filtering)
router.get('/', auth, async (req, res) => {
  try {
    const query = {};
    if (req.user.role === 'viewer') {
      query.status = 'approved';
    }
    if (req.user.role === 'site_engineer') {
      query.uploadedBy = req.user._id;
    }

    const list = await Progress.find(query)
      .populate('uploadedBy', 'username')
      .populate('approvedBy', 'username')
      .sort({ date: -1 });

    return res.json(list);
  } catch (error) {
    console.error('❌ Get progress error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Approve/reject progress (Admin only)
router.patch('/:id/approve', auth, isAdmin, async (req, res) => {
  try {
    const { status, comments } = req.body;
    const progress = await Progress.findById(req.params.id);
    if (!progress) {
      return res.status(404).json({ message: 'Progress update not found' });
    }

    progress.status     = status;
    progress.approvedBy = req.user._id;
    progress.approvedAt = new Date();
    if (comments) {
      progress.comments.push({ text: comments, user: req.user._id, createdAt: new Date() });
    }

    await progress.save();
    return res.json(progress);
  } catch (error) {
    console.error('❌ Approve progress error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 💬 Add comment to a progress record (any authenticated user)
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const progress = await Progress.findById(req.params.id);
    if (!progress) {
      return res.status(404).json({ message: 'Progress update not found' });
    }

    progress.comments.push({ text, user: req.user._id, createdAt: new Date() });
    await progress.save();
    return res.json(progress);
  } catch (error) {
    console.error('❌ Add comment error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 📥 Download all approved photos/videos as a ZIP (Viewer & Admin)
router.get(
  '/:id/download',
  auth,
  (req, res, next) => {
    if (req.user.role === 'viewer' || req.user.role === 'admin') return next();
    return res.status(403).json({ message: 'Forbidden' });
  },
  async (req, res) => {
    try {
      const progress = await Progress.findById(req.params.id);
      if (!progress || progress.status !== 'approved') {
        return res.status(404).json({ message: 'Progress not found or not approved' });
      }

      const stream = await getDriveFileStream(progress.zip.driveId);
      res.setHeader('Content-Disposition', `attachment; filename="${progress.zip.filename}"`);
      res.setHeader('Content-Type', progress.zip.mimeType);
      return stream.pipe(res);
    } catch (err) {
      console.error('❌ Download progress ZIP error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const archiver = require('archiver');
const PDFDocument = require('pdfkit');
const Progress = require('../models/Progress');
const {
  auth,
  isSiteEngineer,
  isViewer,
  isAdmin
} = require('../middleware/auth');
const { uploadFile, getDriveFileStream } = require('../config/googleDrive');

const router = express.Router();
const upload = multer().fields([
  { name: 'photos', maxCount: 10 },
  { name: 'video', maxCount: 1 }
]);

const MAX_ZIP_SIZE_BYTES = 100 * 1024 * 1024;

// 🛠️ Helper: Zip and upload files to Drive
async function createZipAndUpload(files, date) {
  const photos = files?.photos || [];
  const videos = files?.video || [];
  const allFiles = [...photos, ...videos];

  if (allFiles.length === 0) return null;

  const safeDate = date.replace(/:/g, '-');
  const filename = `progress_${safeDate}.zip`;

  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks = [];

    archive.on('data', chunk => chunks.push(chunk));
    archive.on('error', err => reject(err));

    archive.on('end', async () => {
      try {
        const zipBuffer = Buffer.concat(chunks);

        if (zipBuffer.length > MAX_ZIP_SIZE_BYTES) {
          return reject(new Error(`ZIP exceeds 100MB limit.`));
        }

        const tmpPath = path.join(os.tmpdir(), filename);
        fs.writeFileSync(tmpPath, zipBuffer);

        const fileMeta = await uploadFile(tmpPath, filename, 'application/zip');
        fs.unlinkSync(tmpPath);

        resolve({
          driveId: fileMeta.id || fileMeta.fileId,
          url: fileMeta.webViewLink,
          mimeType: 'application/zip',
          filename
        });
      } catch (err) {
        reject(err);
      }
    });

    allFiles.forEach(file => archive.append(file.buffer, { name: file.originalname }));
    archive.finalize();
  });
}

// 🧱 POST /progress - Create progress (Site Engineer)
router.post('/', auth, isSiteEngineer, upload, async (req, res) => {
  try {
    const { date, description } = req.body;

    if (!date || !description) {
      return res.status(400).json({ message: 'Date and description are required.' });
    }

    // ✅ Generate new sequential progressID (Progress#1, Progress#2, ...)
    const latestProgress = await Progress.findOne().sort({ createdAt: -1 });
    let nextProgressNumber = 1;

    if (latestProgress && latestProgress.progressID) {
      const match = latestProgress.progressID.match(/Progress#(\d+)/);
      if (match) {
        nextProgressNumber = parseInt(match[1], 10) + 1;
      }
    }

    const newProgressID = `Progress#${nextProgressNumber}`;

    // 📦 Upload ZIP archive
    const zipMeta = await createZipAndUpload(req.files || {}, date);

    // 📝 Create new progress entry
    const progress = new Progress({
      progressID: newProgressID,
      date,
      description,
      zip: zipMeta,
      uploadedBy: req.user._id,
      status: 'pending'
    });

    await progress.save();
    return res.status(201).json(progress);
  } catch (error) {
    console.error('❌ Create progress error:', error);
    return res.status(500).json({ message: error.message });
  }
});


// 🔍 GET /progress - Get progress list (Role-based filtering)
router.get('/', auth, async (req, res) => {
  try {
    const query = {};

    // Role-based filtering
    if (req.user.role === 'viewer') {
      query.status = 'approved';
    }
    if (req.user.role === 'site_engineer') {
      query.uploadedBy = req.user._id;
    }

    // ✅ Date range filter (missing earlier)
    if (req.query.startDate && req.query.endDate) {
      const start = new Date(req.query.startDate);
      const end = new Date(req.query.endDate);
      query.date = { $gte: start, $lte: end };
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


// ✅ PATCH /progress/:id/approve - Approve/Reject (Admin only)
router.patch('/:id/approve', auth, isAdmin, async (req, res) => {
  try {
    const { status, comments } = req.body;
    const progress = await Progress.findById(req.params.id);

    if (!progress) {
      return res.status(404).json({ message: 'Progress update not found' });
    }

    progress.status = status;
    progress.approvedBy = req.user._id;
    progress.approvedAt = new Date();

    if (comments) {
      progress.comments.push({
        text: comments,
        user: req.user._id,
        createdAt: new Date()
      });
    }

    await progress.save();
    return res.json(progress);
  } catch (error) {
    console.error('❌ Approve progress error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 💬 POST /progress/:id/comments - Add comment (Any authenticated user)
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const progress = await Progress.findById(req.params.id);

    if (!progress) {
      return res.status(404).json({ message: 'Progress update not found' });
    }

    progress.comments.push({
      text,
      user: req.user._id,
      createdAt: new Date()
    });

    await progress.save();
    return res.json(progress);
  } catch (error) {
    console.error('❌ Add comment error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 📄 GET /progress/pdf-range - Generate Progress Report PDF
router.get('/pdf-range', auth, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ message: 'Start and end dates are required' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const progresses = await Progress.find({
      date: { $gte: startDate, $lte: endDate },
      status: 'approved'
    }).sort({ date: 1 });

    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="progress_report_${start}_to_${end}.pdf"`
    );

    doc.pipe(res);

    const logoPath = path.join(__dirname, '..', 'assets', 'images', 'unit-logo.jpeg');
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    const drawFadedWatermark = () => {
      doc.save();
      doc.opacity(0.09);
      doc.image(logoPath, pageWidth / 2 - 150, pageHeight / 2 - 150, { width: 300 });
      doc.restore();
    };

    const formatDate = (d) =>
      new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });

    const sanitizeText = (text) => {
      if (!text || typeof text !== 'string') return '-';
      return text.replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, ' ').trim();
    };

    const getUploaderName = (uploader) => {
      if (!uploader) return '-';
      if (typeof uploader === 'string') return uploader;
      if (typeof uploader === 'object') {
        return uploader.name || uploader.email || '-';
      }
      return '-';
    };

    drawFadedWatermark();

    // Heading
    doc.font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('blue')
      .text('Iruvade Project Management: Progress Report', {
        align: 'center',
        underline: true
      });

    doc.moveDown(0.5)
      .fontSize(12)
      .fillColor('black')
      .text(`Duration: ${formatDate(startDate)} to ${formatDate(endDate)}`, { align: 'center' });

    doc.moveDown(1);

    for (let i = 0; i < progresses.length; i++) {
      const p = progresses[i];

      if (i !== 0 && i % 20 === 0) {
        doc.addPage();
        drawFadedWatermark();
      }

      doc.fontSize(12)
        .fillColor('#000')
        .text(`• Progress ID: ${p.progressID || p._id}`)
        .text(`  Date: ${formatDate(p.date)}`)
        .text(`  Description: ${sanitizeText(p.description)}`)
        .text(`  Uploaded by: ${getUploaderName(p.uploader)}`)
        .text(`  Status: ${p.status}`)
        .moveDown(0.5);
    }

    doc.moveDown(1)
      .fontSize(14)
      .fillColor('#000')
      .text('Summary', { underline: true });

    doc.fontSize(12)
      .text(`Total Approved Progress Updates: ${progresses.length} (From ${formatDate(startDate)} to ${formatDate(endDate)})`)
      .moveDown(2);

    drawFadedWatermark();

    doc.fontSize(10)
      .fillColor('#666')
      .font('Helvetica-Oblique')
      .text(
        'This is a system-generated report and does not require signatures.',
        50,
        doc.y + 10,
        { align: 'center', width: pageWidth - 100 }
      );

    doc.fontSize(9)
      .fillColor('#999')
      .font('Helvetica')
      .text(
        '© Copyrights reserved with Vijay Kumar Sharma',
        50,
        doc.y + 15,
        { align: 'center', width: pageWidth - 100 }
      );

    doc.end();
  } catch (err) {
    console.error('❌ PDF generation error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
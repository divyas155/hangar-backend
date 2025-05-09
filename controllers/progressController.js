const Progress = require('../models/Progress');
const drive    = require('../config/googleDrive');
const archiver = require('archiver');
const fs       = require('fs');
const os       = require('os');
const path     = require('path');

const MAX_PHOTOS = 10;
const MAX_ZIP_MB  = 100;

// Helper: zip files → Drive → return fileMeta
async function zipAndUpload(files, date) {
  console.log('DEBUG in helper, received date:', date);
  const photos = files.photos || [];
  if (photos.length > MAX_PHOTOS) {
    throw new Error(`Max ${MAX_PHOTOS} photos allowed`);
  }

  const safeDate = date.replace(/:/g, '-');
  const zipName  = `progress_${safeDate}.zip`;

  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks  = [];

    archive.on('data',   c => chunks.push(c));
    archive.on('error',  reject);
    archive.on('end', async () => {
      try {
        const buf = Buffer.concat(chunks);
        if (buf.length > MAX_ZIP_MB * 1024 * 1024) {
          return reject(new Error(`ZIP exceeds ${MAX_ZIP_MB}MB`));
        }

        const tmpPath = path.join(os.tmpdir(), zipName);
        fs.writeFileSync(tmpPath, buf);

        const meta = await drive.uploadFile(tmpPath, zipName, 'application/zip');
        fs.unlinkSync(tmpPath);

        resolve({
          driveId:  meta.id || meta.fileId,
          url:      meta.webViewLink,
          mimeType: 'application/zip',
          filename: zipName
        });
      } catch (err) {
        reject(err);
      }
    });

    files.photos?.forEach(f => archive.append(f.buffer, { name: f.originalname }));
    files.video?.forEach(f => archive.append(f.buffer, { name: f.originalname }));
    archive.finalize();
  });
}

exports.createProgress = async (req, res) => {
  try {
    const { date, description } = req.body;
    if (!date)        throw new Error('A date is required.');
    if (!description) throw new Error('A description is required.');

    const zipMeta = await zipAndUpload(req.files, date);

    const prog = await Progress.create({
      date,
      description,
      zip:        zipMeta,
      uploadedBy: req.user._id,
      status:     'pending'
    });

    return res.status(201).json(prog);
  } catch (e) {
    console.error('❌ createProgress error:', e);
    return res.status(400).json({ message: e.message });
  }
};

exports.approveProgress = async (req, res) => {
  try {
    const prog = await Progress.findById(req.params.id);
    if (!prog) {
      return res.status(404).json({ message: 'Progress update not found' });
    }

    prog.status     = 'approved';
    prog.approvedBy = req.user._id;
    prog.approvedAt = new Date();
    await prog.save();

    return res.json(prog);
  } catch (e) {
    console.error('❌ approveProgress error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.updateDescription = async (req, res) => {
  try {
    const { description } = req.body;
    const prog = await Progress.findByIdAndUpdate(
      req.params.id,
      { description },
      { new: true }
    );
    if (!prog) {
      return res.status(404).json({ message: 'Progress update not found' });
    }
    return res.json(prog);
  } catch (e) {
    console.error('❌ updateDescription error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.listProgress = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'viewer') {
      filter.status = 'approved';
    }

    const list = await Progress.find(filter)
      .sort({ date: -1 })
      .populate('uploadedBy', 'username')
      .populate('approvedBy', 'username');

    return res.json(list);
  } catch (e) {
    console.error('❌ listProgress error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
};

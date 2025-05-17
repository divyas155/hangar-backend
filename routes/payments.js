const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const PDFDocument = require('pdfkit');  // ✅ For PDF generation
const path = require('path');           // ✅ For resolving logo path

const {
  auth,
  isPayingAuthority,
  isViewer,
  isAdmin
} = require('../middleware/auth');

// 🧾 Create a payment record (Paying Authority only)
router.post('/', auth, isPayingAuthority, async (req, res) => {
  try {
    const { paymentID, date, amount, description, remarks } = req.body;

    if (!paymentID) {
      return res.status(400).json({ message: 'paymentID is required' });
    }

    const payment = new Payment({
      paymentID,
      date,
      amount,
      description,
      remarks,
      createdBy: req.user._id,
      status: 'pending'
    });

    await payment.save();
    return res.status(201).json(payment);
  } catch (error) {
    console.error('❌ Create Payment Error:', error);
    if (error.code === 11000 && error.keyPattern?.paymentID) {
      return res.status(400).json({ message: 'paymentID must be unique' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

// 🔍 Get all payments (filter by role and optional status/date)
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const query = {};

    if (req.user.role === 'paying_authority') {
      query.createdBy = req.user._id;
    } else if (req.user.role === 'admin') {
      query.status = status ? status.toLowerCase() : 'pending';
    } else {
      query.status = 'approved';
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const payments = await Payment.find(query)
      .populate('createdBy', 'username')
      .populate('approvedBy', 'username')
      .sort({ date: -1 });

    return res.json(payments);
  } catch (error) {
    console.error('❌ Get Payments Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Approve or reject by business paymentID (Admin only)
router.patch('/by-payment-id/:paymentID/approve', auth, isAdmin, async (req, res) => {
  try {
    const { paymentID } = req.params;
    const { status, comments } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const payment = await Payment.findOne({ paymentID });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    payment.status = status;
    payment.approvedBy = req.user._id;
    payment.approvedAt = new Date();

    if (comments) {
      payment.comments = payment.comments || [];
      payment.comments.push({
        text: comments,
        user: req.user._id,
        createdAt: new Date()
      });
    }

    await payment.save();
    return res.json({ message: `Payment ${status} via paymentID`, payment });
  } catch (error) {
    console.error('❌ Approve by paymentID error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 💬 Add a comment to payment
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found' });
    }

    payment.comments = payment.comments || [];
    payment.comments.push({
      text,
      user: req.user._id,
      createdAt: new Date()
    });

    await payment.save();
    return res.json(payment);
  } catch (error) {
    console.error('❌ Add Comment Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 🗑️ Delete payment (only if still pending)
router.delete('/:id', auth, isPayingAuthority, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending payments can be deleted' });
    }

    await Payment.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Payment deleted successfully' });
  } catch (err) {
    console.error('❌ deletePayment error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/// 📄 PDF Report Download with Watermark and Summary
router.get('/pdf-range', auth, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ message: 'Start and end dates are required' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const payments = await Payment.find({
      date: { $gte: startDate, $lte: endDate },
      status: 'approved'
    }).sort({ date: 1 });

    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payment_report_${start}_to_${end}.pdf"`);

    doc.pipe(res);

    const logoPath = path.join(__dirname, '..', 'assets', 'images', 'unit-logo.jpeg');
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    const drawWatermarkBehind = () => {
      doc.save();
      doc.opacity(0.05);
      doc.image(logoPath, pageWidth / 2 - 150, pageHeight / 2 - 150, { width: 300 });
      doc.restore();
    };

    const formatDate = (d) =>
      new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });

    // ✅ Draw watermark behind heading
    drawWatermarkBehind();

    // ✅ Heading with underline and blue color
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('blue')
      .text('Iruvade Project Management: Payment Report', {
        align: 'center',
        underline: true
      });

    doc.moveDown(0.5)
      .fontSize(12)
      .fillColor('black')
      .text(`Duration: ${formatDate(startDate)} to ${formatDate(endDate)}`, { align: 'center' });

    doc.moveDown(1);

    let totalAmount = 0;

    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];

      if (i !== 0 && i % 20 === 0) {
        doc.addPage();
        drawWatermarkBehind();
      }

      const formattedAmount = parseFloat(p.amount).toFixed(2);

      doc
        .fontSize(12)
        .fillColor('#000')
        .text(`• Payment ID: ${p.paymentID}`)
        .text(`  Date: ${formatDate(p.date)}`)
        .text(`  Amount: Rs ${formattedAmount}`)
        .text(`  Description: ${p.description || '-'}`)
        .text(`  Remarks: ${p.remarks || '-'}`)
        .moveDown(0.5);

      totalAmount += parseFloat(p.amount);
    }

    doc.moveDown(1)
      .fontSize(14)
      .fillColor('#000')
      .text('Summary', { underline: true });

    // ✅ Updated summary with "Rs xxxx.00"
    doc.fontSize(12)
      .text(`Total Payment: Rs ${totalAmount.toFixed(2)} (From ${formatDate(startDate)} to ${formatDate(endDate)})`)
      .moveDown(2);

    // Final watermark (in case summary caused new page)
    drawWatermarkBehind();

    // ✅ Footer only on final page, at bottom of content
    doc
      .fontSize(10)
      .fillColor('#666')
      .font('Helvetica-Oblique')
      .text(
        'This is a system-generated report and does not require signatures.',
        50,
        doc.y + 10,
        { align: 'center', width: pageWidth - 100 }
      );

    doc
      .fontSize(9)
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

const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
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
      status: 'pending' // ✅ default status
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
      query.status = status ? status.toLowerCase() : 'pending'; // ✅ normalize + default
    } else {
      query.status = 'approved'; // Viewers see only approved
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

module.exports = router;

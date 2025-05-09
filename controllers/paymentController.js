// controllers/paymentController.js
const Payment = require('../models/Payment');

exports.createPayment = async (req, res) => {
  try {
    const { paymentID, date, amount, description } = req.body;

    if (!paymentID) {
      return res.status(400).json({ error: 'paymentID is required' });
    }

    const payment = new Payment({
      paymentID,                  // now supplied by the paying authority
      date,
      amount,
      description,
      createdBy: req.user._id
    });

    await payment.save();
    res.status(201).json({ message: 'Payment record created', payment });
  } catch (err) {
    console.error('❌ createPayment error:', err);
    if (err.code === 11000 && err.keyPattern && err.keyPattern.paymentID) {
      // duplicate key error on paymentID
      return res.status(400).json({ error: 'paymentID must be unique' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

exports.approvePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { approved: true },
      { new: true }
    );
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json({ message: 'Payment approved', payment });
  } catch (err) {
    console.error('❌ approvePayment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
exports.deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.approved === true) {
      return res.status(400).json({ message: 'Approved payment cannot be deleted' });
    }

    await Payment.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Payment deleted successfully' });
  } catch (err) {
    console.error('❌ deletePayment error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.getApprovedPayments = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { approved: true };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate)   filter.date.$lte = new Date(endDate);
    }

    const payments = await Payment.find(filter).sort({ date: 1 });
    let cumulative = 0;

    const result = payments.map((p, idx) => {
      cumulative += p.amount;
      return {
        serialNo:    idx + 1,
        date:        p.date,
        paymentID:   p.paymentID,   // now using the authority-supplied ID
        amountPaid:  p.amount,
        totalPaid:   cumulative,
        description: p.description,
        createdBy:   p.createdBy
      };
    });

    res.json(result);
  } catch (err) {
    console.error('❌ getApprovedPayments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

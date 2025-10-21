const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const Order = require('../models/Order');
const authMiddleware = require('../middleware/userAuth');

//Create Razorpay Order
router.post('/create-order', authMiddleware, async (req, res) => { 
  try {
    const { items, totalAmount, address } = req.body;

    const options = {
      amount: totalAmount * 100,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    const newOrder = new Order({
      user: req.user.id,
      items,
      totalAmount,
      paymentMethod: 'razorpay',
      paymentStatus: 'pending',
      razorpayOrderId: order.id,
      address
    });

    await newOrder.save();

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error creating Razorpay order' });
  }
});

//Verify Razorpay Payment
router.post('/verify-payment', authMiddleware, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      const order = await Order.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        {
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          paymentStatus: 'paid',
        },
        { new: true }
      );
      
      if (!order) {
        return res.status(404).json({ success: false, msg: 'Order not found' });
      }

      res.json({ success: true, order });
    } else {
      res.status(400).json({ success: false, msg: 'Payment verification failed' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error verifying payment' });
  }
});

//Cash on Delivery Order
router.post('/cod', authMiddleware, async (req, res) => {
  try {
    const { items, totalAmount, address } = req.body;

    const order = new Order({
      user: req.user.id,
      items,
      totalAmount,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      address
    });

    await order.save();
    res.json({ success: true, order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error placing COD order' });
  }
});

// Get All Orders (for User), excluding pending Razorpay orders
router.get('/my-orders', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user.id,
      $nor: [
        { paymentMethod: 'razorpay', paymentStatus: 'pending' }
      ]
    }).sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error fetching orders' });
  }
});


module.exports = router;
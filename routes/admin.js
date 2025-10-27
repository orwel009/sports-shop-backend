const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const orders = await Order.find();
    const products = await Product.find();

    // Total Sales (only paid)
    const totalSales = orders
      .filter(order => order.paymentStatus === 'paid')
      .reduce((acc, order) => acc + order.totalAmount, 0);

    // Total Orders
    const totalOrders = orders.length;

    // Pending Orders
    const pendingOrders = orders.filter(o => o.status === 'processing').length;

    // Orders by Status
    const statusCounts = {
      processing: orders.filter(o => o.status === 'processing').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
    };

    // Best Selling Products
    const productSales = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (!productSales[item.name]) productSales[item.name] = 0;
        productSales[item.name] += item.quantity;
      });
    });

    const bestSelling = Object.entries(productSales)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Revenue by Brand
    const revenueByBrand = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const product = products.find(p => p._id.toString() === item.productId.toString());
        if (product) {
          if (!revenueByBrand[product.brand]) revenueByBrand[product.brand] = 0;
          revenueByBrand[product.brand] += item.price * item.quantity;
        }
      });
    });

    // Sales Over Time (group by month)
    const salesByMonth = {};
    orders.forEach(order => {
      const date = new Date(order.createdAt);
      const month = date.toLocaleString('default', { month: 'short' });
      if (!salesByMonth[month]) salesByMonth[month] = 0;
      salesByMonth[month] += order.totalAmount;
    });

    const salesOverTime = Object.entries(salesByMonth)
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => new Date(`1 ${a.month} 2025`) - new Date(`1 ${b.month} 2025`));

    // Total Users
    const totalUsers = await User.countDocuments();

    res.json({
      stats: {
        totalSales,
        totalOrders,
        pendingOrders,
        totalUsers,
      },
      charts: {
        ordersByStatus: statusCounts,
        bestSelling,
        revenueByBrand,
        salesOverTime,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
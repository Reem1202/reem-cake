const fs = require('fs');
const Admin = require('../models/adminModel');
const Banner = require('../models/bannerModel');
const User = require('../models/userModel');
const Category = require('../models/categoryModel');
const PriceFilter= require('../models/priceFilterModel')
const Product = require('../models/productModel');
const Order = require('../models/orderModel');
const Coupon = require('../models/couponModel');

const adminController = {
  renderLogin: async (req, res) => {
    if (req.session.admin) {
      res.redirect('/admin/dashboard');
    } else {
      const error = req.flash('error');
      res.render('admin/login-ad', { error: error });
    }
  },
  login: async (req, res) => {
    const { email, password } = req.body;
    const adminData = await Admin.findOne({ email: email, password: password });

    if (adminData) {
      console.log('admin dash');
      req.session.admin = true;
      res.redirect('/admin/dashboard');
    } else {
      req.flash('error', 'Incorrect email or password');
      return res.redirect('/admin');
    }
  },
  renderDashboard: async (req, res) => {
    try {
      const admin = req.session.admin;
      const productCount = await Product.count();
      const orderCount = await Order.aggregate([
        { $match: { status: 'delivered' } },
        { $unwind: '$orderDetails' },
        { $count: 'orderDetails' }
      ]);
      const user = await User.aggregate([
        { $match: {} },
        { $group: { _id: '$verified', count: { $sum: 1 } } },
        { $sort: { _id: -1 } }
      ]);
      const categories = await Category.find({});
      const total = await Order.aggregate([
        {
          $match: {
            status: 'delivered'
          }
        },
        {
          $group: {
            _id: 'null',
            total: {
              $sum: '$total'
            },
            totalDisc: {
              $sum: '$discount'
            },
            totalShip: {
              $sum: '$shipping'
            }
          }
        }
      ]);
      const recentOrders = await Order.aggregate([
        {
          $match: {
            status: 'placed'
          }
        },
        {
          $sort: {
            date: -1
          }
        },
        {
          $unwind: '$orderDetails'
        },
        {
          $limit: 10
        },
        {
          $project: {
            userId: 1,
            'orderDetails.product': 1,
            date: 1,
            _id: 0
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: 'orderDetails.product',
            foreignField: '_id',
            as: 'product'
          }
        },
        {
          $unwind: '$product'
        },
        {
          $unwind: '$user'
        },
        {
          $project: {
            'product.title': 1,
            'product.image': 1,
            'user.name': 1,
            date: 1
          }
        },
        {
          $sort: {
            date: 1
          }
        }
      ]);
     
 // Fetch best selling products
 const bestSellingProducts = await Order.aggregate([
  {
    $match: {
      status: 'delivered'
    }
  },
  {
    $unwind: '$orderDetails'
  },
  {
    $group: {
      _id: '$orderDetails.product',
      count: { $sum: '$orderDetails.quantity' }
    }
  },
  {
    $lookup: {
      from: 'products',
      localField: '_id',
      foreignField: '_id',
      as: 'product'
    }
  },
  {
    $project: {
      'product.title': 1,
      count: 1
    }
  },
  {
    $sort: {
      count: -1
    }
  },
  {
    $limit: 5 // Limit to the top 5 best selling products
  }
]);

// Fetch best selling categories
const bestSellingCategories = await Order.aggregate([
  {
    $match: {
      status: 'delivered'
    }
  },
  {
    $unwind: '$orderDetails'
  },
  {
    $lookup: {
      from: 'products',
      localField: 'orderDetails.product',
      foreignField: '_id',
      as: 'product'
    }
  },
  {
    $unwind: '$product'
  },
  {
    $lookup: {
      from: 'categories',
      localField: 'product.category',
      foreignField: '_id',
      as: 'category'
    }
  },
  {
    $unwind: '$category'
  },
  {
    $group: {
      _id: '$category._id',
      categoryName: { $first: '$category.name' },
      count: { $sum: '$orderDetails.quantity' }
    }
  },
  {
    $sort: {
      count: -1
    }
  },
  {
    $limit: 5 // Limit to the top 5 best selling categories
  }
]);
console.log(total);
console.log(recentOrders);
console.log(user);
res.render('admin/dashboard', {
  admin,
  productCount,
  total,
  user,
  recentOrders,
  orderCount,
  categories,
  bestSellingProducts,
  bestSellingCategories
});
} catch (error) {
console.error(error);
res.render('admin/error', { error: "an error occurred while loading" });
}
},
  chartData: async (req, res) => {
    const categories = await Order.aggregate([
      {
        $match: {
          status: 'delivered'
        }
      },
      {
        $unwind: '$orderDetails'
      },
      {
        $project: {
          orderDetails: 1,
          _id: 0
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'orderDetails.product',
          foreignField: '_id',
          as: 'items'
        }
      },
      {
        $unwind: '$items'
      },
      {
        $project: {
          'items.category': 1,
          _id: 0,
          'orderDetails.quantity': 1
        }
      },
      {
        $group: {
          _id: '$items.category',
          count: {
            $sum: 1
          }
        }
      }
    ]);
    const orders = await Order.aggregate([
      {
        $match: {
          status: 'delivered'
        }
      },
      {
        $unwind: '$orderDetails'
      },
      {
        $group: {
          _id: {
            $slice: [
              {
                $split: [
                  '$date', ' '
                ]
              }, 1, 1
            ]
          },
          count: { $sum: 1 }
        }
      }
    ]);
    console.log(orders);
    console.log(categories);

    res.json({ orders, categories });
  },
  logout: (req, res) => {
    req.session.destroy();
    res.redirect('/admin');
  },
  renderBanners: async (req, res) => {
    Banner.find((err, banners) => {
      if (err) console.log(err);
      const admin = req.session.admin;
      const success = req.flash('success');
      const error = req.flash('error');
      res.render('admin/banner', { banners, admin, success, error });
    });
  },
  renderAddBanner: async (req, res) => {
    const categories = await Category.find();
    const admin = req.session.admin;
    res.render('admin/add-banner', { admin, categories });
  },
  addBanner: async (req, res) => {
    const { title, caption, category } = req.body;
    const banner = req.file.filename;

    const newBanner = new Banner({
      banner,
      title,
      caption,
      category
    });

    newBanner.save((err) => {
      if (err) {
        return console.log(err);
      }

      console.log('error in saving');

      Banner.find((err, banners) => {
        if (err) {
          console.log(err);
          console.log('error in finding');
        } else {
          req.app.locals.banners = banners;
        }
      });
    });

    req.flash('success', 'banner added successfully');
    res.redirect('/admin/banner');
  },
  renderEditBanner: async (req, res) => {
    const id = req.params.id;
    Banner.findById({ _id: id }, (err, bnr) => {
      if (err) return res.render('admin/404');
      const admin = req.session.admin;
      res.render('admin/edit-banner', {
        admin,
        id: id,
        title: bnr.title,
        caption: bnr.caption,
        banner: bnr.banner
      });
    });
  },
  editBanner: async (req, res) => {
    const id = req.params.id;
    const { title, caption, pimage } = req.body;
    const banner = req.file.filename;

    Banner.findById({ _id: id }, async (err, bnr) => {
      if (err) console.log(err);
      bnr.title = title;
      bnr.caption = caption;
      bnr.banner = banner;

      await bnr.save((err) => {
        if (err) console.log(err);

        fs.unlink('public/images/admin-img/' + pimage, (err) => {
          if (err) console.log(err);
        });

        req.flash('success', 'banner edited successfully.');
        res.redirect('/admin/banner');
      });
    });
  },
  deleteBanner: async (req, res) => {
    Banner.count((err, c) => {
      if (c > 1) {
        Banner.findById(req.params.id, (err, bnr) => {
          if (err) return console.log(err);
          const banner = bnr.banner;
          fs.unlink('public/images/banner-img/' + banner, (err) => {
            if (err) console.log(err);
            console.log('old img deleted');
          });
          Banner.deleteOne(bnr, () => {
            res.redirect('/admin/banner');
          });
        });
      } else {
        req.flash('error', "Banners shouldn't be empty");
        res.redirect('/admin/banner');
      }
    });
  },
  renderUsers: async (req, res) => {
    const count = await User.count();

    User.find((err, users) => {
      if (err) return console.log(err);
      const admin = req.session.admin;
      res.render('admin/users', { users: users, admin, count });
    });
  },
  blockUser: async (req, res) => {
    User.findByIdAndUpdate(req.params.id, { status: "true" }).then((err) => {
      if (err) console.log(err);
      res.redirect('/admin/users');
    });
  },
  unblockUser: async (req, res) => {
    User.findByIdAndUpdate(req.params.id, { status: "false" }).then((err) => {
      if (err) console.log(err);
      res.redirect('/admin/users');
    });
  },
  renderNotFound: (req, res) => {
    res.render('admin/404');
  },
};

module.exports = adminController;

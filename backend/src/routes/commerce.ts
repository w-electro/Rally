import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createProductSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
  description: z.string().max(2000, 'Description must be 2000 characters or fewer').optional(),
  price: z.number().int().min(0, 'Price must be non-negative'),
  currency: z.string().length(3, 'Currency must be a 3-letter code').default('USD'),
  type: z.enum(['DIGITAL_DOWNLOAD', 'ROLE', 'CUSTOM_EMOJI', 'SUBSCRIPTION', 'OTHER']),
  imageUrl: z.string().url('Invalid image URL').optional(),
  digitalUrl: z.string().url('Invalid digital download URL').optional(),
});

const updateProductSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  price: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  type: z.enum(['DIGITAL_DOWNLOAD', 'ROLE', 'CUSTOM_EMOJI', 'SUBSCRIPTION', 'OTHER']).optional(),
  imageUrl: z.string().url().nullable().optional(),
  digitalUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
});

const subscribeSchema = z.object({
  tierId: z.string().max(100).optional(),
  amount: z.number().int().min(1, 'Amount must be at least 1 cent'),
});

// ---------------------------------------------------------------------------
// GET /server/:serverId/products - List products for a server
// ---------------------------------------------------------------------------

router.get('/server/:serverId/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as string | undefined;

    // Verify the server exists
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new NotFoundError('Server not found');
    }

    const where: Record<string, unknown> = { serverId, isActive: true };
    if (type) {
      where.type = type;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /server/:serverId/products - Create a product
// ---------------------------------------------------------------------------

router.post('/server/:serverId/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId } = req.params;
    const userId = req.user!.userId;

    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { title, description, price, currency, type, imageUrl, digitalUrl } = parsed.data;

    // Verify the server exists
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new NotFoundError('Server not found');
    }

    // Verify the user is a member of the server
    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!member) {
      throw new ForbiddenError('You are not a member of this server');
    }

    const product = await prisma.product.create({
      data: {
        serverId,
        sellerId: userId,
        title,
        description: description || null,
        price,
        currency,
        type,
        imageUrl: imageUrl || null,
        digitalUrl: digitalUrl || null,
      },
      include: {
        seller: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /products/:productId - Update product
// ---------------------------------------------------------------------------

router.patch('/products/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const userId = req.user!.userId;

    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const updateData = parsed.data;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('At least one field must be provided for update');
    }

    // Verify the product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Only the seller can update the product
    if (product.sellerId !== userId) {
      throw new ForbiddenError('Only the seller can update this product');
    }

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        seller: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.json({ product: updatedProduct });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /products/:productId - Delete product (seller only)
// ---------------------------------------------------------------------------

router.delete('/products/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const userId = req.user!.userId;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    if (product.sellerId !== userId) {
      throw new ForbiddenError('Only the seller can delete this product');
    }

    await prisma.product.delete({ where: { id: productId } });

    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /products/:productId/purchase - Purchase a product
// ---------------------------------------------------------------------------

router.post('/products/:productId/purchase', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const userId = req.user!.userId;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        seller: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    if (!product.isActive) {
      throw new BadRequestError('This product is no longer available');
    }

    if (product.sellerId === userId) {
      throw new BadRequestError('You cannot purchase your own product');
    }

    // Check for duplicate purchase of digital products
    if (product.type === 'DIGITAL_DOWNLOAD' || product.type === 'ROLE' || product.type === 'CUSTOM_EMOJI') {
      const existingPurchase = await prisma.purchase.findFirst({
        where: {
          productId,
          buyerId: userId,
          status: 'COMPLETED',
        },
      });
      if (existingPurchase) {
        throw new BadRequestError('You have already purchased this product');
      }
    }

    const purchase = await prisma.purchase.create({
      data: {
        productId,
        buyerId: userId,
        amount: product.price,
        currency: product.currency,
        status: 'COMPLETED',
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            type: true,
            digitalUrl: true,
            seller: {
              select: {
                id: true,
                username: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({ purchase });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /purchases - Get user's purchase history
// ---------------------------------------------------------------------------

router.get('/purchases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where: { buyerId: userId },
        include: {
          product: {
            select: {
              id: true,
              title: true,
              description: true,
              type: true,
              imageUrl: true,
              digitalUrl: true,
              seller: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
              server: {
                select: { id: true, name: true, iconUrl: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.purchase.count({ where: { buyerId: userId } }),
    ]);

    res.json({
      purchases,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /server/:serverId/revenue - Revenue dashboard (seller only)
// ---------------------------------------------------------------------------

router.get('/server/:serverId/revenue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId } = req.params;
    const userId = req.user!.userId;

    // Verify the server exists
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new NotFoundError('Server not found');
    }

    // Only the server owner can view revenue
    if (server.ownerId !== userId) {
      throw new ForbiddenError('Only the server owner can view revenue data');
    }

    // Get all products for the server sold by this user
    const products = await prisma.product.findMany({
      where: { serverId, sellerId: userId },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);

    // Total sales (completed purchases)
    const totalSalesResult = await prisma.purchase.aggregate({
      where: {
        productId: { in: productIds },
        status: 'COMPLETED',
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const totalRevenue = totalSalesResult._sum.amount || 0;
    const totalSalesCount = totalSalesResult._count.id || 0;

    // Recent transactions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTransactions = await prisma.purchase.findMany({
      where: {
        productId: { in: productIds },
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        product: {
          select: { id: true, title: true, type: true },
        },
        buyer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Revenue in the last 30 days
    const recentRevenueResult = await prisma.purchase.aggregate({
      where: {
        productId: { in: productIds },
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const recentRevenue = recentRevenueResult._sum.amount || 0;
    const recentSalesCount = recentRevenueResult._count.id || 0;

    // Revenue by product
    const revenueByProduct = await prisma.purchase.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        status: 'COMPLETED',
      },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    // Enrich with product details
    const productDetails = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, title: true, type: true, price: true, currency: true },
    });

    const revenueBreakdown = revenueByProduct.map((rp) => {
      const product = productDetails.find((p) => p.id === rp.productId);
      return {
        productId: rp.productId,
        productTitle: product?.title || 'Unknown',
        productType: product?.type || 'OTHER',
        totalRevenue: rp._sum.amount || 0,
        salesCount: rp._count.id || 0,
      };
    });

    res.json({
      revenue: {
        total: totalRevenue,
        totalSales: totalSalesCount,
        currency: 'USD',
        last30Days: {
          revenue: recentRevenue,
          salesCount: recentSalesCount,
        },
        byProduct: revenueBreakdown,
      },
      recentTransactions,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /subscriptions - Get user's active subscriptions
// ---------------------------------------------------------------------------

router.get('/subscriptions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const subscriptions = await prisma.subscription.findMany({
      where: {
        subscriberId: userId,
        status: 'ACTIVE',
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bannerUrl: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ subscriptions });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /subscribe/:creatorId - Subscribe to a creator
// ---------------------------------------------------------------------------

router.post('/subscribe/:creatorId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { creatorId } = req.params;
    const userId = req.user!.userId;

    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { tierId, amount } = parsed.data;

    if (creatorId === userId) {
      throw new BadRequestError('You cannot subscribe to yourself');
    }

    // Verify the creator exists
    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });
    if (!creator) {
      throw new NotFoundError('Creator not found');
    }

    // Check for existing active subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        subscriberId: userId,
        creatorId,
        status: 'ACTIVE',
      },
    });
    if (existingSubscription) {
      throw new BadRequestError('You already have an active subscription to this creator');
    }

    // Calculate the current period end (30 days from now)
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

    const subscription = await prisma.subscription.create({
      data: {
        subscriberId: userId,
        creatorId,
        tierId: tierId || null,
        amount,
        currency: 'USD',
        status: 'ACTIVE',
        currentPeriodEnd,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.status(201).json({ subscription });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /subscriptions/:subId - Cancel subscription
// ---------------------------------------------------------------------------

router.delete('/subscriptions/:subId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subId } = req.params;
    const userId = req.user!.userId;

    const subscription = await prisma.subscription.findUnique({
      where: { id: subId },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    if (subscription.subscriberId !== userId) {
      throw new ForbiddenError('You can only cancel your own subscriptions');
    }

    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestError('This subscription is not active');
    }

    const cancelled = await prisma.subscription.update({
      where: { id: subId },
      data: { status: 'CANCELLED' },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.json({ subscription: cancelled, message: 'Subscription cancelled successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;

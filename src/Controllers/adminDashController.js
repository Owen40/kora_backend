const pool = require("../db");

/**
 * Safely execute a dashboard query.
 * A failure in one non-critical query should not destroy
 * the entire dashboard response.
 */
const safeQuery = async (name, query, params = [], fallback = []) => {
    try {
        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        console.error(`Dashboard query failed [${name}]:`, error.message);
        return fallback;
    }
};

/**
 * Calculate percentage change.
 */
const percentageChange = (current, previous) => {
    current = Number(current || 0);
    previous = Number(previous || 0);

    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }

    return Number(
        (((current - previous) / previous) * 100).toFixed(1)
    );
};

const getAdminDashboard = async (req, res) => {
    try {
        /*
         * =========================================================
         * 1. ORDER SUMMARY
         * =========================================================
         */

        const summaryRows = await safeQuery(
            "order-summary",
            `
            SELECT
                COUNT(*) FILTER (
                    WHERE placed_at >= CURRENT_DATE
                      AND placed_at < CURRENT_DATE + INTERVAL '1 day'
                ) AS today_orders,

                COUNT(*) FILTER (
                    WHERE placed_at >= CURRENT_DATE - INTERVAL '1 day'
                      AND placed_at < CURRENT_DATE
                ) AS yesterday_orders,

                COUNT(*) FILTER (
                    WHERE status = 'pending'
                ) AS pending_orders,

                COUNT(*) FILTER (
                    WHERE status IN (
                        'confirmed',
                        'preparing',
                        'ready',
                        'out_for_delivery'
                    )
                ) AS active_orders,

                COALESCE(
                    SUM(total_amount) FILTER (
                        WHERE placed_at >= CURRENT_DATE
                          AND placed_at < CURRENT_DATE + INTERVAL '1 day'
                    ),
                    0
                ) AS today_revenue,

                COALESCE(
                    SUM(total_amount) FILTER (
                        WHERE placed_at >= CURRENT_DATE - INTERVAL '1 day'
                          AND placed_at < CURRENT_DATE
                    ),
                    0
                ) AS yesterday_revenue

            FROM orders
            `
        );

        const summary = summaryRows[0] || {
            today_orders: 0,
            yesterday_orders: 0,
            pending_orders: 0,
            active_orders: 0,
            today_revenue: 0,
            yesterday_revenue: 0,
        };

        const todayOrders = Number(summary.today_orders || 0);
        const yesterdayOrders = Number(summary.yesterday_orders || 0);

        const todayRevenue = Number(summary.today_revenue || 0);
        const yesterdayRevenue = Number(summary.yesterday_revenue || 0);

        /*
         * =========================================================
         * 2. RESTAURANT SUMMARY
         * =========================================================
         *
         * Your restaurant table currently has no status/approval
         * column.
         *
         * Therefore:
         * - total = number of restaurants
         * - active = total restaurants for now
         * - pending approvals = 0
         *
         * We can change this once an approval/status column exists.
         */

        const restaurantRows = await safeQuery(
            "restaurant-summary",
            `
            SELECT COUNT(*) AS total_restaurants
            FROM restaurants
            `
        );

        const totalRestaurants = Number(
            restaurantRows[0]?.total_restaurants || 0
        );

        /*
         * =========================================================
         * 3. CUSTOMER SUMMARY
         * =========================================================
         *
         * Because users have a role column, we can distinguish
         * normal customers from admins and other system roles.
         *
         * Assuming role = 'user' represents normal customers.
         */

        const customerRows = await safeQuery(
            "customer-summary",
            `
            SELECT
                COUNT(*) FILTER (
                    WHERE role = 'user'
                ) AS total_customers,

                COUNT(*) FILTER (
                    WHERE role = 'user'
                      AND created_at >= CURRENT_DATE
                      AND created_at < CURRENT_DATE + INTERVAL '1 day'
                ) AS new_customers_today

            FROM users
            `
        );

        const totalCustomers = Number(
            customerRows[0]?.total_customers || 0
        );

        const newCustomersToday = Number(
            customerRows[0]?.new_customers_today || 0
        );

        /*
         * =========================================================
         * 4. TOP RESTAURANTS
         * =========================================================
         *
         * Based on revenue over the last 30 days.
         */

        const topRestaurants = await safeQuery(
            "top-restaurants",
            `
            SELECT
                r.id,
                r.name,
                r.cuisine,
                r.image_url,

                COUNT(o.id) AS orders,

                COALESCE(
                    SUM(o.total_amount),
                    0
                ) AS revenue

            FROM restaurants r

            LEFT JOIN orders o
                ON o.restaurant_id = r.id
                AND o.placed_at >= CURRENT_DATE - INTERVAL '30 days'

            GROUP BY
                r.id,
                r.name,
                r.cuisine,
                r.image_url

            ORDER BY revenue DESC

            LIMIT 5
            `
        );

        /*
         * =========================================================
         * 5. RECENT ORDERS
         * =========================================================
         */

        const recentOrders = await safeQuery(
            "recent-orders",
            `
            SELECT
                o.id,
                o.order_number,
                o.status,
                o.total_amount,
                o.placed_at,

                r.name AS restaurant_name,

                TRIM(
                    u.first_name || ' ' || u.last_name
                ) AS customer_name

            FROM orders o

            INNER JOIN restaurants r
                ON r.id = o.restaurant_id

            INNER JOIN users u
                ON u.id = o.user_id

            ORDER BY o.placed_at DESC

            LIMIT 10
            `
        );

        /*
         * =========================================================
         * 6. ORDER STATUS DISTRIBUTION
         * =========================================================
         */

        const orderStatusRows = await safeQuery(
            "order-status",
            `
            SELECT
                status,
                COUNT(*) AS count

            FROM orders

            WHERE placed_at >= CURRENT_DATE
              AND placed_at < CURRENT_DATE + INTERVAL '1 day'

            GROUP BY status

            ORDER BY count DESC
            `
        );

        /*
         * =========================================================
         * 7. 7-DAY ORDER / REVENUE TREND
         * =========================================================
         */

        const orderTrend = await safeQuery(
            "order-trend",
            `
            SELECT
                DATE(placed_at) AS date,
                COUNT(*) AS orders,
                COALESCE(
                    SUM(total_amount),
                    0
                ) AS revenue

            FROM orders

            WHERE placed_at >= CURRENT_DATE - INTERVAL '6 days'

            GROUP BY DATE(placed_at)

            ORDER BY date ASC
            `
        );


        const alertRows = await safeQuery(
            "alerts",
            `
            SELECT
                COUNT(*) FILTER (
                    WHERE status = 'pending'
                      AND placed_at <= NOW() - INTERVAL '10 minutes'
                ) AS stale_orders,

                COUNT(*) FILTER (
                    WHERE status = 'cancelled'
                      AND placed_at >= CURRENT_DATE
                      AND placed_at < CURRENT_DATE + INTERVAL '1 day'
                ) AS cancelled_today

            FROM orders
            `
        );

        const staleOrders = Number(
            alertRows[0]?.stale_orders || 0
        );

        const cancelledToday = Number(
            alertRows[0]?.cancelled_today || 0
        );


        return res.status(200).json({
            success: true,

            data: {
                summary: {
                    todayOrders,
                    yesterdayOrders,

                    pendingOrders: Number(
                        summary.pending_orders || 0
                    ),

                    activeOrders: Number(
                        summary.active_orders || 0
                    ),

                    todayRevenue,
                    yesterdayRevenue,

                    ordersGrowth: percentageChange(
                        todayOrders,
                        yesterdayOrders
                    ),

                    revenueGrowth: percentageChange(
                        todayRevenue,
                        yesterdayRevenue
                    ),
                },

                restaurants: {
                    total: totalRestaurants,

                    active: totalRestaurants,

                    pendingApprovals: 0,
                },

                customers: {
                    total: totalCustomers,
                    newToday: newCustomersToday,
                },

                topRestaurants: topRestaurants.map(
                    (restaurant) => ({
                        id: restaurant.id,
                        name: restaurant.name,
                        cuisine: restaurant.cuisine,
                        image: restaurant.image_url,
                        orders: Number(restaurant.orders || 0),
                        revenue: Number(restaurant.revenue || 0),
                    })
                ),

                recentOrders: recentOrders.map(
                    (order) => ({
                        id: order.id,
                        orderNumber: order.order_number,
                        restaurant:
                            order.restaurant_name,
                        customer:
                            order.customer_name,
                        amount: Number(
                            order.total_amount || 0
                        ),
                        status: order.status,
                        placedAt: order.placed_at,
                    })
                ),

                orderStatus: orderStatusRows.map(
                    (row) => ({
                        status: row.status,
                        count: Number(row.count || 0),
                    })
                ),

                trend: orderTrend.map(
                    (row) => ({
                        date: row.date,
                        orders: Number(row.orders || 0),
                        revenue: Number(row.revenue || 0),
                    })
                ),

                alerts: {
                    staleOrders,
                    cancelledToday,
                    pendingRestaurantApprovals: 0,
                },
            },
        });
    } catch (error) {
        console.error(
            "Admin dashboard error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to load admin dashboard",
        });
    }
};

module.exports = {
    getAdminDashboard,
};
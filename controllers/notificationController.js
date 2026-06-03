const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');

const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const filter = { user: req.user._id };
  if (unreadOnly === 'true') filter.isRead = false;
  const total = await Notification.countDocuments(filter);
  const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });
  const notifications = await Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
  return successResponse(res, { notifications, unreadCount, pagination: { total, page: Number(page) } }, 'Notifications retrieved');
});

const markRead = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (ids && ids.length > 0) {
    await Notification.updateMany({ _id: { $in: ids }, user: req.user._id }, { isRead: true, readAt: new Date() });
  } else {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
  }
  return successResponse(res, {}, 'Notifications marked as read');
});

const deleteNotification = asyncHandler(async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  return successResponse(res, {}, 'Notification deleted');
});

module.exports = { getNotifications, markRead, deleteNotification };

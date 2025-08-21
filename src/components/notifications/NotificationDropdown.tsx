import React, { useState, useRef, useEffect } from 'react';
import { 
  BellIcon, 
  ShareIcon, 
  ThumbsUpIcon, 
  XIcon,
  CheckIcon,
  ExternalLinkIcon
} from 'lucide-react';
import { useAppAuth } from '../../providers/AppContext';
import { cn } from '../../utils/responsive';
import { Link } from 'react-router-dom';
import { NotificationService } from '../../services/NotificationService';
import { ShareService } from '../../services/ShareService';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const { notifications, markAsRead, markAllAsRead, removeNotification } = useAppAuth();
  const { isDarkMode } = useAppAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'share':
        return <ShareIcon className="h-5 w-5 text-blue-500" />;
      case 'vote':
        return <ThumbsUpIcon className="h-5 w-5 text-green-500" />;
      case 'success':
        return <CheckIcon className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XIcon className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <BellIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <BellIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const handleNotificationClick = (notification: { id: string; read?: boolean }) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Close dropdown after interaction
    setTimeout(() => onClose(), 100);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className={cn(
        "absolute right-0 top-12 w-80 max-w-sm rounded-lg border shadow-lg z-50",
        isDarkMode 
          ? "bg-gray-900 border-gray-700" 
          : "bg-white border-gray-200"
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between p-4 border-b",
        isDarkMode ? "border-gray-700" : "border-gray-200"
      )}>
        <h3 className={cn(
          "font-semibold text-sm",
          isDarkMode ? "text-white" : "text-gray-900"
        )}>
          Notifications
        </h3>
        {notifications.length > 0 && (
          <button
            onClick={markAllAsRead}
            className={cn(
              "text-xs px-2 py-1 rounded transition-colors",
              isDarkMode 
                ? "text-gray-400 hover:text-white hover:bg-gray-800" 
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className={cn(
            "p-6 text-center",
            isDarkMode ? "text-gray-400" : "text-gray-600"
          )}>
            <BellIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notifications yet</p>
            <p className="text-xs mt-1 opacity-75">
              You'll be notified when someone shares or votes on your Evermarks
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                "relative p-4 border-b transition-colors cursor-pointer",
                isDarkMode 
                  ? "border-gray-700 hover:bg-gray-800" 
                  : "border-gray-100 hover:bg-gray-50",
                !notification.read && (isDarkMode ? "bg-gray-800/50" : "bg-blue-50/50")
              )}
              onClick={() => handleNotificationClick(notification)}
            >
              {/* Unread indicator */}
              {!notification.read && (
                <div className="absolute left-2 top-6 w-2 h-2 bg-cyber-primary rounded-full" />
              )}

              <div className="flex items-start space-x-3 ml-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium",
                    isDarkMode ? "text-white" : "text-gray-900"
                  )}>
                    {notification.title}
                  </p>
                  {notification.message && (
                    <p className={cn(
                      "text-sm mt-1",
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    )}>
                      {notification.message}
                    </p>
                  )}
                  <p className={cn(
                    "text-xs mt-2",
                    isDarkMode ? "text-gray-500" : "text-gray-500"
                  )}>
                    {formatTimestamp(notification.timestamp)}
                  </p>

                  {/* Action buttons for specific notification types */}
                  {(notification.type === 'share' || notification.type === 'vote') && notification.evermarkId && (
                    <div className="mt-2">
                      <Link
                        to={`/evermark/${notification.evermarkId}`}
                        className={cn(
                          "inline-flex items-center text-xs px-2 py-1 rounded transition-colors",
                          isDarkMode 
                            ? "text-cyber-primary hover:bg-gray-700" 
                            : "text-cyber-primary hover:bg-gray-100"
                        )}
                      >
                        View Evermark
                        <ExternalLinkIcon className="h-3 w-3 ml-1" />
                      </Link>
                    </div>
                  )}
                </div>

                {/* Dismiss button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeNotification(notification.id);
                  }}
                  className={cn(
                    "flex-shrink-0 p-1 rounded transition-colors",
                    isDarkMode 
                      ? "text-gray-500 hover:text-gray-400 hover:bg-gray-700" 
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className={cn(
        "p-3 border-t text-center space-y-2",
        isDarkMode ? "border-gray-700" : "border-gray-200"
      )}>
        {notifications.length > 0 && (
          <button
            onClick={() => {
              // Clear all notifications
              notifications.forEach(n => removeNotification(n.id));
              onClose();
            }}
            className={cn(
              "text-xs px-3 py-1 rounded transition-colors block w-full",
              isDarkMode 
                ? "text-gray-400 hover:text-white hover:bg-gray-800" 
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            Clear all notifications
          </button>
        )}
        
        {/* Development test buttons */}
        {import.meta.env.DEV && (
          <div className="space-y-1">
            <button
              onClick={() => {
                NotificationService.triggerTestNotifications();
                onClose();
              }}
              className={cn(
                "text-xs px-3 py-1 rounded transition-colors block w-full",
                "bg-cyber-primary/20 text-cyber-primary hover:bg-cyber-primary/30"
              )}
            >
              🧪 Test Notifications
            </button>
            <button
              onClick={() => {
                ShareService.testShare();
                onClose();
              }}
              className={cn(
                "text-xs px-3 py-1 rounded transition-colors block w-full",
                "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
              )}
            >
              🔗 Test Share
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
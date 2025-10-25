import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../../contexts/AlertContext';
import { useAuth } from '../../contexts/AuthContext';
import api, { handleAPIError, alertsAPI } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import {
  ExclamationTriangleIcon,
  ClockIcon,
  MapPinIcon,
  UserIcon,
  FunnelIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  BellAlertIcon,
  XCircleIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const Alert2 = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [summary, setSummary] = useState(null);
  const [overallSummary, setOverallSummary] = useState(null);
  const LOCAL_STORAGE_KEY = 'alert2_local_state_v1';
  const [localState, setLocalState] = useState({});
  const canonicalId = (item) => {
    if (!item && item !== 0) return '';
    if (typeof item === 'string') return item;
    return String(item._id || item.id || '');
  };
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false
  });
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const { showError, showSuccess } = useAlert();
  const { user } = useAuth();

  useEffect(() => {
    // load local state from localStorage first so we can merge statuses
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        setLocalState(JSON.parse(raw));
      }
    } catch (err) {
      console.warn('Failed to read local alert state', err);
    }

    loadAdvancedAlerts();
  }, [priorityFilter, pagination.page]);
  const loadAdvancedAlerts = async (overrides = {}) => {
    try {
      setLoading(true);
      const params = {
        page: overrides.page ?? pagination.page,
        limit: overrides.limit ?? pagination.limit
      };

      if (priorityFilter) {
        params.priority = priorityFilter;
      }

      // If a priority filter is active, fetch overall summary too so the top cards show global counts
      if (priorityFilter) {
        const overallParams = { page: 1, limit: 1 }; // small, just to get summary
        const [overallResp, filteredResp] = await Promise.all([
          api.get('/alerts/advanced', { params: overallParams }),
          api.get('/alerts/advanced', { params })
        ]);

          if (overallResp.data.success) {
            setOverallSummary(overallResp.data.data.summary || {});
          }

          if (filteredResp.data.success) {
            const rawAlerts = filteredResp.data.data.alerts || [];
            const storedRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
            const stored = storedRaw ? JSON.parse(storedRaw) : {};
            const normalized = rawAlerts.map(a => {
              const idKey = canonicalId(a);
              const local = stored[idKey];
              return { ...a, _id: a._id || a.id, ...(local ? { status: local.status, actions: local.actions } : {}) };
            });
            setAlerts(normalized);
            setSummary(filteredResp.data.data.summary || {}); // keep filtered summary for context
            setPagination(filteredResp.data.data.pagination || {});
          }
      } else {
        const response = await api.get('/alerts/advanced', { params });

        if (response.data.success) {
          const rawAlerts = response.data.data.alerts || [];
          const storedRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
          const stored = storedRaw ? JSON.parse(storedRaw) : {};
          const normalized = rawAlerts.map(a => {
            const idKey = canonicalId(a);
            const local = stored[idKey];
            return { ...a, _id: a._id || a.id, ...(local ? { status: local.status, actions: local.actions } : {}) };
          });
          setAlerts(normalized);
          setSummary(response.data.data.summary || {});
          setPagination(response.data.data.pagination || {});
          setOverallSummary(response.data.data.summary || {}); // no filter => overall == summary
        }
      }
    } catch (error) {
      const errorInfo = handleAPIError(error);
      showError('Error Loading Advanced Alerts', errorInfo.message);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    // If already on page 1, force a reload immediately with overrides so we use correct page
    if (pagination.page === 1) {
      setAlerts([]);
      loadAdvancedAlerts({ page: 1, limit: pagination.limit });
    } else {
      // Otherwise set page to 1 and let the useEffect trigger loadAdvancedAlerts
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  };

  const handlePriorityFilter = (priority) => {
    if (priorityFilter === priority) {
      setPriorityFilter('');
    } else {
      setPriorityFilter(priority);
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleViewProfile = () => {
    if (selectedAlert && selectedAlert.entityId) {
      navigate(`/entities/${selectedAlert.entityId}`, {
        state: { from: '/alert2' }
      });
    }
  };

  const loadMore = () => {
    if (pagination.hasMore && !loading) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority.toUpperCase()) {
      case 'HIGH':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority.toUpperCase()) {
      case 'HIGH':
        return <ShieldExclamationIcon className="h-5 w-5 text-red-600" />;
      case 'MEDIUM':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />;
      case 'LOW':
        return <BellAlertIcon className="h-5 w-5 text-blue-600" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'INACTIVITY':
        return 'Inactivity Alert';
      case 'SIMULTANEOUS_ACTIVITY':
        return 'Simultaneous Activity';
      case 'ADMIN_ACCESS':
        return 'Students Not in College';
      default:
        return type;
    }
  };

  // Compute totals from priority breakdown (prefer overallSummary when available)
  const visibleSummary = overallSummary || summary || {};
  const totalAlertsCount = (
    (visibleSummary?.byPriority?.high || 0) +
    (visibleSummary?.byPriority?.medium || 0) +
    (visibleSummary?.byPriority?.low || 0)
  );

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      acknowledged: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      dismissed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    };
    return colors[status] || colors.active;
  };

  const canPerformAction = (alert, action) => {
    if (!user) return false;

    const rolePermissions = {
      ADMIN: ['acknowledge', 'resolve', 'dismiss'],
      SECURITY_OFFICER: ['acknowledge', 'resolve', 'dismiss'],
      OPERATOR: ['acknowledge'],
      VIEWER: []
    };

    const allowedActions = rolePermissions[user.role] || [];

    if (alert.status === 'resolved' || alert.status === 'dismissed') {
      return false;
    }

    // Allow actions on both persisted and generated alerts in the UI. Persisted
    // alerts will call the backend; generated alerts will be updated locally.
    return allowedActions.includes(action);
  };

  const handleAlertAction = async (alertId, action) => {
    if (!alertId) {
      showError('Action Failed', 'Alert id is missing');
      return;
    }

    // Determine if the id looks like a persisted Mongo ObjectId
    const isPersistentId = /^[0-9a-fA-F]{24}$/.test(String(alertId));

    // If persisted, call the backend endpoints. If not, perform a local UI-only update.
    if (isPersistentId) {
      try {
        setActionLoading(prev => ({ ...prev, [alertId]: action }));

        switch (action) {
          case 'acknowledge':
            await alertsAPI.acknowledge(alertId);
            break;
          case 'resolve':
            await alertsAPI.resolve(alertId);
            break;
          case 'dismiss':
            await alertsAPI.dismiss(alertId);
            break;
          default:
            throw new Error('Invalid action');
        }

        // Update the alert in the list and selectedAlert
        setAlerts(prev => prev.map(a =>
          (a.id === alertId || a._id === alertId)
            ? { ...a, status: action === 'dismiss' ? 'dismissed' : action === 'resolve' ? 'resolved' : 'acknowledged' }
            : a
        ));

        if (selectedAlert && (selectedAlert.id === alertId || selectedAlert._id === alertId)) {
          setSelectedAlert(prev => ({ ...prev, status: action === 'dismiss' ? 'dismissed' : action === 'resolve' ? 'resolved' : 'acknowledged' }));
        }

        showSuccess('Alert Updated', `Alert has been ${action}d successfully`);
        // Optionally refresh summaries
        loadAdvancedAlerts({ page: 1, limit: pagination.limit });
      } catch (error) {
        console.error('handleAlertAction error:', error);
        const errorInfo = handleAPIError(error);
        showError('Action Failed', errorInfo.message || String(error));
      } finally {
        setActionLoading(prev => ({ ...prev, [alertId]: null }));
      }

      return;
    }

    // Frontend-only local update for generated/ephemeral alerts
    try {
      setActionLoading(prev => ({ ...prev, [alertId]: action }));

      const newStatus = action === 'dismiss' ? 'dismissed' : action === 'resolve' ? 'resolved' : 'acknowledged';
      const timestamp = new Date().toISOString();
      const actor = user?.id || user?._id || user?.userId || 'local';

      setAlerts(prev => prev.map(a =>
        (a.id === alertId || a._id === alertId)
          ? {
              ...a,
              status: newStatus,
              actions: [...(a.actions || []), { type: action, actor, timestamp }]
            }
          : a
      ));

      if (selectedAlert && (selectedAlert.id === alertId || selectedAlert._id === alertId)) {
        setSelectedAlert(prev => ({ ...prev, status: newStatus, actions: [...(prev.actions || []), { type: action, actor, timestamp }] }));
      }

      // Persist this change into localStorage so it survives reloads
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        const stored = raw ? JSON.parse(raw) : {};
          const key = canonicalId(alertId);
          const entry = stored[key] || { status: null, actions: [] };
        const updated = { ...entry, status: newStatus, actions: [...(entry.actions || []), { type: action, actor, timestamp }] };
          stored[key] = updated;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stored));
        setLocalState(stored);
      } catch (saveErr) {
        console.warn('Failed to save local alert state', saveErr);
      }

      showSuccess('Alert Updated', `Alert marked ${newStatus} (local)`);
    } catch (err) {
      console.error('local handleAlertAction error:', err);
      showError('Action Failed', String(err));
    } finally {
      setActionLoading(prev => ({ ...prev, [alertId]: null }));
    }
  };

  if (loading && alerts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="large" text="Loading advanced alerts..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Advanced Alert Detection</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Intelligent analysis of campus activity data for anomaly detection
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <ArrowPathIcon className="h-5 w-5 mr-2" />
          Refresh
        </button>
      </div>

      {/* Summary Statistics */}
      {summary && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Alerts</dt>
                    <dd className="text-lg font-semibold text-gray-900 dark:text-white">{totalAlertsCount}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all ${
              priorityFilter === 'HIGH' ? 'ring-2 ring-red-500 dark:ring-red-400' : ''
            }`}
            onClick={() => handlePriorityFilter('HIGH')}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ShieldExclamationIcon className="h-6 w-6 text-red-600 dark:text-red-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">High Priority</dt>
                    <dd className="text-lg font-semibold text-red-600 dark:text-red-500">
                      {(overallSummary || summary)?.byPriority?.high || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all ${
              priorityFilter === 'MEDIUM' ? 'ring-2 ring-yellow-500 dark:ring-yellow-400' : ''
            }`}
            onClick={() => handlePriorityFilter('MEDIUM')}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Medium Priority</dt>
                    <dd className="text-lg font-semibold text-yellow-600 dark:text-yellow-500">
                      {(overallSummary || summary)?.byPriority?.medium || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer transition-all ${
              priorityFilter === 'LOW' ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
            }`}
            onClick={() => handlePriorityFilter('LOW')}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BellAlertIcon className="h-6 w-6 text-blue-600 dark:text-blue-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Low Priority</dt>
                    <dd className="text-lg font-semibold text-blue-600 dark:text-blue-500">
                      {(overallSummary || summary)?.byPriority?.low || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards (Active / Acknowledged / Resolved) */}
      {(summary || alerts) && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Active */}
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5 flex items-center">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Active Alerts</dt>
                  <dd className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(() => {
                      const vs = visibleSummary || {};
                      if (vs.active !== undefined) return vs.active;
                      if (vs.status && vs.status.active !== undefined) return vs.status.active;
                      return alerts.filter(a => (a.status || 'active') === 'active').length;
                    })()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          {/* Acknowledged */}
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5 flex items-center">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                  <ClockIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Acknowledged</dt>
                  <dd className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(() => {
                      const vs = visibleSummary || {};
                      if (vs.acknowledged !== undefined) return vs.acknowledged;
                      if (vs.status && vs.status.acknowledged !== undefined) return vs.status.acknowledged;
                      return alerts.filter(a => (a.status || '') === 'acknowledged').length;
                    })()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          {/* Resolved */}
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5 flex items-center">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Resolved</dt>
                  <dd className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(() => {
                      const vs = visibleSummary || {};
                      if (vs.resolved !== undefined) return vs.resolved;
                      if (vs.status && vs.status.resolved !== undefined) return vs.status.resolved;
                      return alerts.filter(a => (a.status || '') === 'resolved').length;
                    })()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          {/* critical section removed per request */}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FunnelIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Priority:</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePriorityFilter('HIGH')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                priorityFilter === 'HIGH'
                  ? 'bg-red-600 text-white dark:bg-red-500'
                  : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800'
              }`}
            >
              High
            </button>
            <button
              onClick={() => handlePriorityFilter('MEDIUM')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                priorityFilter === 'MEDIUM'
                  ? 'bg-yellow-600 text-white dark:bg-yellow-500'
                  : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:hover:bg-yellow-800'
              }`}
            >
              Medium
            </button>
            <button
              onClick={() => handlePriorityFilter('LOW')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                priorityFilter === 'LOW'
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800'
              }`}
            >
              Low
            </button>
            {priorityFilter && (
              <button
                onClick={() => setPriorityFilter('')}
                className="px-3 py-1 rounded-md text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Advanced Alerts
            {priorityFilter && (
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                (Filtered by {priorityFilter} priority)
              </span>
            )}
          </h3>
        </div>

        {alerts.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No alerts found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {priorityFilter
                ? `No ${priorityFilter.toLowerCase()} priority alerts detected.`
                : 'No advanced alerts detected at this time.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {alerts.map((alert, index) => (
              <div
                key={alert.id || index}
                className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                onClick={() => setSelectedAlert(alert)}
              >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      {getPriorityIcon(alert.priority)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">{alert.title}</h4>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(
                            alert.priority
                          )}`}
                        >
                          {alert.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{alert.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          <UserIcon className="h-4 w-4 mr-1" />
                          Entity: {alert.entityId}
                        </div>
                        <div className="flex items-center">
                          <ClockIcon className="h-4 w-4 mr-1" />
                          {formatTimestamp(alert.timestamp)}
                        </div>
                        <div className="flex items-center">
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium">
                            {getTypeLabel(alert.type)}
                          </span>
                        </div>
                        {alert.details?.location && (
                          <div className="flex items-center">
                            <MapPinIcon className="h-4 w-4 mr-1" />
                            {alert.details.location}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-2 ml-4">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(alert.status)}`}>
                        {alert.status || 'active'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {(() => {
                        const allowed = canPerformAction(alert, 'acknowledge') && alert.status === 'active';
                        const id = alert.id || alert._id || '';
                        return (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (allowed) handleAlertAction(id, 'acknowledge'); }}
                            disabled={!allowed || actionLoading[id] === 'acknowledge'}
                            title={!allowed ? 'Action unavailable: insufficient permissions or alert already handled' : undefined}
                            className="inline-flex items-center px-2 py-1 border border-yellow-300 dark:border-yellow-600 text-xs font-medium rounded text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
                          >
                            {actionLoading[id] === 'acknowledge' ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-700 dark:border-yellow-300"></div>
                            ) : (
                              <>
                                <ClockIcon className="h-3 w-3 mr-1" />
                                Acknowledge
                              </>
                            )}
                          </button>
                        );
                      })()}

                      {(() => {
                        const id = alert.id || alert._id || '';
                        const allowed = canPerformAction(alert, 'resolve');
                        return (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (allowed) handleAlertAction(id, 'resolve'); }}
                            disabled={!allowed || actionLoading[id] === 'resolve'}
                            title={!allowed ? 'Action unavailable: insufficient permissions or alert already handled' : undefined}
                            className="inline-flex items-center px-2 py-1 border border-green-300 dark:border-green-600 text-xs font-medium rounded text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                          >
                            {actionLoading[id] === 'resolve' ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-700 dark:border-green-300"></div>
                            ) : (
                              <>
                                <CheckCircleIcon className="h-3 w-3 mr-1" />
                                Resolve
                              </>
                            )}
                          </button>
                        );
                      })()}

                      {(() => {
                        const id = alert.id || alert._id || '';
                        const allowed = canPerformAction(alert, 'dismiss');
                        return (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (allowed) handleAlertAction(id, 'dismiss'); }}
                            disabled={!allowed || actionLoading[id] === 'dismiss'}
                            title={!allowed ? 'Action unavailable: insufficient permissions or alert already handled' : undefined}
                            className="inline-flex items-center px-2 py-1 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                          >
                            {actionLoading[id] === 'dismiss' ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-700 dark:border-gray-300"></div>
                            ) : (
                              <>
                                <XMarkIcon className="h-3 w-3 mr-1" />
                                Dismiss
                              </>
                            )}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {pagination.hasMore && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 text-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="small" />
                  <span className="ml-2">Loading...</span>
                </>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Alert Details</h3>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  {getPriorityIcon(selectedAlert.priority)}
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedAlert.title}</h4>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(
                      selectedAlert.priority
                    )}`}
                  >
                    {selectedAlert.priority}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{selectedAlert.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Entity ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{selectedAlert.entityId}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Alert Type</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{getTypeLabel(selectedAlert.type)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Timestamp</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {new Date(selectedAlert.timestamp).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white capitalize">{selectedAlert.status}</dd>
                </div>
              </div>

              {selectedAlert.details && (
                <div>
                  <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Additional Details</h5>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
                    {Object.entries(selectedAlert.details).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="font-medium text-gray-500 dark:text-gray-400 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {typeof value === 'object'
                            ? JSON.stringify(value, null, 2)
                            : value?.toString() || 'N/A'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                {(() => {
                  const id = selectedAlert.id || selectedAlert._id || '';
                  const ackAllowed = canPerformAction(selectedAlert, 'acknowledge') && selectedAlert.status === 'active';
                  const resolveAllowed = canPerformAction(selectedAlert, 'resolve');
                  const dismissAllowed = canPerformAction(selectedAlert, 'dismiss');
                  return (
                    <>
                      <button
                        onClick={() => { if (ackAllowed) handleAlertAction(id, 'acknowledge'); }}
                        disabled={!ackAllowed || actionLoading[id] === 'acknowledge'}
                        title={!ackAllowed ? 'Action unavailable: insufficient permissions or alert already handled' : undefined}
                        className="inline-flex items-center px-3 py-2 border border-yellow-300 dark:border-yellow-600 text-sm font-medium rounded text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
                      >
                        {actionLoading[id] === 'acknowledge' ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-700 dark:border-yellow-300"></div>
                        ) : (
                          <>
                            <ClockIcon className="h-4 w-4 mr-2" />
                            Acknowledge
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => { if (resolveAllowed) handleAlertAction(id, 'resolve'); }}
                        disabled={!resolveAllowed || actionLoading[id] === 'resolve'}
                        title={!resolveAllowed ? 'Action unavailable: insufficient permissions or alert already handled' : undefined}
                        className="inline-flex items-center px-3 py-2 border border-green-300 dark:border-green-600 text-sm font-medium rounded text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                      >
                        {actionLoading[id] === 'resolve' ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-700 dark:border-green-300"></div>
                        ) : (
                          <>
                            <CheckCircleIcon className="h-4 w-4 mr-2" />
                            Resolve
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => { if (dismissAllowed) handleAlertAction(id, 'dismiss'); }}
                        disabled={!dismissAllowed || actionLoading[id] === 'dismiss'}
                        title={!dismissAllowed ? 'Action unavailable: insufficient permissions or alert already handled' : undefined}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                      >
                        {actionLoading[id] === 'dismiss' ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 dark:border-gray-300"></div>
                        ) : (
                          <>
                            <XMarkIcon className="h-4 w-4 mr-2" />
                            Dismiss
                          </>
                        )}
                      </button>
                    </>
                  );
                })()}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleViewProfile}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <UserIcon className="h-5 w-5 mr-2" />
                  See Profile
                </button>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Alert2;

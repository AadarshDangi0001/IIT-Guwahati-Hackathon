import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../../contexts/AlertContext';
import api, { handleAPIError } from '../../services/api';
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
  XCircleIcon
} from '@heroicons/react/24/outline';

const Alert2 = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [summary, setSummary] = useState(null);
  const [overallSummary, setOverallSummary] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false
  });
  const [selectedAlert, setSelectedAlert] = useState(null);

  const { showError, showSuccess } = useAlert();

  useEffect(() => {
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
          setAlerts(filteredResp.data.data.alerts || []);
          setSummary(filteredResp.data.data.summary || {}); // keep filtered summary for context
          setPagination(filteredResp.data.data.pagination || {});
        }
      } else {
        const response = await api.get('/alerts/advanced', { params });

        if (response.data.success) {
          setAlerts(response.data.data.alerts || []);
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

      {/* Alert Type Statistics */}
      {summary && summary.byType && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Alert Types Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{(overallSummary || summary)?.byType?.inactivity || 0}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Inactivity</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{(overallSummary || summary)?.byType?.simultaneous || 0}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Simultaneous</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{(overallSummary || summary)?.byType?.suspicious || 0}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Suspicious</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{(overallSummary || summary)?.byType?.adminAccess || 0}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Students Not in College</div>
            </div>
          </div>
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
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
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
      )}
    </div>
  );
};

export default Alert2;

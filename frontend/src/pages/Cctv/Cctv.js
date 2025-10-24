import React, { useState } from 'react';
import { getToken } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import { useAlert } from '../../contexts/AlertContext';
import { Link } from 'react-router-dom';

const Cctv = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const { showError, showSuccess } = useAlert();

  const onFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setPhotoUrl(null); // Reset photo URL when changing files
  };

  const loadEntityPhoto = async (entityId) => {
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/photos/entity/${entityId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPhotoUrl(url);
      }
    } catch (error) {
      console.warn('Failed to load entity photo:', error);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) return showError('No file', 'Please select an image to upload');

    setLoading(true);
    setResult(null);

    try {
      const token = getToken();
      if (!token) return showError('Not authenticated', 'Please log in first');

      const fd = new FormData();
      fd.append('image', file);

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/cctv/recognize`, {
        method: 'POST',
        body: fd,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        showError('Recognition failed', data.message || JSON.stringify(data));
        setLoading(false);
        return;
      }

      setResult(data);
      
      // Load the photo with authentication if entity is found
      if (data.entity && data.confidence > 0) {
        loadEntityPhoto(data.entity._id);
        showSuccess('Recognition complete', `Match found with ${(data.confidence * 100).toFixed(1)}% confidence`);
      } else {
        showSuccess('Recognition complete', 'No matching face found in database');
      }
    } catch (err) {
      console.error(err);
      showError('Upload error', err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">CCTV Face Recognition</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Upload an image from CCTV and try to match against known faces.</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <input type="file" accept="image/*" onChange={onFileChange} />
          </div>

          {preview && (
            <div className="mt-2">
              <img src={preview} alt="preview" className="max-w-xs rounded-lg" />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md">
              {loading ? <span className="flex items-center"><LoadingSpinner size="small" /> Processing...</span> : 'Find Match'}
            </button>
            <button type="button" onClick={() => { 
              if (photoUrl) {
                URL.revokeObjectURL(photoUrl);
                setPhotoUrl(null);
              }
              setFile(null); 
              setPreview(null); 
              setResult(null); 
            }} className="px-4 py-2 border rounded-md">Clear</button>
          </div>
        </form>
      </div>

      {result && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-md font-medium text-gray-900 dark:text-white">Result</h3>
          {result.entity ? (
            <div className="mt-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200">
                  {photoUrl ? (
                    <img 
                      src={photoUrl} 
                      alt="matched person" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs">
                      No Photo
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-lg font-semibold">{result.entity.profile?.name || 'Unknown Person'}</p>
                  <p className="text-sm text-gray-500">ID: {result.entity._id}</p>
                  <p className="text-sm text-gray-500">Face ID: {result.match?.face_id || 'N/A'}</p>
                  <p className="text-sm text-gray-500">Confidence: {(result.confidence * 100).toFixed(1)}%</p>
                  <Link to={`/entities/${result.entity._id}`} className="text-sm text-blue-600 hover:underline">View Details</Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-500">No matching entity found.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Cctv;

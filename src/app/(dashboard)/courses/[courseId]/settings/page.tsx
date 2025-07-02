"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, AlertTriangle, Trash2, Archive, Globe, Lock, Settings, Users, BookOpen } from 'lucide-react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { config } from '@/lib/config';

interface CourseSettings {
  id: string;
  name: string;
  code?: string;
  section?: string;
  description?: string;
  department?: string;
  semester?: string;
  year?: number;
  is_public: boolean;
  is_active: boolean;
  allow_self_enrollment: boolean;
  max_enrollment?: number;
}

export default function CourseSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuth();
  const courseId = params.courseId as string;

  // State
  const [course, setCourse] = useState<CourseSettings | null>(null);
  const [originalCourse, setOriginalCourse] = useState<CourseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Danger zone modals
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Fetch course settings
  useEffect(() => {
    const fetchCourse = async () => {
      if (!token) return;
      
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(config.getApiUrl(`/api/courses/${courseId}`), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch course details');
        }

        const courseData = await response.json();
        const settings: CourseSettings = {
          id: courseData.id,
          name: courseData.name || '',
          code: courseData.code || '',
          section: courseData.section || '',
          description: courseData.description || '',
          department: courseData.department || '',
          semester: courseData.semester || '',
          year: courseData.year || new Date().getFullYear(),
          is_public: courseData.is_public || false,
          is_active: courseData.is_active !== false, // Default to true
          allow_self_enrollment: courseData.allow_self_enrollment || false,
          max_enrollment: courseData.max_enrollment || undefined,
        };
        
        setCourse(settings);
        setOriginalCourse({ ...settings });

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Error fetching course:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId, token]);

  // Check for changes
  useEffect(() => {
    if (course && originalCourse) {
      const changed = JSON.stringify(course) !== JSON.stringify(originalCourse);
      setHasChanges(changed);
    }
  }, [course, originalCourse]);

  // Handle input changes
  const handleInputChange = (field: keyof CourseSettings, value: string | number | boolean) => {
    if (!course) return;
    
    setCourse(prev => prev ? {
      ...prev,
      [field]: value
    } : null);
  };

  // Save changes
  const handleSave = async () => {
    if (!course || !hasChanges) return;

    setSaving(true);
    
    try {
      const response = await fetch(config.getApiUrl(`/api/courses/${courseId}`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(course),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update course');
      }

      const updatedCourse = await response.json();
      setOriginalCourse({ ...course });
      setHasChanges(false);
      alert('Course settings updated successfully!');

    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update course');
      console.error('Error updating course:', err);
    } finally {
      setSaving(false);
    }
  };

  // Handle archive course
  const handleArchiveCourse = async () => {
    try {
      const response = await fetch(config.getApiUrl(`/api/courses/${courseId}/archive`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to archive course');
      }

      alert('Course archived successfully!');
      router.push('/dashboard');

    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to archive course');
      console.error('Error archiving course:', err);
    } finally {
      setShowArchiveConfirm(false);
    }
  };

  // Handle delete course
  const handleDeleteCourse = async () => {
    if (deleteConfirmText !== course?.name) {
      alert('Please type the course name exactly to confirm deletion');
      return;
    }

    try {
      const response = await fetch(config.getApiUrl(`/api/courses/${courseId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete course');
      }

      alert('Course deleted successfully!');
      router.push('/dashboard');

    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete course');
      console.error('Error deleting course:', err);
    } finally {
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !course) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-8 text-center max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Course</h2>
            <p className="text-gray-600 mb-4">{error || 'Course not found'}</p>
            <button
              onClick={() => router.push(`/courses/${courseId}`)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Back to Course
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 2 + i);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push(`/courses/${courseId}`)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Course
            </button>

            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Settings className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Course Settings</h1>
                    <p className="text-gray-600">{course.name}</p>
                  </div>
                </div>
                
                {hasChanges && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  >
                    {saving ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    Save Changes
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Basic Information */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Basic Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Name *
                  </label>
                  <input
                    type="text"
                    value={course.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Introduction to Computer Science"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Code
                  </label>
                  <input
                    type="text"
                    value={course.code}
                    onChange={(e) => handleInputChange('code', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="CS101"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Section
                  </label>
                  <input
                    type="text"
                    value={course.section}
                    onChange={(e) => handleInputChange('section', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="A1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <input
                    type="text"
                    value={course.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Computer Science"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Semester
                  </label>
                  <select
                    value={course.semester}
                    onChange={(e) => handleInputChange('semester', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Semester</option>
                    <option value="Spring">Spring</option>
                    <option value="Summer">Summer</option>
                    <option value="Fall">Fall</option>
                    <option value="Winter">Winter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Year
                  </label>
                  <select
                    value={course.year || ''}
                    onChange={(e) => handleInputChange('year', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Year</option>
                    {years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={course.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Course description and objectives..."
                />
              </div>
            </div>

            {/* Privacy & Access Settings */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Privacy & Access</h2>
              
              <div className="space-y-6">
                <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    {course.is_public ? (
                      <Globe className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : (
                      <Lock className="w-5 h-5 text-gray-600 mt-0.5" />
                    )}
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {course.is_public ? 'Public Course' : 'Private Course'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {course.is_public 
                          ? 'Anyone can discover and join this course'
                          : 'Only invited students can access this course'
                        }
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={course.is_public}
                      onChange={(e) => handleInputChange('is_public', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-gray-900">Self-Enrollment</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Allow students to enroll themselves without invitation
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={course.allow_self_enrollment}
                      onChange={(e) => handleInputChange('allow_self_enrollment', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <BookOpen className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-gray-900">Course Active</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Students can access sessions and course materials
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={course.is_active}
                      onChange={(e) => handleInputChange('is_active', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {course.allow_self_enrollment && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Enrollment (Optional)
                    </label>
                    <input
                      type="number"
                      value={course.max_enrollment || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          // Handle empty string by setting to undefined in a different way
                          setCourse(prev => prev ? { ...prev, max_enrollment: undefined } : null);
                        } else {
                          handleInputChange('max_enrollment', parseInt(value));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Leave empty for unlimited"
                      min="1"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-l-4 border-red-500">
              <div className="flex items-center gap-3 mb-6">
                <AlertTriangle className="w-6 h-6 text-red-600" />
                <h2 className="text-2xl font-bold text-red-900">Danger Zone</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                  <div>
                    <h3 className="font-medium text-red-900">Archive Course</h3>
                    <p className="text-sm text-red-700 mt-1">
                      Hide this course from students while preserving all data
                    </p>
                  </div>
                  <button
                    onClick={() => setShowArchiveConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    <Archive className="w-4 h-4" />
                    Archive Course
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 border border-red-300 rounded-lg bg-red-100">
                  <div>
                    <h3 className="font-medium text-red-900">Delete Course</h3>
                    <p className="text-sm text-red-700 mt-1">
                      Permanently delete this course and all associated data
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Course
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <Archive className="w-6 h-6 text-yellow-600" />
              <h3 className="text-2xl font-bold text-gray-900">Archive Course</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to archive <strong>{course.name}</strong>? 
              This will hide the course from students, but all data will be preserved and you can restore it later.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveCourse}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                <Archive className="w-4 h-4" />
                Archive Course
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-2xl font-bold text-red-900">Delete Course</h3>
            </div>
            <p className="text-gray-600 mb-4">
              This action <strong>cannot be undone</strong>. This will permanently delete the course <strong>{course.name}</strong> and all associated sessions, student data, and content.
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type the course name to confirm: <span className="font-bold">{course.name}</span>
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder={course.name}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCourse}
                disabled={deleteConfirmText !== course.name}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
} 
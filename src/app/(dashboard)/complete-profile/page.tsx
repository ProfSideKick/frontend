"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { config } from '@/lib/config';

export default function CompleteProfilePage() {
  const router = useRouter();
  const { user, getToken, syncComplete } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', role: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim()) return setError('First name is required');
    if (!form.lastName.trim()) return setError('Last name is required');
    if (!form.username.trim() || form.username.length < 3)
      return setError('Username must be at least 3 characters');
    if (!form.role) return setError('Please select your role');

    try {
      setSaving(true);
      setError(null);
      const token = await getToken();
      if (!token) return;

      const response = await fetch(config.getApiUrl('/api/users/profile'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          username: form.username.trim(),
          role: form.role,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to update profile');
      }

      sessionStorage.removeItem('profile_completed');
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <img
            src="/images/logo.png"
            alt="ProfSidekick"
            className="w-12 h-12 object-contain mx-auto mb-4"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <h1 className="text-2xl font-bold text-blue-900 mb-2">Complete Your Profile</h1>
          <p className="text-gray-600">Just a few more details to get you started</p>
          {user?.email && <p className="text-sm text-gray-400 mt-1">{user.email}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                value={form.firstName}
                onChange={e => setForm(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Jane"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={e => setForm(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Doe"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="janedoe"
              minLength={3}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Min 3 characters, no spaces</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">I am a...</label>
            <div className="grid grid-cols-2 gap-3">
                <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, role: 'professor' }))}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                    form.role === 'professor'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                >
                <div className="text-2xl mb-1">👨‍🏫</div>
                <div className="font-medium">Professor</div>
                <div className="text-xs mt-1">Create and manage courses</div>
                </button>
                <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, role: 'student' }))}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                    form.role === 'student'
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                >
                <div className="text-2xl mb-1">🎓</div>
                <div className="font-medium">Student</div>
                <div className="text-xs mt-1">Join and attend sessions</div>
                </button>
            </div>
            </div>

          <button
            type="submit"
            disabled={saving || !syncComplete}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>Saving...</>
            ) : 'Complete Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";
import { useAuth } from '@/contexts/AuthContext';

export default function VerifyEmailPendingPage() {
  const { logout, user } = useAuth();
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">📧</span>
        </div>
        <h1 className="text-2xl font-bold text-blue-900 mb-2">Check Your Email</h1>
        <p className="text-gray-600 mb-2">
          We sent a verification link to:
        </p>
        <p className="font-medium text-blue-700 mb-6">{user?.email}</p>
        <p className="text-gray-500 text-sm mb-8">
          Click the link in the email to verify your account. 
          Once verified, log back in to complete your profile.
        </p>
        <button
          onClick={() => logout()}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
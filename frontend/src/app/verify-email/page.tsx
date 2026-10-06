'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { VerificationSessionError } from '@/context/AuthContext';
import Link from 'next/link';
import toast from 'react-hot-toast';
import authService from '@/services/auth.service';
import { Mail } from 'lucide-react';

export default function VerifyEmail() {
  return <Suspense fallback={<div className="shell page-section">Loading verification…</div>}><VerifyEmailForm /></Suspense>;
}

function VerifyEmailForm() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [signInRecovery, setSignInRecovery] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const searchParams = useSearchParams();
  const email = searchParams?.get('email');
  const { verifyOtp } = useAuth();

  useEffect(() => {
    try {
      const failure = sessionStorage.getItem('verificationEmailFailure');
      sessionStorage.removeItem('verificationEmailFailure');
      if (failure === 'EMAIL_RECIPIENT_RESTRICTED') {
        setRestricted(true);
         setError('Resend’s default test sender needs no domain, but it only sends to the email address on the Resend account. Use that inbox for testing, or verify a domain for other addresses.');
      } else if (failure === 'EMAIL_DELIVERY_UNAVAILABLE') setError('Verification email could not be sent. Please try resending a code.');
    } catch { /* Optional recovery hint. */ }
    if (!email) {
      window.location.href = '/signup';
    }
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [email]);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendDisabled && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (countdown === 0) {
      setResendDisabled(false);
    }
  }, [resendDisabled, countdown]);

  const handleChange = (index: number, value: string) => {
    // Allow only numbers
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (!/^\d{6}$/.test(pastedData)) return;

    const digits = pastedData.split('');
    setOtp(digits);
    inputRefs.current[5]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const otpString = otp.join('');
    if (otpString.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');
    setSignInRecovery(false);
    try {
      await verifyOtp(email, otpString);
      toast.success('Email verified successfully!');

    } catch (error: any) {
      setError(error.message || 'Verification failed');
      setSignInRecovery(error instanceof VerificationSessionError || error.code === 'EMAIL_ALREADY_VERIFIED');
      // Clear OTP fields on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email || resendDisabled || resending || restricted) return;
    setResending(true); setError('');
    try {
      const data = await authService.resendOtp(email);
      if (data.success) {
        toast.success('If eligible, a verification email was accepted for sending.');
        setResendDisabled(true);
        setCountdown(60);
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      if (error?.response?.data?.code === 'EMAIL_RECIPIENT_RESTRICTED') {
        setRestricted(true);
         setError('Resend’s default test sender needs no domain, but it only sends to the email address on the Resend account. Use that inbox for testing, or verify a domain for other addresses.');
      } else setError('Verification email could not be sent. Please try again later.');
    } finally { setResending(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8 bg-gray-800 p-8 rounded-xl">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Mail className="h-12 w-12 text-red-500" />
          </div>
          <h2 className="text-3xl font-bold text-white">Verify Your Email</h2>
          <p className="mt-2 text-gray-400">
            Enter the verification code for
          </p>
          <p className="text-red-500 font-medium">{email}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="flex justify-center space-x-3">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                name={`otp-${index}`}
                id={`otp-${index}`}
                inputMode="numeric"
                aria-label={`OTP digit ${index + 1}`}
                className="w-12 h-12 text-center text-xl font-semibold border border-gray-700 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                required
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>
        {error && <p role="alert" className="text-sm border border-[var(--line)] p-3">{error}</p>}
        {signInRecovery && <p className="text-sm text-gray-300">Already verified or unable to finish signing in? <Link href="/login" className="text-red-500 underline">Sign in</Link> to continue.</p>}

        <div className="text-center">
          <p className="text-gray-400">
            Didn&apos;t receive the code?{' '}
            <button
              onClick={handleResendOtp}
               disabled={resendDisabled || resending || restricted}
              className={`text-red-600 hover:text-red-500 ${resendDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
               {restricted ? 'Resend unavailable for this recipient' : resending ? 'Sending…' : resendDisabled
                ? `Resend in ${countdown}s` 
                : 'Resend code'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, redirect to dashboard
        navigate('/dashboard');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className="bg-white">
      <div className="relative isolate px-6 pt-4 lg:px-8 bg-gradient-to-r from-green-100 to-white">
        <div className="mx-auto max-w-2xl py-12 sm:py-20 lg:py-24">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Snap it, scrap it, save the Earth.
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Join our community in reducing e-waste and improving recyclability. Upload photos of your items,
              get instant AI-powered recycling recommendations, and earn points for making eco-friendly choices.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                to="/signup"
                className="rounded-md bg-green-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
              >
                Get started
              </Link>
              <Link to="/leaderboard" className="text-sm font-semibold leading-6 text-gray-900">
                View leaderboard <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="text-center">
                <div className="rounded-lg border-4 border-transparent bg-white p-6 bg-clip-padding border-gradient-to-r from-green-100 to-white">
                  <h3 className="text-base font-semibold leading-7 text-gray-900">Upload & Analyze</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Upload photos of items and get AI-powered recycling recommendations
                  </p>
                </div>
              </div>
              <div className="text-center">
                <div className="rounded-lg border-4 border-transparent bg-white p-6 bg-clip-padding border-gradient-to-r from-green-100 to-white">
                  <h3 className="text-base font-semibold leading-7 text-gray-900">Earn Points</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Get points for properly recycling items and climb the leaderboard
                  </p>
                </div>
              </div>
              <div className="text-center">
                <div className="rounded-lg border-4 border-transparent bg-white p-6 bg-clip-padding border-gradient-to-r from-green-100 to-white">
                  <h3 className="text-base font-semibold leading-7 text-gray-900">Join Community</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Connect with others and share recycling tips and experiences
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

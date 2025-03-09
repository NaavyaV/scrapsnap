import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Upload from './pages/Upload';
import Results from './pages/Results';
import VerifyDisposal from './pages/VerifyDisposal';
import Leaderboard from './pages/Leaderboard';
import Community from './pages/Community';
import Dashboard from './pages/Dashboard';
import MyItems from './pages/MyItems';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="flex flex-col h-screen overflow-hidden">
          <Navbar />
          <main className="flex-1 h-[calc(100vh-4rem)] overflow-auto">
            <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/upload" element={
              <PrivateRoute>
                <Upload />
              </PrivateRoute>
            } />
            <Route path="/results" element={
              <PrivateRoute>
                <Results />
              </PrivateRoute>
            } />
            <Route path="/verify" element={
              <PrivateRoute>
                <VerifyDisposal />
              </PrivateRoute>
            } />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/community" element={
              <PrivateRoute>
                <Community />
              </PrivateRoute>
            } />
            <Route path="/dashboard" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />
            <Route path="/my-items" element={
              <PrivateRoute>
                <MyItems />
              </PrivateRoute>
            } />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;

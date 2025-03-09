import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

import React, { ReactElement } from 'react';

interface PrivateRouteProps {
  children: ReactElement;
}

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const { currentUser } = useAuth();

  return currentUser ? children : <Navigate to="/login" />;
}

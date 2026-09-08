import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    /** If set, only users with this role (or admin) may enter. Others are redirected to their own dashboard. */
    requiredRole?: 'admin' | 'teacher';
}

/** Returns the "home" dashboard path for a given user. */
const getDashboardForUser = (user: { isAdmin?: boolean; role?: string } | null): string => {
    if (!user) return '/';
    if (user.isAdmin) return '/admin';
    if (user.role === 'teacher') return '/teacher';
    if (user.role === 'parent') return '/profiles';
    return '/dashboard';
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin text-brand-blue" size={48} />
            </div>
        );
    }

    // Not logged in → go home
    if (!user) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // Admin-only route: must have isAdmin flag
    if (requiredRole === 'admin') {
        if (!user.isAdmin) {
            return <Navigate to={getDashboardForUser(user)} replace />;
        }
    }

    // Teacher-only route: must have role === 'teacher' (admins are also allowed)
    if (requiredRole === 'teacher') {
        if (user.role !== 'teacher' && !user.isAdmin) {
            return <Navigate to={getDashboardForUser(user)} replace />;
        }
    }

    return <>{children}</>;
};

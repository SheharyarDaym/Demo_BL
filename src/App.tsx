import { Navigate, RouterProvider, createHashRouter, useParams } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { StoreProvider } from './state/store';
import { Layout } from './features/Layout';
import { DashboardPage } from './pages/Dashboard';
import { ImprovementsPage } from './pages/Improvements';
import { ComparePage } from './pages/Compare';
import { BusinessPage } from './pages/Business';
import { ProgressPage } from './pages/Progress';
import { MeasurementsPage } from './pages/Measurements';
import { HistoryPage } from './pages/History';

function LegacyRecommendation() {
  const { recId } = useParams();
  return <Navigate to={`/improvements?review=${recId}`} replace />;
}

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'improvements', element: <ImprovementsPage /> },
      { path: 'compare', element: <ComparePage /> },
      { path: 'business', element: <BusinessPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'progress/measurements', element: <MeasurementsPage /> },
      { path: 'progress/history', element: <HistoryPage /> },
      // Earlier demo routes keep working.
      { path: 'profile', element: <Navigate to="/business" replace /> },
      { path: 'competitors', element: <Navigate to="/compare" replace /> },
      { path: 'recommendations', element: <Navigate to="/improvements" replace /> },
      { path: 'recommendations/:recId', element: <LegacyRecommendation /> },
      { path: 'results', element: <Navigate to="/progress/measurements" replace /> },
      { path: 'activity', element: <Navigate to="/progress/history" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return (
    <ToastProvider>
      <StoreProvider>
        <RouterProvider router={router} />
      </StoreProvider>
    </ToastProvider>
  );
}

import ReactDOM from "react-dom/client";
import { AdminDashboard } from "./admin/AdminDashboard";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles/index.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <AdminDashboard />
  </ErrorBoundary>,
);

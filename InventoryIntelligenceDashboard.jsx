import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";

import { useAuth } from "./context/AuthContext";

import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Bell,
  Search,
  PackageX,
  Clock,
  X,
  RefreshCw,
} from "lucide-react";

/* =========================================================
   API CONFIGURATION
   ========================================================= */

const API_CONFIG = {
  baseUrl: `${import.meta.env.VITE_API_URL}/api`,

  endpoints: {
    medicines: "/medicines",
  },
};

/* =========================================================
   API HELPER
   ========================================================= */

async function apiGet(path, token) {
  if (!token) {
    throw new Error(
        "Authentication token not found. Please log in again."
    );
  }

  const response = await fetch(
      `${API_CONFIG.baseUrl}${path}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
          "Your login session has expired. Please log in again."
      );
    }

    if (response.status === 403) {
      throw new Error(
          "Access denied. Please check your account permissions."
      );
    }

    throw new Error(
        `Inventory API returned status ${response.status}.`
    );
  }

  return response.json();
}

/* =========================================================
   DATE HELPERS
   ========================================================= */

function parseDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDate(dateValue) {
  const date = parseDate(dateValue);

  if (!date) {
    return "—";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDaysUntilExpiry(dateValue) {
  const expiryDate = parseDate(dateValue);

  if (!expiryDate) {
    return null;
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const difference =
      expiryDate.getTime() - today.getTime();

  return Math.ceil(
      difference / (1000 * 60 * 60 * 24)
  );
}

/* =========================================================
   MEDICINE STATUS
   ========================================================= */

function getExpiryStatus(expiryDate) {
  const days = getDaysUntilExpiry(expiryDate);

  if (days === null) {
    return "valid";
  }

  if (days < 0) {
    return "expired";
  }

  if (days <= 30) {
    return "expiring";
  }

  return "valid";
}

/* =========================================================
   NORMALIZE BACKEND DATA
   ========================================================= */

function normalizeMedicine(medicine) {
  const quantity = Number(medicine.quantity ?? 0);

  const lowStockThreshold = Number(
      medicine.lowStockThreshold ??
      medicine.low_stock_threshold ??
      10
  );

  return {
    id: medicine.id,

    medicineName:
        medicine.medicineName ||
        medicine.medicine_name ||
        "Unnamed Medicine",

    batchNumber:
        medicine.batchNumber ||
        medicine.batch_number ||
        "—",

    category:
        medicine.category ||
        "Other",

    quantity: Number.isFinite(quantity)
        ? quantity
        : 0,

    lowStockThreshold:
        Number.isFinite(lowStockThreshold)
            ? lowStockThreshold
            : 10,

    expiryDate:
        medicine.expiryDate ||
        medicine.expiry_date ||
        null,

    price: Number(medicine.price ?? 0),

    supplier: medicine.supplier || null,
  };
}

/* =========================================================
   INVENTORY DATA HOOK
   ========================================================= */

function useInventoryData(token) {
  const [medicines, setMedicines] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const loadMedicines = useCallback(async () => {
    setLoading(true);

    setError("");

    try {
      const data = await apiGet(
          API_CONFIG.endpoints.medicines,
          token
      );

      let medicineList = [];

      if (Array.isArray(data)) {
        medicineList = data;
      } else if (Array.isArray(data.content)) {
        medicineList = data.content;
      } else if (Array.isArray(data.data)) {
        medicineList = data.data;
      } else if (Array.isArray(data.medicines)) {
        medicineList = data.medicines;
      }

      const normalized = medicineList.map(
          normalizeMedicine
      );

      setMedicines(normalized);
    } catch (err) {
      console.error(
          "Failed to load medicines:",
          err
      );

      setMedicines([]);

      setError(
          err?.message ||
          "Could not connect to the inventory API."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  return {
    medicines,
    loading,
    error,
    reload: loadMedicines,
  };
}

/* =========================================================
   STATUS LABEL
   ========================================================= */

function getStatusLabel(status) {
  if (status === "expired") {
    return "Expired";
  }

  if (status === "expiring") {
    return "Expiring Soon";
  }

  return "Valid";
}

/* =========================================================
   STATUS COLORS
   ========================================================= */

function getStatusClass(status) {
  if (status === "expired") {
    return "status-expired";
  }

  if (status === "expiring") {
    return "status-expiring";
  }

  return "status-valid";
}

/* =========================================================
   LOW STOCK LEVEL
   ========================================================= */

function getStockLevel(quantity, threshold) {
  if (quantity <= 0) {
    return "critical";
  }

  if (quantity <= threshold) {
    return "critical";
  }

  if (quantity <= threshold * 2) {
    return "low";
  }

  return "healthy";
}

/* =========================================================
   LOW STOCK PERCENTAGE
   ========================================================= */

function getStockPercentage(quantity, threshold) {
  if (!threshold || threshold <= 0) {
    return 100;
  }

  const percentage =
      (quantity / threshold) * 100;

  return Math.max(
      0,
      Math.min(100, Math.round(percentage))
  );
}

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export default function InventoryIntelligenceDashboard() {
  const { token } = useAuth();

  const {
    medicines,
    loading,
    error,
    reload,
  } = useInventoryData(token);

  /* =======================================================
     FILTER STATES
     ======================================================= */

  const [statusFilter, setStatusFilter] =
      useState("all");

  const [categoryFilter, setCategoryFilter] =
      useState("all");

  const [searchTerm, setSearchTerm] =
      useState("");

  /* =======================================================
     NOTIFICATION STATE
     ======================================================= */

  const [notificationOpen, setNotificationOpen] =
      useState(false);

  const [
    readNotifications,
    setReadNotifications,
  ] = useState(new Set());

  /* =======================================================
     STATUS FILTER HANDLER
     ======================================================= */

  const handleStatusFilter = useCallback(
      (status) => {
        setStatusFilter(status);
      },
      []
  );
  /* =======================================================
     ADD STATUS TO MEDICINES
     ======================================================= */

  const medicinesWithStatus = useMemo(() => {
    return medicines.map((medicine) => ({
      ...medicine,

      status: getExpiryStatus(
          medicine.expiryDate
      ),
    }));
  }, [medicines]);

  /* =======================================================
     CATEGORIES
     ======================================================= */

  const categories = useMemo(() => {
    const uniqueCategories = [
      ...new Set(
          medicinesWithStatus
              .map((medicine) => medicine.category)
              .filter(Boolean)
      ),
    ];

    return uniqueCategories.sort();
  }, [medicinesWithStatus]);

  /* =======================================================
     EXPIRY COUNTS
     ======================================================= */

  const expiryCounts = useMemo(() => {
    return {
      expired:
      medicinesWithStatus.filter(
          (medicine) =>
              medicine.status === "expired"
      ).length,

      expiring:
      medicinesWithStatus.filter(
          (medicine) =>
              medicine.status === "expiring"
      ).length,

      valid:
      medicinesWithStatus.filter(
          (medicine) =>
              medicine.status === "valid"
      ).length,
    };
  }, [medicinesWithStatus]);

  /* =======================================================
     LOW STOCK MEDICINES
     ======================================================= */

  const lowStockMedicines = useMemo(() => {
    return medicinesWithStatus
        .filter(
            (medicine) =>
                medicine.quantity <=
                medicine.lowStockThreshold
        )
        .sort(
            (a, b) =>
                a.quantity - b.quantity
        );
  }, [medicinesWithStatus]);

  /* =======================================================
     FILTER MEDICINES
     ======================================================= */

  const filteredMedicines = useMemo(() => {
    return medicinesWithStatus.filter(
        (medicine) => {
          const matchesStatus =
              statusFilter === "all" ||
              medicine.status === statusFilter;

          const matchesCategory =
              categoryFilter === "all" ||
              medicine.category === categoryFilter;

          const search =
              searchTerm
                  .trim()
                  .toLowerCase();

          const matchesSearch =
              !search ||
              medicine.medicineName
                  .toLowerCase()
                  .includes(search) ||
              medicine.batchNumber
                  .toLowerCase()
                  .includes(search);

          return (
              matchesStatus &&
              matchesCategory &&
              matchesSearch
          );
        }
    );
  }, [
    medicinesWithStatus,
    statusFilter,
    categoryFilter,
    searchTerm,
  ]);

  /* =======================================================
     NOTIFICATIONS
     ======================================================= */

  const notifications = useMemo(() => {
    const items = [];

    medicinesWithStatus.forEach(
        (medicine) => {
          if (medicine.status === "expired") {
            items.push({
              id: `expired-${medicine.id}`,

              type: "expired",

              title: `${medicine.medicineName} expired`,

              message: `Batch ${medicine.batchNumber} has expired.`,
            });
          } else if (
              medicine.status === "expiring"
          ) {
            items.push({
              id: `expiring-${medicine.id}`,

              type: "expiring",

              title: `${medicine.medicineName} expiring soon`,

              message: `Batch ${medicine.batchNumber} expires on ${formatDate(
                  medicine.expiryDate
              )}.`,
            });
          }

          if (
              medicine.quantity <=
              medicine.lowStockThreshold
          ) {
            items.push({
              id: `stock-${medicine.id}`,

              type: "stock",

              title: `${medicine.medicineName} is low on stock`,

              message: `${medicine.quantity} units remaining. Reorder threshold is ${medicine.lowStockThreshold}.`,
            });
          }
        }
    );

    return items;
  }, [medicinesWithStatus]);

  const unreadNotificationCount =
      notifications.filter(
          (notification) =>
              !readNotifications.has(
                  notification.id
              )
      ).length;

  /* =======================================================
     MARK NOTIFICATION READ
     ======================================================= */

  function markNotificationRead(id) {
    setReadNotifications((previous) => {
      const updated = new Set(previous);

      updated.add(id);

      return updated;
    });
  }

  /* =======================================================
     LOADING SCREEN
     ======================================================= */

  if (loading) {
    return (
        <div className="inventory-intelligence-page">
          <div className="inventory-loading">
            <RefreshCw
                size={28}
                className="loading-icon"
            />

            <h2>
              Loading inventory...
            </h2>

            <p>
              Fetching live medicine data from
              the backend.
            </p>
          </div>
        </div>
    );
  }

  /* =======================================================
     MAIN UI
     ======================================================= */

  return (
      <div className="inventory-intelligence-page">

        {/* =================================================
        HEADER
        ================================================= */}

        <div className="inventory-header">

          <div>
            <h1>
              Inventory Intelligence
            </h1>

            <p>
              Expiry tracking and stock alerts,
              live from inventory.
            </p>
          </div>

          <div className="inventory-header-actions">

            <button
                type="button"
                className="refresh-button"
                onClick={reload}
                title="Refresh inventory"
            >
              <RefreshCw size={18} />
              Refresh
            </button>

            <button
                type="button"
                className="notification-button"
                onClick={() =>
                    setNotificationOpen(
                        !notificationOpen
                    )
                }
            >
              <Bell size={20} />

              {unreadNotificationCount > 0 && (
                  <span className="notification-count">
                {unreadNotificationCount}
              </span>
              )}
            </button>

          </div>
        </div>

        {/* =================================================
        API ERROR
        ================================================= */}

        {error && (
            <div className="inventory-error">

              <AlertCircle size={20} />

              <div>
                <strong>
                  Could not load live inventory
                </strong>

                <p>
                  {error}
                </p>
              </div>

              <button
                  type="button"
                  onClick={reload}
              >
                Try Again
              </button>

            </div>
        )}

        {/* =================================================
        NOTIFICATION PANEL
        ================================================= */}

        {notificationOpen && (
            <div className="notification-panel">

              <div className="notification-panel-header">

                <h3>
                  Notifications
                </h3>

                <button
                    type="button"
                    onClick={() =>
                        setNotificationOpen(false)
                    }
                >
                  <X size={18} />
                </button>

              </div>

              {notifications.length === 0 ? (
                  <div className="empty-notifications">

                    <CheckCircle2 size={24} />

                    <p>
                      No inventory alerts.
                    </p>

                  </div>
              ) : (
                  notifications.map(
                      (notification) => (
                          <div
                              key={notification.id}
                              className={`notification-item ${
                                  readNotifications.has(
                                      notification.id
                                  )
                                      ? "notification-read"
                                      : ""
                              }`}
                              onClick={() =>
                                  markNotificationRead(
                                      notification.id
                                  )
                              }
                          >

                            {notification.type ===
                            "expired" ? (
                                <PackageX size={20} />
                            ) : notification.type ===
                            "expiring" ? (
                                <Clock size={20} />
                            ) : (
                                <AlertTriangle size={20} />
                            )}

                            <div>

                              <strong>
                                {notification.title}
                              </strong>

                              <p>
                                {notification.message}
                              </p>

                            </div>

                          </div>
                      )
                  )
              )}

            </div>
        )}

        {/* =================================================
        SUMMARY CARDS
        ================================================= */}

        <div className="expiry-overview">

          <div className="section-heading">

            <h2>
              Expiry Overview
            </h2>

          </div>

          <div className="overview-grid">

            {/* EXPIRED */}

            <div className="overview-card expired-card">

              <div className="overview-icon">
                <PackageX size={22} />
              </div>

              <div>

              <span>
                Expired
              </span>

                <strong>
                  {expiryCounts.expired}
                </strong>

              </div>

            </div>

            {/* EXPIRING */}

            <div className="overview-card expiring-card">

              <div className="overview-icon">
                <Clock size={22} />
              </div>

              <div>

              <span>
                Expiring Soon
              </span>

                <strong>
                  {expiryCounts.expiring}
                </strong>

              </div>

            </div>

            {/* VALID */}

            <div className="overview-card valid-card">

              <div className="overview-icon">
                <CheckCircle2 size={22} />
              </div>

              <div>

              <span>
                Valid
              </span>

                <strong>
                  {expiryCounts.valid}
                </strong>

              </div>

            </div>

          </div>
        </div>

        {/* =================================================
        MEDICINES
        ================================================= */}

        <div className="medicines-section">

          <div className="section-heading">

            <h2>
              Medicines
            </h2>

            <span>
            {filteredMedicines.length} medicine
              {filteredMedicines.length !== 1
                  ? "s"
                  : ""}
          </span>

          </div>

          {/* FILTER BAR */}

          <div className="medicine-filters">

            {/* SEARCH */}

            <div className="search-box">

              <Search size={18} />

              <input
                  type="text"
                  placeholder="Search medicine or batch..."
                  value={searchTerm}
                  onChange={(event) =>
                      setSearchTerm(
                          event.target.value
                      )
                  }
              />

            </div>

            {/* STATUS FILTERS */}
            <div className="filter-buttons">
              <button
                  type="button"
                  className={statusFilter === "all" ? "active" : ""}
                  onClick={() => handleStatusFilter("all")}
              >
                All statuses
              </button>

              <button
                  type="button"
                  className={statusFilter === "expired" ? "active" : ""}
                  onClick={() => handleStatusFilter("expired")}
              >
                Expired
              </button>

              <button
                  type="button"
                  className={statusFilter === "expiring" ? "active" : ""}
                  onClick={() => handleStatusFilter("expiring")}
              >
                Expiring soon
              </button>

              <button
                  type="button"
                  className={statusFilter === "valid" ? "active" : ""}
                  onClick={() => handleStatusFilter("valid")}
              >
                Valid
              </button>
            </div>
            {/* CATEGORY */}

            <select
                value={categoryFilter}
                onChange={(event) =>
                    setCategoryFilter(
                        event.target.value
                    )
                }
            >
              <option value="all">
                All categories
              </option>

              {categories.map(
                  (category) => (
                      <option
                          key={category}
                          value={category}
                      >
                        {category}
                      </option>
                  )
              )}

            </select>

          </div>

          {/* MEDICINE TABLE */}

          <div className="medicine-table-container">

            <table className="medicine-table">

              <thead>
              <tr>

                <th>
                  Medicine
                </th>

                <th>
                  Batch
                </th>

                <th>
                  Expiry
                </th>

                <th>
                  Stock
                </th>

                <th>
                  Status
                </th>

              </tr>
              </thead>

              <tbody>

              {filteredMedicines.length === 0 ? (
                  <tr>

                    <td
                        colSpan="5"
                        className="empty-table"
                    >
                      {error
                          ? "Live inventory could not be loaded."
                          : "No medicines found."}
                    </td>

                  </tr>
              ) : (
                  filteredMedicines.map(
                      (medicine) => (
                          <tr key={medicine.id}>

                            <td>
                              <strong>
                                {
                                  medicine.medicineName
                                }
                              </strong>
                            </td>

                            <td>
                              {
                                medicine.batchNumber
                              }
                            </td>

                            <td>
                              {formatDate(
                                  medicine.expiryDate
                              )}
                            </td>

                            <td>
                              {medicine.quantity}
                            </td>

                            <td>

                        <span
                            className={`status-badge ${getStatusClass(
                                medicine.status
                            )}`}
                        >
                          {getStatusLabel(
                              medicine.status
                          )}
                        </span>

                            </td>

                          </tr>
                      )
                  )
              )}

              </tbody>

            </table>

          </div>

        </div>

        {/* =================================================
        LOW STOCK
        ================================================= */}

        <div className="low-stock-section">

          <div className="section-heading">

            <h2>
              Low Stock ({lowStockMedicines.length})
            </h2>

          </div>

          {lowStockMedicines.length === 0 ? (
              <div className="no-low-stock">

                <CheckCircle2 size={24} />

                <div>

                  <strong>
                    Stock levels look healthy
                  </strong>

                  <p>
                    No medicines are currently
                    below their reorder threshold.
                  </p>

                </div>

              </div>
          ) : (
              <div className="low-stock-grid">

                {lowStockMedicines.map(
                    (medicine) => {
                      const stockLevel =
                          getStockLevel(
                              medicine.quantity,
                              medicine.lowStockThreshold
                          );

                      const stockPercentage =
                          getStockPercentage(
                              medicine.quantity,
                              medicine.lowStockThreshold
                          );

                      return (
                          <div
                              key={medicine.id}
                              className="low-stock-card"
                          >

                            <div className="low-stock-card-top">

                              <div>

                                <h3>
                                  {
                                    medicine.medicineName
                                  }
                                </h3>

                                <p>
                                  Batch{" "}
                                  {
                                    medicine.batchNumber
                                  }
                                </p>

                              </div>

                              <span
                                  className={`stock-level ${stockLevel}`}
                              >
                        {stockLevel ===
                        "critical"
                            ? "Critical"
                            : "Low"}
                      </span>

                            </div>

                            <div className="stock-information">

                              <strong>
                                {medicine.quantity}
                              </strong>

                              <span>
                        in stock
                      </span>

                            </div>

                            <div className="stock-progress">

                              <div className="stock-progress-header">

                        <span>
                          Stock level
                        </span>

                                <span>
                          {stockPercentage}%
                        </span>

                              </div>

                              <div className="stock-progress-track">

                                <div
                                    className="stock-progress-fill"
                                    style={{
                                      width: `${stockPercentage}%`,
                                    }}
                                />

                              </div>

                            </div>

                            <p className="reorder-text">

                              Reorder at{" "}

                              <strong>
                                {
                                  medicine.lowStockThreshold
                                }
                              </strong>

                              {" "}units

                            </p>

                          </div>
                      );
                    }
                )}

              </div>
          )}

        </div>

      </div>
  );
}
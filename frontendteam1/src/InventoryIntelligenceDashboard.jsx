
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
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

/**
 * ============================================================
 * INVENTORY INTELLIGENCE DASHBOARD
 * ============================================================
 *
 * Uses the REAL MediStock medicines API.
 *
 * Backend:
 * 
 *
 * No demo/fake data is used.
 */

// ------------------------------------------------------------
// 1. API CONFIG
// ------------------------------------------------------------

const API_CONFIG = {
  baseUrl: `${import.meta.env.VITE_API_URL}/api`,

  endpoints: {
    medicines: "/medicines",
  },
};

// ------------------------------------------------------------
// 2. API GET
// ------------------------------------------------------------

async function apiGet(path, token)
{

    console.log("Inventory API URL:", `${API_CONFIG.baseUrl}${path}`);

    const res = await fetch(`${API_CONFIG.baseUrl}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",

      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status}`);
  }

  return res.json();
}

// ------------------------------------------------------------
// 3. DATE / STATUS HELPERS
// ------------------------------------------------------------

function daysUntil(dateStr) {
  if (!dateStr) return null;

  const today = new Date();
  const target = new Date(dateStr);

  return Math.ceil(
    (target - today) / (1000 * 60 * 60 * 24)
  );
}

function deriveStatus(dateStr, soonWindowDays = 30) {
  const days = daysUntil(dateStr);

  if (days === null) {
    return "valid";
  }

  if (days < 0) {
    return "expired";
  }

  if (days <= soonWindowDays) {
    return "expiring_soon";
  }

  return "valid";
}

// ------------------------------------------------------------
// 4. NORMALIZE BACKEND MEDICINE DATA
// ------------------------------------------------------------

function normalizeMedicine(medicine) {
  const name =
    medicine.medicineName ??
    medicine.name ??
    "Unnamed Medicine";

  const batch =
    medicine.batchNumber ??
    medicine.batch ??
    "N/A";

  const category =
    medicine.category ??
    "Uncategorized";

  const stock = Number(
    medicine.quantity ??
    medicine.stock ??
    0
  );

  const reorderLevel = Number(
    medicine.lowStockThreshold ??
    medicine.low_stock_threshold ??
    medicine.reorderLevel ??
    10
  );

  const expiryDate =
    medicine.expiryDate ??
    medicine.expiry_date ??
    null;

  return {
    ...medicine,

    id: medicine.id,

    name,
    batch,
    category,
    stock,
    reorderLevel,
    expiryDate,

    status: deriveStatus(expiryDate),
  };
}

// ------------------------------------------------------------
// 5. INVENTORY DATA HOOK
// ------------------------------------------------------------

function useInventoryData(token) {
  const [medicines, setMedicines] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiGet(
        API_CONFIG.endpoints.medicines,
        token
      );

      /*
       * Depending on your Spring Boot response,
       * medicines may be returned as:
       *
       * [...]
       *
       * or:
       *
       * { content: [...] }
       *
       * or:
       *
       * { medicines: [...] }
       */

      const medicineList = Array.isArray(data)
        ? data
        : data?.content ||
          data?.medicines ||
          [];

      const normalizedMedicines =
        medicineList.map(normalizeMedicine);

      setMedicines(normalizedMedicines);

      // ------------------------------------------------------
      // Generate notifications from REAL database data
      // ------------------------------------------------------

      const generatedNotifications = [];

      normalizedMedicines.forEach((medicine) => {
        if (
          medicine.stock <=
          medicine.reorderLevel
        ) {
          generatedNotifications.push({
            id: `low-${medicine.id}`,
            type: "low_stock",
            message: `${medicine.name} is low in stock (${medicine.stock}/${medicine.reorderLevel}).`,
read: false,
});
}

const days = daysUntil(
    medicine.expiryDate
);

if (days !== null) {
  if (days < 0) {
    generatedNotifications.push({
      id: `expired-${medicine.id}`,
      type: "expired",
      message: `${medicine.name} has expired.`,
      read: false,
    });
  } else if (days <= 30) {
    generatedNotifications.push({
      id: `expiry-${medicine.id}`,
      type: "expiring_soon",
      message: `${medicine.name} expires in ${days} day${
          days === 1 ? "" : "s"
      }.`,
      read: false,
    });
  }
}
});

setNotifications(
    generatedNotifications
);
} catch (err) {
  console.error(
      "Inventory API error:",
      err
  );

  setError(
      err.message ||
      "Unable to load inventory."
  );

  // IMPORTANT:
  // Do NOT show fake/demo medicines.
  setMedicines([]);
  setNotifications([]);
} finally {
  setLoading(false);
}
}, [token]);

useEffect(() => {
  load();
}, [load]);

return {
  medicines,
  notifications,
  loading,
  error,
  reload: load,
};
}

// ------------------------------------------------------------
// 6. STATUS META
// ------------------------------------------------------------

const STATUS_META = {
  expired: {
    label: "Expired",
    color: "#B3261E",
    bg: "#FDECEA",
    icon: AlertCircle,
  },

  expiring_soon: {
    label: "Expiring Soon",
    color: "#95600A",
    bg: "#FFF4DE",
    icon: AlertTriangle,
  },

  valid: {
    label: "Valid",
    color: "#1B7A4C",
    bg: "#E9F7EF",
    icon: CheckCircle2,
  },
};

// ------------------------------------------------------------
// 7. STATUS BADGE
// ------------------------------------------------------------

function StatusBadge({ status }) {
  const meta =
      STATUS_META[status] ||
      STATUS_META.valid;

  const Icon = meta.icon;

  return (
      <span
          style={{
            color: meta.color,
            backgroundColor: meta.bg,
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      >
      <Icon
          size={13}
          strokeWidth={2.5}
      />

        {meta.label}
    </span>
  );
}

// ------------------------------------------------------------
// 8. STAT CARD
// ------------------------------------------------------------

function StatCard({
                    label,
                    value,
                    color,
                    Icon,
                  }) {
  return (
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p
              className="mt-1 text-3xl font-semibold tabular-nums"
              style={{ color }}
          >
            {value}
          </p>
        </div>

        <div
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{
              backgroundColor: `${color}1A`,
            }}
        >
          <Icon
              size={20}
              color={color}
              strokeWidth={2.25}
          />
        </div>
      </div>
  );
}

// ------------------------------------------------------------
// 9. NOTIFICATION PANEL
// ------------------------------------------------------------

function NotificationPanel({
                             notifications,
                             open,
                             onClose,
                           }) {
  const panelRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
          panelRef.current &&
          !panelRef.current.contains(e.target)
      ) {
        onClose();
      }
    }

    if (open) {
      document.addEventListener(
          "mousedown",
          handleClickOutside
      );
    }

    return () => {
      document.removeEventListener(
          "mousedown",
          handleClickOutside
      );
    };
  }, [open, onClose]);

  if (!open) return null;

  const typeIcon = {
    expired: AlertCircle,
    low_stock: PackageX,
    expiring_soon: AlertTriangle,
  };

  const typeColor = {
    expired: "#B3261E",
    low_stock: "#7C4A03",
    expiring_soon: "#95600A",
  };

  return (
      <div
          ref={panelRef}
          className="absolute right-0 top-12 z-20 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Notifications
          </h3>

          <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                No current alerts.
              </p>
          ) : (
              notifications.map((n) => {
                const Icon =
                    typeIcon[n.type] ||
                    Bell;

                return (
                    <div
                        key={n.id}
                        className="flex items-start gap-3 border-b border-slate-50 px-4 py-3"
                    >
                      <Icon
                          size={16}
                          color={
                              typeColor[n.type] ||
                              "#64748B"
                          }
                          className="mt-0.5 shrink-0"
                      />

                      <p className="text-sm text-slate-700">
                        {n.message}
                      </p>
                    </div>
                );
              })
          )}
        </div>
      </div>
  );
}

// ------------------------------------------------------------
// 10. LOW STOCK CARD
// ------------------------------------------------------------

function LowStockCard({ item }) {
  const pct = Math.min(
      100,
      Math.round(
          (item.stock /
              Math.max(
                  item.reorderLevel,
                  1
              )) *
          100
      )
  );

  const critical =
      item.stock <=
      item.reorderLevel * 0.4;

  return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {item.name}
            </p>

            <p className="text-xs text-slate-400">
              Batch {item.batch}
            </p>
          </div>

          <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                color: critical
                    ? "#B3261E"
                    : "#95600A",

                backgroundColor: critical
                    ? "#FDECEA"
                    : "#FFF4DE",
              }}
          >
          {critical
              ? "Critical"
              : "Low"}
        </span>
        </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
  <span>
    {item.stock} in stock{" "}
      <span className="text-slate-300">/</span>{" "}
      reorder at {item.reorderLevel}
  </span>

              <span className="ml-2">{pct}%</span>
          </div>

        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                backgroundColor: critical
                    ? "#B3261E"
                    : "#E0A415",
              }}
          />
        </div>
      </div>
  );
}

// ------------------------------------------------------------
// 11. MAIN DASHBOARD
// ------------------------------------------------------------

export default function InventoryIntelligenceDashboard() {
  const { token } = useAuth();

  const {
    medicines,
    notifications,
    loading,
    error,
    reload,
  } = useInventoryData(token);

  const [notifOpen, setNotifOpen] =
      useState(false);

  const [search, setSearch] =
      useState("");

  const [statusFilter, setStatusFilter] =
      useState("all");

  const [categoryFilter, setCategoryFilter] =
      useState("all");

  // ----------------------------------------------------------
  // Categories
  // ----------------------------------------------------------

  const categories = useMemo(
      () => [
        "all",
        ...Array.from(
            new Set(
                medicines
                    .map((m) => m.category)
                    .filter(Boolean)
            )
        ).sort(),
      ],
      [medicines]
  );

  // ----------------------------------------------------------
  // Expiry counts
  // ----------------------------------------------------------

  const counts = useMemo(
      () => ({
        expired: medicines.filter(
            (m) =>
                m.status === "expired"
        ).length,

        expiring_soon:
        medicines.filter(
            (m) =>
                m.status ===
                "expiring_soon"
        ).length,

        valid: medicines.filter(
            (m) =>
                m.status === "valid"
        ).length,
      }),
      [medicines]
  );

  // ----------------------------------------------------------
  // Low stock
  // ----------------------------------------------------------

  const lowStockItems = useMemo(
      () =>
          medicines
              .filter(
                  (m) =>
                      m.stock <=
                      m.reorderLevel
              )
              .sort(
                  (a, b) =>
                      a.stock - b.stock
              ),
      [medicines]
  );

  // ----------------------------------------------------------
  // Notifications
  // ----------------------------------------------------------

  const unreadCount =
      notifications.length;

  // ----------------------------------------------------------
  // Search + filters
  // ----------------------------------------------------------

  const filteredMedicines =
      useMemo(() => {
        return medicines
            .filter((m) =>
                statusFilter === "all"
                    ? true
                    : m.status ===
                    statusFilter
            )

            .filter((m) =>
                categoryFilter === "all"
                    ? true
                    : m.category ===
                    categoryFilter
            )

            .filter((m) =>
                search.trim() === ""
                    ? true
                    : `${m.name} ${m.batch} ${m.category}`
                        .toLowerCase()
                        .includes(
                            search
                                .trim()
                                .toLowerCase()
                        )
            )

            .sort(
                (a, b) =>
                    new Date(
                        a.expiryDate
                    ) -
                    new Date(
                        b.expiryDate
                    )
            );
      }, [
        medicines,
        statusFilter,
        categoryFilter,
        search,
      ]);

  // ----------------------------------------------------------
  // UI
  // ----------------------------------------------------------

  return (
      <div className="min-h-full w-full bg-slate-50 p-6">

        {/* Header */}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Inventory Intelligence
            </h1>

            <p className="text-sm text-slate-500">
              Expiry tracking and stock
              alerts, live from inventory.
            </p>
          </div>

          <div className="flex items-center gap-2">

            {/* Refresh */}

            <button
                onClick={reload}
                disabled={loading}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                title="Refresh inventory"
            >
              <RefreshCw
                  size={17}
                  className={
                    loading
                        ? "animate-spin"
                        : ""
                  }
              />
            </button>

            {/* Notifications */}

            <div className="relative">
              <button
                  onClick={() =>
                      setNotifOpen(
                          (v) => !v
                      )
                  }
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                  aria-label="Notifications"
              >
                <Bell size={18} />

                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                  {unreadCount}
                </span>
                )}
              </button>

              <NotificationPanel
                  notifications={
                    notifications
                  }
                  open={notifOpen}
                  onClose={() =>
                      setNotifOpen(false)
                  }
              />
            </div>
          </div>
        </div>

        {/* API Error */}

        {error && !loading && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <strong>
                Inventory API error:
              </strong>{" "}
              {error}
            </div>
        )}

        {/* Expiry Overview */}

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Expiry Overview
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

            <StatCard
                label="Expired"
                value={
                  loading
                      ? "—"
                      : counts.expired
                }
                color="#B3261E"
                Icon={AlertCircle}
            />

            <StatCard
                label="Expiring Soon"
                value={
                  loading
                      ? "—"
                      : counts.expiring_soon
                }
                color="#95600A"
                Icon={AlertTriangle}
            />

            <StatCard
                label="Valid"
                value={
                  loading
                      ? "—"
                      : counts.valid
                }
                color="#1B7A4C"
                Icon={CheckCircle2}
            />

          </div>
        </section>

        {/* Main Grid */}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Medicine List */}

          <div className="lg:col-span-2">

            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Medicines
              </h2>

              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">

                {/* Search */}

                <div className="relative">
                  <Search
                      size={15}
                      className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400"
                  />

                  <input
                      value={search}
                      onChange={(e) =>
                          setSearch(
                              e.target.value
                          )
                      }
                      placeholder="Search name, batch, category"
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 sm:w-56"
                  />
                </div>

                {/* Status */}

                <select
                    value={
                      statusFilter
                    }
                    onChange={(e) =>
                        setStatusFilter(
                            e.target.value
                        )
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none"
                >
                  <option value="all">
                    All statuses
                  </option>

                  <option value="expired">
                    Expired
                  </option>

                  <option value="expiring_soon">
                    Expiring soon
                  </option>

                  <option value="valid">
                    Valid
                  </option>
                </select>

                {/* Category */}

                <select
                    value={
                      categoryFilter
                    }
                    onChange={(e) =>
                        setCategoryFilter(
                            e.target.value
                        )
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none"
                >
                  {categories.map(
                      (c) => (
                          <option
                              key={c}
                              value={c}
                          >
                            {c === "all"
                                ? "All categories"
                                : c}
                          </option>
                      )
                  )}
                </select>

              </div>
            </div>

            {/* Table */}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

              <div className="overflow-x-auto">

                <table className="w-full text-left text-sm">

                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">

                  <tr>
                    <th className="px-4 py-3 font-medium">
                      Medicine
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Batch
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Expiry
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Stock
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Status
                    </th>
                  </tr>

                  </thead>

                  <tbody>

                  {loading ? (
                      <tr>
                        <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-slate-400"
                        >
                          Loading inventory…
                        </td>
                      </tr>
                  ) : filteredMedicines.length === 0 ? (
                      <tr>
                        <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-slate-400"
                        >
                          {error
                              ? "Unable to load inventory from the backend."
                              : "No medicines found."}
                        </td>
                      </tr>
                  ) : (
                      filteredMedicines.map(
                          (m) => (
                              <tr
                                  key={m.id}
                                  className="border-t border-slate-100 hover:bg-slate-50"
                              >
                                <td className="px-4 py-3 font-medium text-slate-800">
                                  {m.name}
                                </td>

                                <td className="px-4 py-3 text-slate-500">
                                  {m.batch}
                                </td>

                                <td className="px-4 py-3 text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock
                                  size={13}
                                  className="text-slate-400"
                              />

                              {m.expiryDate
                                  ? new Date(
                                      m.expiryDate
                                  ).toLocaleDateString(
                                      undefined,
                                      {
                                        year: "numeric",
                                        month:
                                            "short",
                                        day: "numeric",
                                      }
                                  )
                                  : "N/A"}
                            </span>
                                </td>

                                <td className="px-4 py-3 text-slate-500">
                                  {m.stock}
                                </td>

                                <td className="px-4 py-3">
                                  <StatusBadge
                                      status={
                                        m.status
                                      }
                                  />
                                </td>
                              </tr>
                          )
                      )
                  )}

                  </tbody>

                </table>

              </div>
            </div>
          </div>

          {/* Low Stock */}

          <div>

            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Low Stock (
              {loading
                  ? "…"
                  : lowStockItems.length}
              )
            </h2>

            <div className="flex flex-col gap-3">

              {loading ? (
                  <p className="text-sm text-slate-400">
                    Loading…
                  </p>
              ) : lowStockItems.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400 shadow-sm">
                    All medicines are above
                    their reorder level.
                  </div>
              ) : (
                  lowStockItems.map(
                      (item) => (
                          <LowStockCard
                              key={item.id}
                              item={item}
                          />
                      )
                  )
              )}

            </div>
          </div>

        </div>
      </div>
  );
}

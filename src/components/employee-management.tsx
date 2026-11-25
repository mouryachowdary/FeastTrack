import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  createEmployee,
  listEmployeeActivity,
  listEmployees,
  sendEmployeePasswordReset,
  setEmployeeAccess,
  updateEmployeeProfile,
  updateEmployeeRole,
  type EmployeeAccount,
  type EmployeeActivity,
} from "@/lib/employee-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function formatTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not recorded (open or interrupted)";
}

export function EmployeeManagement() {
  const [employees, setEmployees] = useState<EmployeeAccount[]>([]);
  const [activity, setActivity] = useState<EmployeeActivity[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [activityError, setActivityError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState("");
  const [editedNames, setEditedNames] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    initialPassword: "",
  });

  const loadEmployees = useCallback(async () => {
    setIsLoadingEmployees(true);
    try {
      setEmployees(await listEmployees());
    } catch (error) {
      console.error("Could not load employee management data", error);
      toast.error(errorMessage(error));
    } finally {
      setIsLoadingEmployees(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    setIsLoadingActivity(true);
    try {
      setActivity(await listEmployeeActivity());
      setActivityError("");
    } catch (error) {
      console.error("Could not load employee activity", error);
      setActivityError(errorMessage(error));
    } finally {
      setIsLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
    void loadActivity();
  }, [loadActivity, loadEmployees]);

  async function submitEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createEmployee({ data: form });
      toast.success("Employee account created.");
      setForm({ email: "", fullName: "", initialPassword: "" });
      await loadEmployees();
    } catch (error) {
      console.error("Could not create employee account", error);
      toast.error(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function changeRole(employee: EmployeeAccount, role: "admin" | "employee") {
    if (employee.role === role) return;
    setBusyUserId(employee.id);
    try {
      await updateEmployeeRole({ data: { userId: employee.id, role } });
      toast.success("Employee role updated.");
      await loadEmployees();
    } catch (error) {
      console.error("Could not update employee role", error);
      toast.error(errorMessage(error));
    } finally {
      setBusyUserId("");
    }
  }

  async function saveName(employee: EmployeeAccount) {
    const fullName = (editedNames[employee.id] ?? employee.fullName).trim();
    if (!fullName || fullName === employee.fullName) return;
    setBusyUserId(employee.id);
    try {
      await updateEmployeeProfile({ data: { userId: employee.id, fullName } });
      toast.success("Employee name updated.");
      setEditedNames((current) => {
        const next = { ...current };
        delete next[employee.id];
        return next;
      });
      await loadEmployees();
    } catch (error) {
      console.error("Could not update employee name", error);
      toast.error(errorMessage(error));
    } finally {
      setBusyUserId("");
    }
  }

  async function changeAccess(employee: EmployeeAccount) {
    setBusyUserId(employee.id);
    try {
      await setEmployeeAccess({
        data: { userId: employee.id, active: !employee.active },
      });
      toast.success(employee.active ? "Employee access deactivated." : "Employee access restored.");
      await loadEmployees();
    } catch (error) {
      console.error("Could not change employee access", error);
      toast.error(errorMessage(error));
    } finally {
      setBusyUserId("");
    }
  }

  async function resetPassword(email: string) {
    setBusyUserId(email);
    try {
      await sendEmployeePasswordReset({ data: { email } });
      toast.success("Password reset email sent.");
    } catch (error) {
      console.error("Could not send employee password reset", error);
      toast.error(errorMessage(error));
    } finally {
      setBusyUserId("");
    }
  }

  return (
    <section
      id="employee-management"
      className="mt-10 scroll-mt-6 rounded-xl border border-border bg-card p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase text-muted-foreground">Administrator tools</p>
          <h2 className="font-display text-4xl text-primary">Employees</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Activity shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}.
        </p>
      </div>

      <form
        className="mt-5 grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={submitEmployee}
      >
        <Input
          type="text"
          placeholder="Full name"
          autoComplete="name"
          maxLength={150}
          value={form.fullName}
          onChange={(event) => setForm({ ...form, fullName: event.target.value })}
          disabled={isSubmitting}
          required
        />
        <Input
          type="email"
          placeholder="Actual email address"
          autoComplete="email"
          maxLength={254}
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          disabled={isSubmitting}
          required
        />
        <Input
          type="password"
          placeholder="Initial password (8–14 characters)"
          autoComplete="new-password"
          minLength={8}
          maxLength={14}
          value={form.initialPassword}
          onChange={(event) => setForm({ ...form, initialPassword: event.target.value })}
          disabled={isSubmitting}
          required
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create employee"}
        </Button>
      </form>

      <h3 className="mt-8 font-display text-3xl">Accounts</h3>
      {isLoadingEmployees ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading employee accounts…</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted font-mono text-xs uppercase text-muted-foreground">
              <tr>
                {["Name", "Email", "Role", "Created", "Access", "Actions"].map((heading) => (
                  <th key={heading} className="px-3 py-3 text-left">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-t border-border">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label={`Full name for ${employee.email}`}
                        className="min-w-36"
                        maxLength={150}
                        value={editedNames[employee.id] ?? employee.fullName}
                        onChange={(event) =>
                          setEditedNames((current) => ({
                            ...current,
                            [employee.id]: event.target.value,
                          }))
                        }
                        disabled={busyUserId === employee.id}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          busyUserId === employee.id ||
                          !(editedNames[employee.id] ?? employee.fullName).trim() ||
                          (editedNames[employee.id] ?? employee.fullName).trim() ===
                            employee.fullName
                        }
                        onClick={() => void saveName(employee)}
                      >
                        Save
                      </Button>
                    </div>
                  </td>
                  <td className="px-3 py-3">{employee.email || "Email unavailable"}</td>
                  <td className="px-3 py-3">
                    <select
                      aria-label={`Role for ${employee.fullName || employee.email}`}
                      className="h-9 rounded-md border border-input bg-card px-2"
                      value={employee.role}
                      disabled={
                        busyUserId === employee.id || !["admin", "employee"].includes(employee.role)
                      }
                      onChange={(event) => {
                        if (event.target.value === "admin" || event.target.value === "employee") {
                          void changeRole(employee, event.target.value);
                        }
                      }}
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">{formatTime(employee.createdAt)}</td>
                  <td className="px-3 py-3">{employee.active ? "Active" : "Deactivated"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          !employee.email ||
                          busyUserId === employee.id ||
                          busyUserId === employee.email
                        }
                        onClick={() => void resetPassword(employee.email)}
                      >
                        Reset password
                      </Button>
                      {employee.role === "employee" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyUserId === employee.id}
                          onClick={() => void changeAccess(employee)}
                        >
                          {employee.active ? "Deactivate" : "Reactivate"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No employee profiles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mt-8 font-display text-3xl">Login activity</h3>
      {activityError ? (
        <p className="mt-3 text-sm text-destructive">
          Activity is unavailable. Apply the standalone employee activity SQL script to enable it.
        </p>
      ) : isLoadingActivity ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading activity…</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted font-mono text-xs uppercase text-muted-foreground">
              <tr>
                {["Employee", "Email", "Login", "Logout"].map((heading) => (
                  <th key={heading} className="px-3 py-3 text-left">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="px-3 py-3">{entry.fullName}</td>
                  <td className="px-3 py-3">{entry.email || "Email unavailable"}</td>
                  <td className="px-3 py-3">{formatTime(entry.loginAt)}</td>
                  <td className="px-3 py-3">{formatTime(entry.logoutAt)}</td>
                </tr>
              ))}
              {activity.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    No recorded login sessions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

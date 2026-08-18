export type EmployeeDepartment = "Front Desk" | "Housekeeping" | "Management" | "Accounting" | "Maintenance";
export interface EmployeeRecord {
  id: string; employeeCode: string; name: string; role: string; department: EmployeeDepartment;
  phone: string; shift: "Morning" | "Evening" | "Night" | "Flexible"; status: "on_duty" | "off_duty" | "on_leave";
}
export interface ReportDefinition { id: string; title: string; description: string; category: "Operations" | "Revenue" | "Guests" | "Finance"; updatedLabel: string }
export interface SystemUser { id: string; name: string; email: string; role: string; status: "active" | "invited" | "disabled"; lastActive: string }

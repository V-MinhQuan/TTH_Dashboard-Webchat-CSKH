import { buildApiUrl, fetchApiJson } from "./dashboardApi";

interface ActivityLog {
  id: string;
  action_type: string;
  entity: string;
  details: string;
  time: string;
  date_str: string;
  created_at: string;
}

export const fetchActivityLogs = async (
  limit: number = 50,
  offset: number = 0,
  startDate?: string,
  endDate?: string,
): Promise<{ data: ActivityLog[], total: number }> => {
  try {
    const url = buildApiUrl("/api/activity", {
      limit,
      offset,
      ...(startDate ? { start_date: startDate } : {}),
      ...(endDate ? { end_date: endDate } : {}),
    });
    // The backend router might not wrap in {success: true, data: ...}, but let's assume it returns directly
    // Wait, let's look at what we wrote in backend router:
    // return { "data": activities, "total": len(activities) }
    // fetchApiJson expects { success: true } by default but it's okay if we bypass or if we wrap it.
    // Wait, fetchApiJson expects `{ success: true }` in `payload?.success === false`. 
    // If there is no `success` field, `payload?.success === false` is false, so it doesn't throw.
    
    const response = await fetchApiJson<{ data: ActivityLog[], total: number }>(url, { cache: false });
    return response;
  } catch (error) {
    console.error("Error fetching activity logs", error);
    throw error;
  }
};

export const createActivityLog = async (
  action_type: string,
  entity: string,
  details: string = ""
): Promise<void> => {
  try {
    const url = buildApiUrl("/api/activity");
    await fetchApiJson<{ status: string }>(url, {
      method: "POST",
      cache: false,
      body: JSON.stringify({ user_id: "", action_type, entity, details })
    });
  } catch (error) {
    console.error("Error creating activity log", error);
  }
};

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  AuthProvider,
  CHART_BUILDER_SESSION_KEY,
  useAuth,
} from "../../src/app/context/AuthContext";

describe("chart builder login session", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("clears persisted chart selections only when a new login succeeds", () => {
    sessionStorage.setItem(CHART_BUILDER_SESSION_KEY, "saved-chart-state");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(sessionStorage.getItem(CHART_BUILDER_SESSION_KEY)).toBe("saved-chart-state");

    act(() => result.current.login({
      username: "manager01",
      name: "Manager",
      email: "manager@example.com",
      role: "manager",
    }, false));

    expect(sessionStorage.getItem(CHART_BUILDER_SESSION_KEY)).toBeNull();
  });
});

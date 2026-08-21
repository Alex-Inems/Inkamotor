"use client";

import { createContext, useContext, type ReactNode } from "react";
import { currentUser, type SessionUser } from "@/lib/session";

const SessionUserContext = createContext<SessionUser>(currentUser);

export function SessionUserProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  return (
    <SessionUserContext.Provider value={user}>
      {children}
    </SessionUserContext.Provider>
  );
}

export function useSessionUser() {
  return useContext(SessionUserContext);
}

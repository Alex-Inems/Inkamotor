export const TOUR_STORAGE_KEY = "inkamoto-crm-tour-v1";
export const TOUR_START_EVENT = "inkamoto-start-tour";

export type TourStepId =
  | "welcome"
  | "overview"
  | "inbox"
  | "leads"
  | "bookings"
  | "invoices"
  | "newsletter"
  | "setup"
  | "done";

export type TourStep = {
  id: TourStepId;
  target: string | null;
  titleKey: string;
  bodyKey: string;
};

export const tourSteps: TourStep[] = [
  {
    id: "welcome",
    target: null,
    titleKey: "tour.welcomeTitle",
    bodyKey: "tour.welcomeBody",
  },
  {
    id: "overview",
    target: "overview",
    titleKey: "tour.overviewTitle",
    bodyKey: "tour.overviewBody",
  },
  {
    id: "inbox",
    target: "inbox",
    titleKey: "tour.inboxTitle",
    bodyKey: "tour.inboxBody",
  },
  {
    id: "leads",
    target: "leads",
    titleKey: "tour.leadsTitle",
    bodyKey: "tour.leadsBody",
  },
  {
    id: "bookings",
    target: "bookings",
    titleKey: "tour.bookingsTitle",
    bodyKey: "tour.bookingsBody",
  },
  {
    id: "invoices",
    target: "invoices",
    titleKey: "tour.invoicesTitle",
    bodyKey: "tour.invoicesBody",
  },
  {
    id: "newsletter",
    target: "newsletter",
    titleKey: "tour.newsletterTitle",
    bodyKey: "tour.newsletterBody",
  },
  {
    id: "setup",
    target: "setup",
    titleKey: "tour.setupTitle",
    bodyKey: "tour.setupBody",
  },
  {
    id: "done",
    target: null,
    titleKey: "tour.doneTitle",
    bodyKey: "tour.doneBody",
  },
];

export function tourSeen() {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === "done";
  } catch {
    return true;
  }
}

export function markTourSeen() {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "done");
  } catch {
    /* ignore */
  }
}

export function startTour() {
  window.dispatchEvent(new Event(TOUR_START_EVENT));
}

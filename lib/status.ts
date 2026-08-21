export function leadTone(status: string) {
  switch (status) {
    case "new":
      return "info" as const;
    case "contacted":
      return "neutral" as const;
    case "qualified":
      return "warning" as const;
    case "won":
      return "success" as const;
    default:
      return "danger" as const;
  }
}

export function invoiceTone(status: string) {
  switch (status) {
    case "paid":
      return "success" as const;
    case "sent":
      return "info" as const;
    case "overdue":
      return "danger" as const;
    case "draft":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

export function adTone(status: string) {
  switch (status) {
    case "active":
      return "success" as const;
    case "paused":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

export function newsletterTone(status: string) {
  switch (status) {
    case "sent":
      return "success" as const;
    case "sending":
    case "scheduled":
      return "info" as const;
    case "draft":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

export function inquiryTone(status: string) {
  switch (status) {
    case "new":
      return "info" as const;
    case "triaged":
      return "warning" as const;
    case "converted":
      return "success" as const;
    default:
      return "neutral" as const;
  }
}

export function followUpTone(status: string) {
  switch (status) {
    case "open":
      return "info" as const;
    case "done":
      return "success" as const;
    case "overdue":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export function saleTone(status: string) {
  switch (status) {
    case "pending":
      return "warning" as const;
    case "confirmed":
      return "info" as const;
    case "fulfilled":
      return "success" as const;
    default:
      return "danger" as const;
  }
}

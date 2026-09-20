/** Odoo-like icons for Email Marketing (Font Awesome / Odoo UI style). */

type IconProps = { className?: string };

const base = "h-3.5 w-3.5 shrink-0";

export function FaPlus({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M19 11h-6V5a1 1 0 1 0-2 0v6H5a1 1 0 1 0 0 2h6v6a1 1 0 1 0 2 0v-6h6a1 1 0 1 0 0-2z" />
    </svg>
  );
}

export function FaPencil({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  );
}

export function FaCog({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.1 7.1 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.5.39 1.04.71 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.25.1.54 0 .68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z" />
    </svg>
  );
}

export function FaPaperPlane({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

export function FaClock({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm1 11H7v-2h4V6h2v7z" />
    </svg>
  );
}

export function FaFlask({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M6 2h12v2h-1v1.17l4.66 8.16A4 4 0 0 1 18.17 20H5.83a4 4 0 0 1-3.49-6.67L7 5.17V4H6V2zm3 2v1.83L4.67 14.1A2 2 0 0 0 5.83 18h12.34a2 2 0 0 0 1.16-3.9L15 5.83V4H9z" />
    </svg>
  );
}

export function FaStar({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="m12 17.27 6.18 3.73-1.64-7.03L21 9.24l-7.19-.61L12 2 10.19 8.63 3 9.24l5.46 4.73L6.82 21z" />
    </svg>
  );
}

export function FaSave({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z" />
    </svg>
  );
}

export function FaTrash({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
  );
}

export function FaCopy({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" />
    </svg>
  );
}

export function FaDesktop({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M21 2H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h7v2H8v2h8v-2h-2v-2h7a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zm-1 12H4V4h16v10z" />
    </svg>
  );
}

export function FaCode({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="m9.4 16.6-4.6-4.6 4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
    </svg>
  );
}

export const SNIPPET_THUMB = {
  headers: "/email-marketing/snippets/s_cover.svg",
  text: "/email-marketing/snippets/s_text_block.svg",
  images: "/email-marketing/snippets/s_picture.svg",
  person: "/email-marketing/snippets/s_company_team.svg",
  columns: "/email-marketing/snippets/s_three_columns.svg",
  website: "/email-marketing/snippets/s_blog_posts.svg",
  footer: "/email-marketing/snippets/block_footer_social.png",
  alert: "/email-marketing/snippets/s_alert.svg",
  separator: "/email-marketing/snippets/s_hr.svg",
  highlight: "/email-marketing/snippets/s_text_highlight.svg",
  rating: "/email-marketing/snippets/s_rating.svg",
  button: "/email-marketing/snippets/s_button.svg",
  image: "/email-marketing/snippets/s_image.svg",
  icon: "/email-marketing/snippets/s_icon.svg",
  video: "/email-marketing/snippets/s_video.svg",
  badge: "/email-marketing/snippets/s_badge.svg",
  ctaBadge: "/email-marketing/snippets/s_cta_badge.svg",
  features: "/email-marketing/snippets/s_features.svg",
} as const;

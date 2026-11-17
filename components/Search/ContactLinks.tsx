import { Globe, Mail, ArrowUpRight } from "lucide-react";
import type { Contact } from "@/lib/schema";
import { normalizeContact, publicUrl } from "@/lib/contacts";
import { evidenceLink } from "@/lib/sources";

const labels = {
  email: "Email",
  linkedin: "LinkedIn",
  x: "X",
  github: "GitHub",
  website: "Website",
};
function ContactIcon({ kind }: { kind: Contact["kind"] }) {
  if (kind === "email") return <Mail size={15} />;
  if (kind === "linkedin")
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96c0 .84.69 1.52 1.55 1.52h16.9c.86 0 1.55-.68 1.55-1.52V3.52c0-.84-.69-1.52-1.55-1.52ZM7.93 18.75H4.98V9.2h2.95v9.55ZM6.45 7.9a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42Zm12.3 10.85H15.8v-4.65c0-1.11-.02-2.54-1.55-2.54-1.55 0-1.79 1.21-1.79 2.46v4.73H9.51V9.2h2.83v1.3h.04c.4-.75 1.36-1.55 2.8-1.55 3 0 3.57 1.98 3.57 4.55v5.25Z" />
      </svg>
    );
  if (kind === "github")
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 .5a12 12 0 0 0-3.79 23.38c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.97 0-1.32.47-2.39 1.24-3.23-.12-.3-.54-1.53.12-3.19 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.89.12 3.19.77.84 1.24 1.91 1.24 3.23 0 4.64-2.81 5.66-5.49 5.96.43.37.82 1.1.82 2.22v3.3c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" />
      </svg>
    );
  if (kind === "website") return <Globe size={15} />;
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-7.4L5.5 22H2.3l7.9-9L.8 2h6.5l4.4 6.7L18.9 2Zm-1.1 18h1.7L6.4 4H4.5l13.3 16Z" />
    </svg>
  );
}
export function ContactLinks({
  name,
  contacts,
  detailed = false,
}: {
  name: string;
  contacts: Contact[];
  detailed?: boolean;
}) {
  if (!contacts.length) return null;
  return (
    <div
      className={detailed ? "contact-details" : "contact-icons"}
      role="group"
      aria-label={`Contact links for ${name}`}
    >
      {contacts.map((contact) => {
        // Defense in depth: never expose an unvalidated href, even in local fixtures.
        const normalized = normalizeContact(
          contact.kind,
          contact.kind === "email" ? contact.label : contact.href,
        );
        if (!normalized || !publicUrl(contact.sourceUrl)) return null;
        const link = (
          <a
            className="contact-link"
            href={normalized.href}
            target={contact.kind === "email" ? undefined : "_blank"}
            rel="noopener noreferrer"
            aria-label={`${labels[contact.kind]} ${name}${contact.kind === "email" ? `: ${contact.label}` : ""}`}
            title={`${labels[contact.kind]} · ${contact.label} · From ${new URL(contact.sourceUrl).hostname}`}
          >
            <ContactIcon kind={contact.kind} />
            {detailed && <span>{contact.label}</span>}
          </a>
        );
        return detailed ? (
          <div className="contact-detail" key={contact.href}>
            {link}
            <a
              className="contact-source"
              href={evidenceLink(
                contact.sourceUrl,
                contact.quote,
                contact.page,
              )}
              target="_blank"
              rel="noopener noreferrer"
              title={contact.quote}
            >
              Source <ArrowUpRight size={11} />
            </a>
          </div>
        ) : (
          <span key={contact.href}>{link}</span>
        );
      })}
    </div>
  );
}
